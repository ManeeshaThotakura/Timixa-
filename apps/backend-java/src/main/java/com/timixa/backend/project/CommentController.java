package com.timixa.backend.project;

import com.timixa.backend.project.dto.CommentRequest;
import com.timixa.backend.project.dto.CommentResponse;
import com.timixa.backend.security.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/comments")
public class CommentController {

    private final IssueService service;

    public CommentController(IssueService service) { this.service = service; }

    /** All comments across the caller's issues, for bulk hydration on load. */
    @GetMapping
    public List<CommentResponse> list(@AuthenticationPrincipal UserPrincipal principal) {
        return service.commentsForUser(principal.id());
    }

    @PatchMapping("/{id}")
    public CommentResponse update(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody CommentRequest req) {
        return service.updateComment(principal.id(), id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UserPrincipal principal, @PathVariable UUID id) {
        service.deleteComment(principal.id(), id);
        return ResponseEntity.noContent().build();
    }
}
