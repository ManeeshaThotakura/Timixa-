package com.timixa.backend.project.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.timixa.backend.project.Project;

import java.util.List;
import java.util.UUID;

/** Mirrors the Angular {@code Project} model. {@code members} are the initials of the
 *  first few assigned members; {@code moreMembers} is the "+N" overflow count. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProjectResponse(
    UUID id,
    String title,
    String description,
    String workspaceId,
    String keyPrefix,
    String priority,
    String status,
    int progress,
    String startDate,
    String dueDate,
    List<String> tags,
    String color,
    String icon,
    List<String> members,
    int moreMembers,
    List<String> memberIds
) {
    public static ProjectResponse from(Project p, int progress, List<String> memberInitials, int moreMembers) {
        return new ProjectResponse(
            p.getId(), p.getTitle(), p.getDescription(), p.getWorkspaceId(), p.getKeyPrefix(),
            p.getPriority(), p.getStatus(), progress, p.getStartDate(), p.getDueDate(),
            p.getTags(), p.getColor(), p.getIcon(),
            memberInitials, moreMembers, p.getMemberIds()
        );
    }
}
