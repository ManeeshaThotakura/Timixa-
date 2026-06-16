package com.timixa.backend.auth;

import com.timixa.backend.auth.dto.AuthResponse;
import com.timixa.backend.auth.dto.LoginRequest;
import com.timixa.backend.auth.dto.RegisterRequest;
import com.timixa.backend.security.UserPrincipal;
import com.timixa.backend.user.UserService;
import com.timixa.backend.user.dto.UserResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;
    private final UserService users;

    public AuthController(AuthService auth, UserService users) {
        this.auth = auth;
        this.users = users;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(auth.register(req));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        return auth.login(req);
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal UserPrincipal principal) {
        return users.findById(principal.id());
    }
}
