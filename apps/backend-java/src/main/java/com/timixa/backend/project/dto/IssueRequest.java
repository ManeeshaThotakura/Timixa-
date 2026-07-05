package com.timixa.backend.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/** Payload for creating an issue. The key is minted server-side from the project prefix. */
public record IssueRequest(
    /** Optional client-generated id for optimistic UI. */
    UUID id,
    @NotNull UUID projectId,
    @NotBlank @Size(max = 8) String type,
    UUID parentId,
    @NotBlank @Size(max = 255) String title,
    @Size(max = 4000) String description,
    @Size(max = 4000) String acceptanceCriteria,
    String status,
    String priority,
    UUID assigneeId,
    UUID reporterId,
    Integer storyPoints,
    Integer estimateHours,
    UUID sprintId,
    String startDate,
    String dueDate,
    @Size(max = 9) String color
) {}
