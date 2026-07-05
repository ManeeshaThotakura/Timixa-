package com.timixa.backend.task.dto;

import jakarta.validation.constraints.*;

import java.time.LocalDate;

public record PlannedTaskSegmentRequest(
    @NotNull LocalDate date,
    @NotBlank @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "must be HH:mm") String startTime,
    @NotBlank @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "must be HH:mm") String endTime
) {}
