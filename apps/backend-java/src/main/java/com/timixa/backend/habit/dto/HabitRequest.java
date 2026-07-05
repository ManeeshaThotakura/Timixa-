package com.timixa.backend.habit.dto;

import jakarta.validation.constraints.*;

public record HabitRequest(
    @NotBlank @Size(max = 120) String title,
    @Size(max = 80) String category,
    @Size(max = 60) String icon,
    @Min(1) Integer targetCount,
    @Size(max = 24) String unit,
    @Pattern(regexp = "^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$") String color,
    @Size(max = 80) String goalId
) {}
