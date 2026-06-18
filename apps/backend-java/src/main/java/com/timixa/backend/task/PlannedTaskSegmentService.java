package com.timixa.backend.task;

import com.timixa.backend.common.SegmentNotFoundException;
import com.timixa.backend.common.SegmentOverlapException;
import com.timixa.backend.task.dto.PlannedTaskSegmentRequest;
import com.timixa.backend.task.dto.PlannedTaskSegmentUpdateRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class PlannedTaskSegmentService {

    private final PlannedTaskSegmentRepository segments;
    private final PlannedTaskService taskService;

    public PlannedTaskSegmentService(PlannedTaskSegmentRepository segments,
                                     PlannedTaskService taskService) {
        this.segments = segments;
        this.taskService = taskService;
    }

    @Transactional
    public PlannedTaskSegment createSegment(UUID userId, UUID taskId, PlannedTaskSegmentRequest req) {
        taskService.requireOwnedTask(userId, taskId);
        validateTimes(req.startTime(), req.endTime());
        List<PlannedTaskSegment> sameDay = segments.findByTaskIdAndSegmentDate(taskId, req.date());
        if (overlapsAny(req.startTime(), req.endTime(), sameDay, null))
            throw new SegmentOverlapException();
        return segments.save(new PlannedTaskSegment(taskId, req.date(), req.startTime(), req.endTime()));
    }

    @Transactional
    public PlannedTaskSegment updateSegment(UUID userId, UUID taskId, UUID segmentId,
                                            PlannedTaskSegmentUpdateRequest req) {
        taskService.requireOwnedTask(userId, taskId);
        PlannedTaskSegment seg = segments.findById(segmentId).orElseThrow(SegmentNotFoundException::new);
        if (!seg.getTaskId().equals(taskId)) throw new SegmentNotFoundException();

        String newStart = req.startTime() != null ? req.startTime() : seg.getStartTime();
        String newEnd   = req.endTime()   != null ? req.endTime()   : seg.getEndTime();
        validateTimes(newStart, newEnd);

        List<PlannedTaskSegment> sameDay = segments.findByTaskIdAndSegmentDate(taskId, seg.getSegmentDate());
        if (overlapsAny(newStart, newEnd, sameDay, segmentId))
            throw new SegmentOverlapException();

        seg.setStartTime(newStart);
        seg.setEndTime(newEnd);
        return segments.save(seg);
    }

    @Transactional
    public void deleteSegment(UUID userId, UUID taskId, UUID segmentId) {
        taskService.requireOwnedTask(userId, taskId);
        PlannedTaskSegment seg = segments.findById(segmentId).orElseThrow(SegmentNotFoundException::new);
        if (!seg.getTaskId().equals(taskId)) throw new SegmentNotFoundException();
        segments.delete(seg);
    }

    private static void validateTimes(String startTime, String endTime) {
        if (startTime == null || endTime == null)
            throw new IllegalArgumentException("startTime and endTime are required");
        if (endTime.compareTo(startTime) <= 0)
            throw new IllegalArgumentException("endTime must be after startTime");
    }

    private static boolean overlapsAny(String start, String end, List<PlannedTaskSegment> existing, UUID excludeId) {
        for (PlannedTaskSegment s : existing) {
            if (excludeId != null && s.getId().equals(excludeId)) continue;
            // overlap iff start < s.end AND end > s.start
            if (start.compareTo(s.getEndTime()) < 0 && end.compareTo(s.getStartTime()) > 0)
                return true;
        }
        return false;
    }
}
