package com.timixa.backend.auth;

import com.timixa.backend.auth.dto.AuthResponse;
import com.timixa.backend.auth.dto.LoginRequest;
import com.timixa.backend.auth.dto.RegisterRequest;
import com.timixa.backend.common.EmailTakenException;
import com.timixa.backend.common.InvalidCredentialsException;
import com.timixa.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("dev")
class AuthServiceTest {

    @Autowired AuthService auth;
    @Autowired UserRepository users;

    @BeforeEach
    void clean() { users.deleteAll(); }

    @Test
    void register_creates_user_and_returns_token() {
        AuthResponse res = auth.register(new RegisterRequest("a@b.com", "password123", "Alex"));
        assertThat(res.token()).isNotBlank();
        assertThat(res.user().email()).isEqualTo("a@b.com");
        assertThat(res.user().onboardingComplete()).isFalse();
        assertThat(users.existsByEmailIgnoreCase("A@B.COM")).isTrue();
    }

    @Test
    void register_with_duplicate_email_throws() {
        auth.register(new RegisterRequest("a@b.com", "password123", "Alex"));
        assertThatThrownBy(() ->
            auth.register(new RegisterRequest("A@B.COM", "differentpw", "Alex2"))
        ).isInstanceOf(EmailTakenException.class);
    }

    @Test
    void login_with_correct_credentials_returns_token() {
        auth.register(new RegisterRequest("a@b.com", "password123", "Alex"));
        AuthResponse res = auth.login(new LoginRequest("a@b.com", "password123"));
        assertThat(res.token()).isNotBlank();
    }

    @Test
    void login_with_wrong_password_throws_invalid_credentials() {
        auth.register(new RegisterRequest("a@b.com", "password123", "Alex"));
        assertThatThrownBy(() -> auth.login(new LoginRequest("a@b.com", "wrong-pw1")))
            .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void login_with_unknown_user_throws_same_exception() {
        assertThatThrownBy(() -> auth.login(new LoginRequest("nobody@b.com", "password123")))
            .isInstanceOf(InvalidCredentialsException.class);
    }
}
