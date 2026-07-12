package com.timixa.backend.project.dto;

import jakarta.validation.constraints.NotBlank;

/** Board drag/drop: move an issue to a new status, optionally recording a resolution. */
public record IssueStatusRequest(
    @NotBlank String status,
    String resolution
) {}
