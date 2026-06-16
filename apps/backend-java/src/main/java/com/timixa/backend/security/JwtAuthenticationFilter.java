package com.timixa.backend.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwt;

    public JwtAuthenticationFilter(JwtUtil jwt) { this.jwt = jwt; }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        jwt.extract(req).ifPresent(token -> {
            try {
                Claims c = jwt.parse(token);
                UserPrincipal principal = new UserPrincipal(
                    UUID.fromString(c.getSubject()),
                    c.get("email", String.class),
                    c.get("role", String.class)
                );
                var auth = new UsernamePasswordAuthenticationToken(
                    principal, null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + principal.role()))
                );
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception ignored) {
                // bad token → leave context empty; security chain rejects downstream
            }
        });
        chain.doFilter(req, res);
    }
}
