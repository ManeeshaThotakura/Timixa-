package com.timixa.backend.auth;

import com.timixa.backend.auth.dto.AuthResponse;
import com.timixa.backend.auth.dto.LoginRequest;
import com.timixa.backend.auth.dto.RegisterRequest;
import com.timixa.backend.common.EmailTakenException;
import com.timixa.backend.common.InvalidCredentialsException;
import com.timixa.backend.security.JwtUtil;
import com.timixa.backend.user.Role;
import com.timixa.backend.user.User;
import com.timixa.backend.user.UserRepository;
import com.timixa.backend.user.dto.UserResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtUtil jwt;

    public AuthService(UserRepository users, PasswordEncoder encoder, JwtUtil jwt) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (users.existsByEmailIgnoreCase(req.email())) {
            throw new EmailTakenException();
        }
        User u = new User();
        u.setEmail(req.email());
        u.setPasswordHash(encoder.encode(req.password()));
        u.setName(req.name());
        u.setRole(Role.MEMBER);
        u.setOnboardingComplete(false);
        users.save(u);
        return new AuthResponse(token(u), UserResponse.from(u));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req) {
        User u = users.findByEmailIgnoreCase(req.email())
            .orElseThrow(InvalidCredentialsException::new);
        if (!encoder.matches(req.password(), u.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }
        return new AuthResponse(token(u), UserResponse.from(u));
    }

    private String token(User u) {
        return jwt.generate(u.getId(), u.getEmail(), u.getRole().name());
    }
}
