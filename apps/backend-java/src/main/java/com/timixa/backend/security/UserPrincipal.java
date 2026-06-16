package com.timixa.backend.security;

import java.util.UUID;

public record UserPrincipal(UUID id, String email, String role) {}
