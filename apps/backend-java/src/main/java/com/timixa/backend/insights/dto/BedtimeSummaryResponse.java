package com.timixa.backend.insights.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.timixa.backend.task.dto.PlannedTaskResponse;

import java.time.LocalDate;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record BedtimeSummaryResponse(
    LocalDate date,
    List<PlannedTaskResponse> pendingToday,
    StreakResponse topStreak,
    StreakResponse topMissedStreak,
    TomorrowSummary tomorrow
) {}
