package com.timixa.backend.task.dto;

import com.timixa.backend.task.PlannedTaskSegment;

import java.time.LocalDate;
import java.util.UUID;

public record PlannedTaskSegmentResponse(
    UUID id,
    LocalDate date,
    String startTime,
    String endTime
) {
    public static PlannedTaskSegmentResponse from(PlannedTaskSegment s) {
        return new PlannedTaskSegmentResponse(s.getId(), s.getSegmentDate(), s.getStartTime(), s.getEndTime());
    }
}
