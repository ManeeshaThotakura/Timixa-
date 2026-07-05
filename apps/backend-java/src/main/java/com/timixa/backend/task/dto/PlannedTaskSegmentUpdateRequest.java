package com.timixa.backend.task.dto;

import jakarta.validation.constraints.Pattern;

public record PlannedTaskSegmentUpdateRequest(
    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "must be HH:mm") String startTime,
    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "must be HH:mm") String endTime
) {}
