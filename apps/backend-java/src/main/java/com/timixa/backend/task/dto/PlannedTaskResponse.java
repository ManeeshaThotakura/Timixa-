package com.timixa.backend.task.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.timixa.backend.task.Cadence;
import com.timixa.backend.task.PlannedTask;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record PlannedTaskResponse(
    UUID id, UUID userId, String title, String goal, String color,
    Cadence cadence, boolean needsTimeSlot,
    String startTime, String endTime,
    LocalDate scheduledDate,
    Set<DayOfWeek> weekdays,
    Set<Integer> monthDays,
    Integer minTimeMinutes,
    Integer maxTimeMinutes,
    Integer minCount,
    Integer maxCount,
    List<PlannedTaskExceptionResponse> exceptions,
    boolean completedToday,
    Instant createdAt, Instant updatedAt
) {
    public static PlannedTaskResponse from(
            PlannedTask t,
            List<PlannedTaskExceptionResponse> exceptions,
            boolean completedToday) {
        return new PlannedTaskResponse(
            t.getId(), t.getUserId(), t.getTitle(), t.getGoal(), t.getColor(),
            t.getCadence(), t.isNeedsTimeSlot(),
            t.getStartTime(), t.getEndTime(),
            t.getScheduledDate(),
            t.getWeekdaysSet().isEmpty() ? null : t.getWeekdaysSet(),
            t.getMonthDaysSet().isEmpty() ? null : t.getMonthDaysSet(),
            t.getMinTimeMinutes(),
            t.getMaxTimeMinutes(),
            t.getMinCount(),
            t.getMaxCount(),
            exceptions == null ? List.of() : exceptions,
            completedToday,
            t.getCreatedAt(), t.getUpdatedAt()
        );
    }
}
