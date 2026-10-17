package com.tu.lostandfound.controller;

import com.tu.lostandfound.model.User;
import com.tu.lostandfound.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    private static final String TU_API_URL = "https://restapi.tu.ac.th/api/v1/auth/ad/verify";
    private static final String APP_KEY = "YOUR_TU_APP_KEY_HERE";
    private static final Key SECRET_KEY = Keys.secretKeyFor(SignatureAlgorithm.HS256);

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> loginRequest) {
        String email = loginRequest.get("email");
        String password = loginRequest.get("password");

        if (email == null || !email.endsWith("@dome.tu.ac.th")) {
            return ResponseEntity.badRequest().body("Error: กรุณาใช้อีเมลมหาวิทยาลัย (@dome.tu.ac.th) เท่านั้น");
        }

        if (password == null || password.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Error: กรุณากรอกรหัสผ่าน");
        }

        boolean isAuthenticated = verifyWithTuApi(email, password);

        if (!isAuthenticated) {
            return ResponseEntity.status(401).body("Error: อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        }

        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User newUser = new User(email, password);
            return userRepository.save(newUser);
        });

        String token = Jwts.builder()
                .setSubject(user.getEmail())
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + 86400000))
                .signWith(SECRET_KEY)
                .compact();

        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        response.put("email", user.getEmail());

        return ResponseEntity.ok(response);
    }

    private boolean verifyWithTuApi(String email, String password) {
        if ("YOUR_TU_APP_KEY_HERE".equals(APP_KEY)) {
            return true;
        }

        try {
            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Application-Key", APP_KEY);

            Map<String, String> body = new HashMap<>();
            body.put("userName", email);
            body.put("password", password);

            HttpEntity<Map<String, String>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.exchange(TU_API_URL, HttpMethod.POST, entity, String.class);

            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            return false;
        }
    }
}