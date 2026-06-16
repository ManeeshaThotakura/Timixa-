package com.timixa.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

@Component
public class JwtUtil {

    private final SecretKey key;
    private final Duration expiry;

    @Autowired
    public JwtUtil(@Value("${app.jwt.secret}") String secret,
                   @Value("${app.jwt.expiry-seconds}") long expirySeconds) {
        this(secret, Duration.ofSeconds(expirySeconds));
    }

    JwtUtil(String secret, Duration expiry) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expiry = expiry;
    }

    public String generate(UUID userId, String email, String role) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(userId.toString())
            .claim("email", email)
            .claim("role", role)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(expiry)))
            .signWith(key)
            .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }

    public Optional<String> extract(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) return Optional.empty();
        return Optional.of(header.substring(7));
    }
}
