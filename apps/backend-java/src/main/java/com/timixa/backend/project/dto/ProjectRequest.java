package com.timixa.backend.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/** Payload for creating a project (matches the "New Project" form). */
public record ProjectRequest(
    /** Optional client-generated id, so the UI can navigate to the new project immediately. */
    UUID id,
    @NotBlank @Size(max = 120) String title,
    @Size(max = 2000) String description,
    @Size(max = 64) String workspaceId,
    @Size(max = 4) String keyPrefix,
    String priority,
    String startDate,
    String dueDate,
    List<String> tags,
    @Size(max = 9) String color,
    @Size(max = 48) String icon,
    /** Ids of assigned team members. */
    List<String> memberIds
) {}
