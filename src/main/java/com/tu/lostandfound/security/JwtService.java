package com.tu.lostandfound.security;

import com.tu.lostandfound.exception.ApiException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.security.SecureRandom;
import java.util.Date;

@Component
public class JwtService {

    private static final long TOKEN_TTL_MS = 24L * 60 * 60 * 1000;
    private static final String BEARER_PREFIX = "Bearer ";
    private final Key secretKey;

    public JwtService(@Value("${jwt.secret:}") String jwtSecret) {
        if (jwtSecret.length() >= 32) {
            this.secretKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        } else {
            byte[] random = new byte[32];
            new SecureRandom().nextBytes(random);
            this.secretKey = Keys.hmacShaKeyFor(random);
        }
    }

    public String createToken(String employeeId) {
        return Jwts.builder()
                .setSubject(employeeId)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + TOKEN_TTL_MS))
                .signWith(secretKey)
                .compact();
    }

    public String parseEmployeeId(String token) {
        try {
            return Jwts.parserBuilder().setSigningKey(secretKey).build()
                    .parseClaimsJws(token).getBody().getSubject();
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    public String employeeIdFromHeader(String authorization) {
        if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
            return null;
        }
        return parseEmployeeId(authorization.substring(BEARER_PREFIX.length()));
    }

    public String requireEmployeeId(String authorization, String message) {
        String employeeId = employeeIdFromHeader(authorization);
        if (employeeId == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, message);
        }
        return employeeId;
    }
}
