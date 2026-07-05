package com.timixa.backend.task;

import com.timixa.backend.security.UserPrincipal;
import com.timixa.backend.task.dto.PlannedTaskResponse;
import com.timixa.backend.task.dto.PlannedTaskSegmentRequest;
import com.timixa.backend.task.dto.PlannedTaskSegmentUpdateRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/planned-tasks/{id}/segments")
public class PlannedTaskSegmentController {

    private final PlannedTaskSegmentService segmentService;
    private final PlannedTaskService taskService;

    public PlannedTaskSegmentController(PlannedTaskSegmentService segmentService,
                                        PlannedTaskService taskService) {
        this.segmentService = segmentService;
        this.taskService = taskService;
    }

    @PostMapping
    public ResponseEntity<PlannedTaskResponse> add(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody PlannedTaskSegmentRequest req) {
        segmentService.createSegment(principal.id(), id, req);
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(taskService.findOneForDate(principal.id(), id, req.date()));
    }

    @PatchMapping("/{segmentId}")
    public PlannedTaskResponse update(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @PathVariable UUID segmentId,
            @Valid @RequestBody PlannedTaskSegmentUpdateRequest req) {
        com.timixa.backend.task.PlannedTaskSegment updated =
            segmentService.updateSegment(principal.id(), id, segmentId, req);
        return taskService.findOneForDate(principal.id(), id, updated.getSegmentDate());
    }

    @DeleteMapping("/{segmentId}")
    public ResponseEntity<PlannedTaskResponse> remove(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @PathVariable UUID segmentId) {
        segmentService.deleteSegment(principal.id(), id, segmentId);
        return ResponseEntity.ok(taskService.findOne(principal.id(), id));
    }
}
