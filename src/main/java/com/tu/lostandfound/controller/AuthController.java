package com.tu.lostandfound.controller;

import com.tu.lostandfound.model.User;
import com.tu.lostandfound.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.security.SecureRandom;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private static final String TU_API_URL = "https://restapi.tu.ac.th/api/v1/auth/ad/verify";
    private static final String EMAIL_DOMAIN = "@dome.tu.ac.th";
    private static final long TOKEN_TTL_MS = 24L * 60 * 60 * 1000;

    private final UserRepository userRepository;
    private final RestTemplate restTemplate;
    private final String appKey;
    private final boolean devMode;
    private final Key secretKey;

    public AuthController(UserRepository userRepository,
                          @Value("${tu.api.app-key:}") String appKey,
                          @Value("${tu.api.dev-mode:false}") boolean devMode,
                          @Value("${jwt.secret:}") String jwtSecret) {
        this.userRepository = userRepository;
        this.appKey = appKey;
        this.devMode = devMode;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(5000);
        this.restTemplate = new RestTemplate(factory);

        if (jwtSecret.length() >= 32) {
            this.secretKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        } else {
            // ไม่ได้ตั้ง jwt.secret: สุ่มคีย์ใหม่ (token จะใช้ไม่ได้หลังรีสตาร์ท)
            byte[] random = new byte[32];
            new SecureRandom().nextBytes(random);
            this.secretKey = Keys.hmacShaKeyFor(random);
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> loginRequest) {
        String email = loginRequest.get("email");
        String password = loginRequest.get("password");

        if (email == null || !email.trim().toLowerCase().endsWith(EMAIL_DOMAIN)) {
            return ResponseEntity.badRequest().body("กรุณาใช้อีเมลมหาวิทยาลัย (" + EMAIL_DOMAIN + ") เท่านั้น");
        }
        email = email.trim().toLowerCase();

        if (password == null || password.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("กรุณากรอกรหัสผ่าน");
        }

        if (!devMode && appKey.isBlank()) {
            return ResponseEntity.status(503).body("ระบบยังไม่ได้ตั้งค่า tu.api.app-key");
        }

        boolean authenticated;
        try {
            authenticated = devMode || verifyWithTuApi(email, password);
        } catch (RestClientException e) {
            return ResponseEntity.status(503).body("ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนของมหาวิทยาลัยได้");
        }

        if (!authenticated) {
            return ResponseEntity.status(401).body("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        }

        final String userEmail = email;
        // ไม่เก็บรหัสผ่าน (ตรวจกับระบบของมหาลัยทุกครั้ง)
        User user = userRepository.findByEmail(userEmail)
                .orElseGet(() -> userRepository.save(new User(userEmail, "")));

        String token = Jwts.builder()
                .setSubject(user.getEmail())
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + TOKEN_TTL_MS))
                .signWith(secretKey)
                .compact();

        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        response.put("email", user.getEmail());
        return ResponseEntity.ok(response);
    }

    @SuppressWarnings("unchecked")
    private boolean verifyWithTuApi(String email, String password) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Application-Key", appKey);

        Map<String, String> body = new HashMap<>();
        body.put("userName", email);
        body.put("password", password);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    TU_API_URL, HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
            if (!response.getStatusCode().is2xxSuccessful()) return false;

            // บาง API ตอบ 200 แต่ส่ง "status": false เมื่อรหัสผิด
            Object status = response.getBody() == null ? null : response.getBody().get("status");
            return !(status instanceof Boolean b) || b;
        } catch (HttpClientErrorException e) {
            return false; // 4xx = ข้อมูลล็อกอินไม่ถูกต้อง
        }
    }
}