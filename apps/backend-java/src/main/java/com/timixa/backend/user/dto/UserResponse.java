package com.timixa.backend.user.dto;

import com.timixa.backend.user.Role;
import com.timixa.backend.user.User;

import java.util.UUID;

public record UserResponse(
    UUID id,
    String name,
    String email,
    Role role,
    Integer age,
    String occupation,
    String bedtime,
    String wakeTime,
    boolean onboardingComplete
) {
    public static UserResponse from(User u) {
        return new UserResponse(
            u.getId(), u.getName(), u.getEmail(), u.getRole(),
            u.getAge(), u.getOccupation(), u.getBedtime(), u.getWakeTime(),
            u.isOnboardingComplete()
        );
    }
}
