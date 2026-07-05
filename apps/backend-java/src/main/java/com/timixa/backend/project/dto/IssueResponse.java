package com.timixa.backend.project.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.timixa.backend.project.Issue;

import java.time.Instant;
import java.util.UUID;

/** Mirrors the Angular {@code Issue} model (epic / story / task / bug / subtask). */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record IssueResponse(
    UUID id,
    UUID projectId,
    String key,
    String type,
    UUID parentId,
    String title,
    String description,
    String acceptanceCriteria,
    String status,
    String priority,
    UUID assigneeId,
    UUID reporterId,
    Integer storyPoints,
    Integer estimateHours,
    UUID sprintId,
    String startDate,
    String dueDate,
    String resolution,
    String color,
    Instant createdAt,
    Instant updatedAt
) {
    public static IssueResponse from(Issue i) {
        return new IssueResponse(
            i.getId(), i.getProjectId(), i.getKey(), i.getType(), i.getParentId(),
            i.getTitle(), i.getDescription(), i.getAcceptanceCriteria(),
            i.getStatus(), i.getPriority(), i.getAssigneeId(), i.getReporterId(),
            i.getStoryPoints(), i.getEstimateHours(), i.getSprintId(),
            i.getStartDate(), i.getDueDate(), i.getResolution(), i.getColor(),
            i.getCreatedAt(), i.getUpdatedAt());
    }
}
