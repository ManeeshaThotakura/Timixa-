package com.timixa.backend.user;

import com.timixa.backend.common.OnboardingAlreadyCompleteException;
import com.timixa.backend.user.dto.OnboardingRequest;
import com.timixa.backend.user.dto.UserResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class UserService {

    private final UserRepository users;

    public UserService(UserRepository users) { this.users = users; }

    @Transactional(readOnly = true)
    public UserResponse findById(UUID id) {
        return users.findById(id)
            .map(UserResponse::from)
            .orElseThrow(() -> new RuntimeException("User not found"));
    }

    @Transactional
    public UserResponse completeOnboarding(UUID id, OnboardingRequest req) {
        User u = users.findById(id).orElseThrow(() -> new RuntimeException("User not found"));
        if (u.isOnboardingComplete()) {
            throw new OnboardingAlreadyCompleteException();
        }
        u.setAge(req.age());
        u.setOccupation(req.occupation());
        u.setBedtime(req.bedtime());
        u.setWakeTime(req.wakeTime());
        u.setOnboardingComplete(true);
        return UserResponse.from(users.save(u));
    }
}
