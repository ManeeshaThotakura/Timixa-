package com.timixa.backend.user;

import com.timixa.backend.security.UserPrincipal;
import com.timixa.backend.user.dto.OnboardingRequest;
import com.timixa.backend.user.dto.UserResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService users;

    public UserController(UserService users) { this.users = users; }

    @PatchMapping("/me/onboarding")
    public UserResponse completeOnboarding(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody OnboardingRequest req) {
        return users.completeOnboarding(principal.id(), req);
    }
}
