package com.timixa.backend.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/** Create a directory member for someone who does not have an account yet. */
public record NewTeamMemberRequest(
    /** Optional client-generated id for optimistic UI. */
    UUID id,
    @NotBlank @Size(max = 80) String name,
    @Size(max = 9) String color,
    @Size(max = 512) String avatarUrl
) {}
