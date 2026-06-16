package com.timixa.backend.task.dto;

import com.timixa.backend.task.ExceptionType;
import com.timixa.backend.task.PlannedTaskException;

import java.time.LocalDate;

public record PlannedTaskExceptionResponse(
    LocalDate date,
    ExceptionType type
) {
    public static PlannedTaskExceptionResponse from(PlannedTaskException e) {
        return new PlannedTaskExceptionResponse(e.getExceptionDate(), e.getExceptionType());
    }
}
