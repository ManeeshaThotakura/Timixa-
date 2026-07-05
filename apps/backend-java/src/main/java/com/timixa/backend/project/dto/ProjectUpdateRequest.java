package com.timixa.backend.project.dto;

import jakarta.validation.constraints.Size;

import java.util.List;

/** Partial update for a project; every field is optional. */
public record ProjectUpdateRequest(
    @Size(max = 120) String title,
    @Size(max = 2000) String description,
    @Size(max = 64) String workspaceId,
    @Size(max = 4) String keyPrefix,
    String priority,
    String status,
    String startDate,
    String dueDate,
    List<String> tags,
    @Size(max = 9) String color,
    @Size(max = 48) String icon,
    List<String> memberIds
) {}
