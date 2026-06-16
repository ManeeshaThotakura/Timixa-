package com.timixa.backend.task;

import com.timixa.backend.security.UserPrincipal;
import com.timixa.backend.task.dto.PlannedTaskExceptionRequest;
import com.timixa.backend.task.dto.PlannedTaskResponse;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/planned-tasks/{id}/exceptions")
public class PlannedTaskExceptionController {

    private final PlannedTaskExceptionService exService;
    private final PlannedTaskService taskService;

    public PlannedTaskExceptionController(PlannedTaskExceptionService exService,
                                          PlannedTaskService taskService) {
        this.exService = exService;
        this.taskService = taskService;
    }

    @PostMapping
    public ResponseEntity<PlannedTaskResponse> add(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody PlannedTaskExceptionRequest req) {
        exService.addException(principal.id(), id, req);
        PlannedTaskResponse out = taskService.findOne(principal.id(), id);
        return ResponseEntity.status(HttpStatus.CREATED).body(out);
    }

    @DeleteMapping("/{date}")
    public ResponseEntity<Void> remove(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        exService.removeException(principal.id(), id, date);
        return ResponseEntity.noContent().build();
    }
}
