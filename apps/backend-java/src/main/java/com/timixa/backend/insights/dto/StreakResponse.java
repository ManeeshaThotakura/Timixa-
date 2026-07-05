package com.timixa.backend.insights.dto;

import java.util.UUID;

public record StreakResponse(UUID taskId, String title, int length) {}
