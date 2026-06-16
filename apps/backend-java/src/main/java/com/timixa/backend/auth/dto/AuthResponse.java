package com.timixa.backend.auth.dto;

import com.timixa.backend.user.dto.UserResponse;

public record AuthResponse(String token, UserResponse user) {}
