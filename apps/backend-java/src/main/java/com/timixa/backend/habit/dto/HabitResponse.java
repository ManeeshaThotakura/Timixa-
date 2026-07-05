package com.timixa.backend.habit.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.timixa.backend.habit.Habit;

import java.time.Instant;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record HabitResponse(
    UUID id,
    UUID userId,
    String title,
    String category,
    String icon,
    int targetCount,
    int currentCount,
    String unit,
    String color,
    String goalId,
    int streak,
    Instant createdAt,
    Instant updatedAt
) {
    public static HabitResponse from(Habit h, int currentCount, int streak) {
        return new HabitResponse(
            h.getId(), h.getUserId(), h.getTitle(), h.getCategory(), h.getIcon(),
            h.getTargetCount(), currentCount, h.getUnit(), h.getColor(), h.getGoalId(),
            streak, h.getCreatedAt(), h.getUpdatedAt()
        );
    }
}
