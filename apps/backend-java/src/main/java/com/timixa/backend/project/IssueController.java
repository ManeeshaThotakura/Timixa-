package com.timixa.backend.project;

import com.timixa.backend.project.dto.*;
import com.timixa.backend.security.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/issues")
public class IssueController {

    private final IssueService service;

    public IssueController(IssueService service) { this.service = service; }

    @GetMapping
    public List<IssueResponse> list(@AuthenticationPrincipal UserPrincipal principal) {
        return service.listForUser(principal.id());
    }

    @PostMapping
    public ResponseEntity<IssueResponse> create(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody IssueRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(principal.id(), req));
    }

    @PatchMapping("/{id}")
    public IssueResponse update(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody IssueUpdateRequest req) {
        return service.update(principal.id(), id, req);
    }

    @PatchMapping("/{id}/status")
    public IssueResponse updateStatus(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody IssueStatusRequest req) {
        return service.updateStatus(principal.id(), id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UserPrincipal principal, @PathVariable UUID id) {
        service.delete(principal.id(), id);
        return ResponseEntity.noContent().build();
    }

    // ── Comments on an issue ─────────────────────────────────────────────

    @PostMapping("/{id}/comments")
    public ResponseEntity<CommentResponse> addComment(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody CommentRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addComment(principal.id(), id, req));
    }
}
