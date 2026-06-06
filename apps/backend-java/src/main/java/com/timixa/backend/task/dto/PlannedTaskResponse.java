package com.timixa.backend.task.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.timixa.backend.task.Cadence;
import com.timixa.backend.task.PlannedTask;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
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
    boolean completedToday,
    Instant createdAt, Instant updatedAt
) {
    public static PlannedTaskResponse from(PlannedTask t, boolean completedToday) {
        return new PlannedTaskResponse(
            t.getId(), t.getUserId(), t.getTitle(), t.getGoal(), t.getColor(),
            t.getCadence(), t.isNeedsTimeSlot(),
            t.getStartTime(), t.getEndTime(),
            t.getScheduledDate(),
            t.getWeekdaysSet().isEmpty() ? null : t.getWeekdaysSet(),
            t.getMonthDaysSet().isEmpty() ? null : t.getMonthDaysSet(),
            completedToday,
            t.getCreatedAt(), t.getUpdatedAt()
        );
    }
}
