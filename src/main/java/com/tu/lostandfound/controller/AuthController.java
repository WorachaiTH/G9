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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);
    private static final String TU_API_URL = "https://restapi.tu.ac.th/api/v1/auth/ad/verify";
    private static final String EXTRA_ROOT_CERT = "/sectigo-root-r46.der";
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

        final SSLContext sslContext = buildSslContext();
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory() {
            @Override
            protected void prepareConnection(HttpURLConnection connection, String httpMethod) throws IOException {
                if (sslContext != null && connection instanceof HttpsURLConnection https) {
                    https.setSSLSocketFactory(sslContext.getSocketFactory());
                }
                super.prepareConnection(connection, httpMethod);
            }
        };
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(5000);
        this.restTemplate = new RestTemplate(factory);

        if (jwtSecret.length() >= 32) {
            this.secretKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        } else {
            byte[] random = new byte[32];
            new SecureRandom().nextBytes(random);
            this.secretKey = Keys.hmacShaKeyFor(random);
        }
    }

    private static SSLContext buildSslContext() {
        try (InputStream in = AuthController.class.getResourceAsStream(EXTRA_ROOT_CERT)) {
            if (in == null) {
                System.err.println("Missing resource " + EXTRA_ROOT_CERT);
                return null;
            }
            X509Certificate extraRoot = (X509Certificate) CertificateFactory.getInstance("X.509").generateCertificate(in);

            KeyStore keyStore = KeyStore.getInstance(KeyStore.getDefaultType());
            keyStore.load(null, null);
            keyStore.setCertificateEntry("extra-root", extraRoot);

            TrustManagerFactory defaultFactory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            defaultFactory.init((KeyStore) null);
            int i = 0;
            for (TrustManager tm : defaultFactory.getTrustManagers()) {
                if (tm instanceof X509TrustManager x509) {
                    for (X509Certificate cert : x509.getAcceptedIssuers()) {
                        keyStore.setCertificateEntry("default-" + i++, cert);
                    }
                }
            }

            TrustManagerFactory factory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            factory.init(keyStore);
            SSLContext context = SSLContext.getInstance("TLS");
            context.init(null, factory.getTrustManagers(), null);
            return context;
        } catch (Exception e) {
            System.err.println("Cannot build SSL context: " + e);
            return null;
        }
    }

    @PostMapping("/login")

    public ResponseEntity<?> login(@RequestBody Map<String, String> loginRequest) {
        String employeeId = loginRequest.get("employeeId");
        String password = loginRequest.get("password");

        if (employeeId == null || !employeeId.trim().matches("\\d+")) {
            return ResponseEntity.badRequest().body("กรุณากรอกรหัสประจำตัวบุคลากรเป็นตัวเลข");
        }
        final String normalizedEmployeeId = employeeId.trim();

        if (password == null || password.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("กรุณากรอกรหัสผ่าน");
        }

        if (!devMode && appKey.isBlank()) {
            return ResponseEntity.status(503).body("ระบบยังไม่ได้ตั้งค่า tu.api.app-key");
        }

        Map<String, Object> profile;
        try {
            profile = devMode ? Map.of() : verifyWithTuApi(normalizedEmployeeId, password);
        } catch (RestClientException e) {
            return ResponseEntity.status(503).body("ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนของมหาวิทยาลัยได้");
        }

        if (profile == null) {
            logger.info("TU API rejected login credentials");
            return ResponseEntity.status(401).body("รหัสประจำตัวหรือรหัสผ่านไม่ถูกต้อง");
        }

        // ไม่เก็บรหัสผ่าน (ตรวจกับระบบของมหาลัยทุกครั้ง)
        User user = userRepository.findByEmployeeId(normalizedEmployeeId)
                .orElseGet(() -> userRepository.save(new User(normalizedEmployeeId, "")));

        String token = Jwts.builder()
                .setSubject(user.getEmployeeId())
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + TOKEN_TTL_MS))
                .signWith(secretKey)
                .compact();

        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        response.put("employeeId", user.getEmployeeId());
        response.put("displayName", profileValue(
                profile, "displayname_th", "displayname_en", "displayname", "displayName"));
        String email = profileValue(profile, "email");
        if (email != null) response.put("email", email);
        return ResponseEntity.ok(response);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> verifyWithTuApi(String employeeId, String password) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Application-Key", appKey);

        Map<String, String> body = new HashMap<>();
        body.put("UserName", employeeId);
        body.put("PassWord", password);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    TU_API_URL, HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
            if (!response.getStatusCode().is2xxSuccessful()) return null;

            // บาง API ตอบ 200 แต่ส่ง "status": false เมื่อรหัสผิด
            Map<String, Object> profile = response.getBody();
            Object status = profile == null ? null : profile.get("status");
            return status instanceof Boolean b && !b ? null : profile;
        } catch (HttpClientErrorException e) {
            logger.warn("TU API rejected the authentication request with HTTP {}", e.getStatusCode().value());
            return null; // 4xx = ข้อมูลล็อกอินไม่ถูกต้อง
        }
    }

    private String profileValue(Map<String, Object> profile, String... keys) {
        for (String key : keys) {
            Object value = profile.get(key);
            if (value instanceof String text && !text.isBlank()) return text;
        }
        return null;
    }
}