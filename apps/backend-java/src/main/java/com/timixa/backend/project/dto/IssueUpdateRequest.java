package com.timixa.backend.project.dto;

import jakarta.validation.constraints.Size;

import java.util.UUID;

/** Partial update for an issue; every field is optional. */
public record IssueUpdateRequest(
    @Size(max = 255) String title,
    @Size(max = 4000) String description,
    @Size(max = 4000) String acceptanceCriteria,
    String status,
    String priority,
    UUID assigneeId,
    UUID reporterId,
    Integer storyPoints,
    Integer estimateHours,
    UUID sprintId,
    UUID parentId,
    String startDate,
    String dueDate,
    String resolution,
    @Size(max = 9) String color
) {}
