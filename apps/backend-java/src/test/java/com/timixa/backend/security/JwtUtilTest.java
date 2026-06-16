package com.timixa.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.security.SignatureException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

class JwtUtilTest {

    private JwtUtil util;
    private static final String SECRET = "test-secret-test-secret-test-secret-test-secret";

    @BeforeEach
    void setup() {
        util = new JwtUtil(SECRET, Duration.ofMinutes(10));
    }

    @Test
    void generated_token_round_trips() {
        UUID userId = UUID.randomUUID();
        String token = util.generate(userId, "a@b.com", "MEMBER");
        Claims claims = util.parse(token);
        assertThat(claims.getSubject()).isEqualTo(userId.toString());
        assertThat(claims.get("email", String.class)).isEqualTo("a@b.com");
        assertThat(claims.get("role", String.class)).isEqualTo("MEMBER");
    }

    @Test
    void expired_token_throws() {
        JwtUtil shortLived = new JwtUtil(SECRET, Duration.ofMillis(-1));
        String token = shortLived.generate(UUID.randomUUID(), "a@b.com", "MEMBER");
        assertThatThrownBy(() -> shortLived.parse(token))
            .isInstanceOf(ExpiredJwtException.class);
    }

    @Test
    void tampered_signature_throws() {
        String token = util.generate(UUID.randomUUID(), "a@b.com", "MEMBER");
        String tampered = token.substring(0, token.length() - 2) + "xx";
        assertThatThrownBy(() -> util.parse(tampered))
            .isInstanceOf(SignatureException.class);
    }
}
