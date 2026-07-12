package com.timixa.backend.project;

import com.timixa.backend.project.dto.ProjectRequest;
import com.timixa.backend.project.dto.ProjectResponse;
import com.timixa.backend.project.dto.ProjectUpdateRequest;
import com.timixa.backend.security.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService service;

    public ProjectController(ProjectService service) { this.service = service; }

    @GetMapping
    public List<ProjectResponse> list(@AuthenticationPrincipal UserPrincipal principal) {
        return service.list(principal.id());
    }

    @GetMapping("/{id}")
    public ProjectResponse getOne(@AuthenticationPrincipal UserPrincipal principal, @PathVariable UUID id) {
        return service.getOne(principal.id(), id);
    }

    @PostMapping
    public ResponseEntity<ProjectResponse> create(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ProjectRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(principal.id(), req));
    }

    @PatchMapping("/{id}")
    public ProjectResponse update(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody ProjectUpdateRequest req) {
        return service.update(principal.id(), id, req);
    }

    @PutMapping("/{id}")
    public ProjectResponse replace(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody ProjectUpdateRequest req) {
        return service.update(principal.id(), id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UserPrincipal principal, @PathVariable UUID id) {
        service.delete(principal.id(), id);
        return ResponseEntity.noContent().build();
    }
}
