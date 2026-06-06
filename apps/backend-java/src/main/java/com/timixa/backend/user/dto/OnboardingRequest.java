package com.timixa.backend.user.dto;

import jakarta.validation.constraints.*;

public record OnboardingRequest(
    @NotNull @Min(13) @Max(120) Integer age,
    @NotBlank @Size(min = 1, max = 80) String occupation,
    @NotBlank @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "must be HH:mm") String bedtime,
    @NotBlank @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "must be HH:mm") String wakeTime
) {}
