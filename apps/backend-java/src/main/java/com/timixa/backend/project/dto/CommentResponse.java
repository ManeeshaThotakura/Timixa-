package com.timixa.backend.project.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.timixa.backend.project.IssueComment;
import com.timixa.backend.project.TeamMember;

import java.time.Instant;
import java.util.UUID;

/** Mirrors the Angular {@code Comment} model with denormalized author fields. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CommentResponse(
    UUID id,
    UUID issueId,
    UUID authorId,
    String authorName,
    String authorInitials,
    String authorColor,
    String authorAvatarUrl,
    String text,
    Instant createdAt
) {
    public static CommentResponse from(IssueComment c, TeamMember author) {
        return new CommentResponse(
            c.getId(), c.getIssueId(), c.getAuthorId(),
            author != null ? author.getName() : "Unknown",
            author != null ? author.getInitials() : "?",
            author != null ? author.getColor() : "#4b4f52",
            author != null ? author.getAvatarUrl() : null,
            c.getText(), c.getCreatedAt());
    }
}
