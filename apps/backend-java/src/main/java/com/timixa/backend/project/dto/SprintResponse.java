package com.timixa.backend.project.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.timixa.backend.project.Sprint;

import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SprintResponse(
    UUID id, UUID projectId, String name, String goal, String status, String startDate, String endDate
) {
    public static SprintResponse from(Sprint s) {
        return new SprintResponse(
            s.getId(), s.getProjectId(), s.getName(), s.getGoal(), s.getStatus(),
            s.getStartDate(), s.getEndDate());
    }
}
