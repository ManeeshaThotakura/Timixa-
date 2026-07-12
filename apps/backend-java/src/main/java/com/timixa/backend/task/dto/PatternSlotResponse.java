package com.timixa.backend.task.dto;

import com.timixa.backend.task.PlannedTaskWeekSlot;

public record PatternSlotResponse(String startTime, String endTime) {
    public static PatternSlotResponse from(PlannedTaskWeekSlot s) {
        return new PatternSlotResponse(s.getStartTime(), s.getEndTime());
    }
}
