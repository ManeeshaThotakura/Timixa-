package com.timixa.backend.insights.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record InsightSummaryResponse(
    int windowDays,
    int disciplinePercent,
    int adherencePercent,
    StreakResponse topStreak,
    List<DaySummary> days,
    List<GoalSummary> goals,
    List<TimeBlock> timeDistribution,
    TimeOfDayPerformance bestTime,
    TimeOfDayPerformance worstTime
) {}
