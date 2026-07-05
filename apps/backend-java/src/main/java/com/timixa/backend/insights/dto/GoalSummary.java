package com.timixa.backend.insights.dto;

public record GoalSummary(
    String goalName,
    int completionRate,
    String trend
) {}
