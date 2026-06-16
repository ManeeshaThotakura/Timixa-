package com.timixa.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class JwtAuthenticationFilterTest {

    private static final String SECRET = "test-secret-test-secret-test-secret-test-secret";
    private final JwtUtil util = new JwtUtil(SECRET, Duration.ofMinutes(10));
    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(util);

    @AfterEach
    void clear() { SecurityContextHolder.clearContext(); }

    @Test
    void no_header_leaves_context_empty() throws Exception {
        HttpServletRequest req = new MockHttpServletRequest();
        HttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(req, res);
    }

    @Test
    void valid_bearer_populates_principal() throws Exception {
        UUID userId = UUID.randomUUID();
        String token = util.generate(userId, "a@b.com", "MEMBER");
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("Authorization", "Bearer " + token);
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, new MockHttpServletResponse(), chain);

        var auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isNotNull();
        assertThat(auth.getPrincipal()).isInstanceOf(UserPrincipal.class);
        UserPrincipal principal = (UserPrincipal) auth.getPrincipal();
        assertThat(principal.id()).isEqualTo(userId);
        assertThat(principal.email()).isEqualTo("a@b.com");
    }

    @Test
    void malformed_token_leaves_context_empty() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("Authorization", "Bearer not-a-real-jwt");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(req, res);
    }
}
