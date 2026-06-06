package com.timixa.backend.task;

import com.timixa.backend.security.UserPrincipal;
import com.timixa.backend.task.dto.PlannedTaskRequest;
import com.timixa.backend.task.dto.PlannedTaskResponse;
import com.timixa.backend.task.dto.PlannedTaskUpdateRequest;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/planned-tasks")
public class PlannedTaskController {

    private final PlannedTaskService service;

    public PlannedTaskController(PlannedTaskService service) { this.service = service; }

    @GetMapping
    public List<PlannedTaskResponse> list(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(value = "date", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return date == null
            ? service.findAll(principal.id())
            : service.findForDate(principal.id(), date);
    }

    @PostMapping
    public ResponseEntity<PlannedTaskResponse> create(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody PlannedTaskRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(service.create(principal.id(), req));
    }

    @PatchMapping("/{id}")
    public PlannedTaskResponse update(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody PlannedTaskUpdateRequest req) {
        return service.update(principal.id(), id, req);
    }

    @PostMapping("/{id}/completions")
    public ResponseEntity<PlannedTaskResponse> complete(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @RequestBody(required = false) Map<String, String> body) {
        LocalDate date = (body != null && body.get("date") != null)
            ? LocalDate.parse(body.get("date"))
            : LocalDate.now();
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(service.complete(principal.id(), id, date));
    }

    @DeleteMapping("/{id}/completions/{date}")
    public ResponseEntity<Void> uncomplete(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        service.uncomplete(principal.id(), id, date);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id) {
        service.delete(principal.id(), id);
        return ResponseEntity.noContent().build();
    }
}
