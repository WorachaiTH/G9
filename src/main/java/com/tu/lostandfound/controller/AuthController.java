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

    private static final String TU_API_URL = "https://restapi.tu.ac.th/api/v1/auth/Ad/verify";
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
        String username = loginRequest.get("username");
        if (username == null) username = loginRequest.get("email");
        String password = loginRequest.get("password");

        if (username == null || username.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("กรุณากรอกรหัสนักศึกษา/ชื่อผู้ใช้");
        }
        username = username.trim();

        if (password == null || password.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("กรุณากรอกรหัสผ่าน");
        }

        if (!devMode && appKey.isBlank()) {
            return ResponseEntity.status(503).body("ระบบยังไม่ได้ตั้งค่า tu.api.app-key");
        }

        String identity;
        String displayName = username;

        if (devMode) {
            identity = username;
        } else {
            Map<String, Object> tuUser;
            try {
                tuUser = verifyWithTuApi(username, password);
            } catch (IllegalStateException e) {
                System.err.println("TU API key error: " + e);
                return ResponseEntity.status(503).body("คีย์เชื่อมต่อ TU API ไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ");
            } catch (RestClientException e) {
                System.err.println("TU API error: " + e);
                return ResponseEntity.status(503).body("ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนของมหาวิทยาลัยได้");
            }

            if (tuUser == null) {
                return ResponseEntity.status(401).body("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
            }

            Object email = tuUser.get("email");
            identity = (email instanceof String s && !s.isBlank()) ? s.trim().toLowerCase() : username;
            Object name = tuUser.get("displayname_th");
            if (name instanceof String n && !n.isBlank()) displayName = n;
        }

        final String userEmail = identity;
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
        response.put("username", username);
        response.put("displayName", displayName);
        return ResponseEntity.ok(response);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> verifyWithTuApi(String username, String password) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Application-Key", appKey);

        Map<String, String> body = new HashMap<>();
        body.put("UserName", username);
        body.put("PassWord", password);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    TU_API_URL, HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
            Map<String, Object> data = response.getBody();
            if (!response.getStatusCode().is2xxSuccessful() || data == null) return null;
            return Boolean.TRUE.equals(data.get("status")) ? data : null;
        } catch (HttpClientErrorException e) {
            int code = e.getStatusCode().value();
            if (code == 401 || code == 403) {
                throw new IllegalStateException("TU API key invalid");
            }
            return null;
        }
    }
}