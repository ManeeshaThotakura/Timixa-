package com.timixa.backend.insights.dto;

import java.time.LocalDate;

public record DaySummary(
    LocalDate date,
    int applicable,
    int completed,
    int percent
) {}
