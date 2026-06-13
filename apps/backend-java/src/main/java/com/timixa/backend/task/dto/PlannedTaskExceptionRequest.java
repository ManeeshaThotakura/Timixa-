package com.timixa.backend.task.dto;

import com.timixa.backend.task.ExceptionType;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record PlannedTaskExceptionRequest(
    @NotNull LocalDate date,
    @NotNull ExceptionType type
) {}
