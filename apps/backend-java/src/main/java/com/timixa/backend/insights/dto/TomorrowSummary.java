package com.timixa.backend.insights.dto;

import java.time.LocalDate;

public record TomorrowSummary(
    LocalDate date,
    int unscheduledCount,
    int overlapConflictCount
) {}
