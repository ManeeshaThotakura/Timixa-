package com.timixa.backend.project.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.timixa.backend.project.TeamMember;

import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TeamMemberResponse(
    UUID id, String name, String initials, String color, String avatarUrl
) {
    public static TeamMemberResponse from(TeamMember m) {
        return new TeamMemberResponse(m.getId(), m.getName(), m.getInitials(), m.getColor(), m.getAvatarUrl());
    }
}
