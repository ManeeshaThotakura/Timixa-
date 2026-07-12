package com.timixa.backend.task.dto;

import com.timixa.backend.task.Cadence;
import jakarta.validation.constraints.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Set;

public record PlannedTaskUpdateRequest(
    @Size(max = 120) String title,
    @Size(max = 80) String goal,
    @Pattern(regexp = "^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$") String color,
    Cadence cadence,
    Boolean needsTimeSlot,
    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "must be HH:mm") String startTime,
    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "must be HH:mm") String endTime,
    LocalDate scheduledDate,
    Set<DayOfWeek> weekdays,
    Set<@Min(1) @Max(31) Integer> monthDays,
    @Min(0) Integer minTimeMinutes,
    @Min(0) Integer maxTimeMinutes,
    @Min(0) Integer minCount,
    @Min(0) Integer maxCount,
    Boolean notifyAtStart,
    Boolean notifyAtEnd
) {}
