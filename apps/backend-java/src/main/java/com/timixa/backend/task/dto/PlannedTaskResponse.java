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
    List<PlannedTaskSegmentResponse> segmentsForDate,
    List<PatternSlotResponse> patternForDate,
    boolean completedToday,
    int currentCount,
    boolean notifyAtStart,
    boolean notifyAtEnd,
    Instant createdAt, Instant updatedAt
) {
    public static PlannedTaskResponse from(
            PlannedTask t,
            List<PlannedTaskExceptionResponse> exceptions,
            List<PlannedTaskSegmentResponse> segmentsForDate,
            List<PatternSlotResponse> patternForDate,
            boolean completedToday,
            int currentCount) {
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
            segmentsForDate == null ? List.of() : segmentsForDate,
            patternForDate == null ? List.of() : patternForDate,
            completedToday,
            currentCount,
            t.isNotifyAtStart(),
            t.isNotifyAtEnd(),
            t.getCreatedAt(), t.getUpdatedAt()
        );
    }

    public static PlannedTaskResponse from(
            PlannedTask t,
            List<PlannedTaskExceptionResponse> exceptions,
            List<PlannedTaskSegmentResponse> segmentsForDate,
            boolean completedToday,
            int currentCount) {
        return from(t, exceptions, segmentsForDate, List.of(), completedToday, currentCount);
    }

    public static PlannedTaskResponse from(
            PlannedTask t,
            List<PlannedTaskExceptionResponse> exceptions,
            List<PlannedTaskSegmentResponse> segmentsForDate,
            boolean completedToday) {
        return from(t, exceptions, segmentsForDate, completedToday, completedToday ? Math.max(1, t.getMinCount() == null ? 1 : t.getMinCount()) : 0);
    }

    public static PlannedTaskResponse from(
            PlannedTask t,
            List<PlannedTaskExceptionResponse> exceptions,
            boolean completedToday) {
        return from(t, exceptions, List.of(), completedToday);
    }
}
