package com.timixa.backend.habit;

import com.timixa.backend.habit.dto.HabitRequest;
import com.timixa.backend.habit.dto.HabitResponse;
import com.timixa.backend.security.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/habits")
public class HabitController {

    private final HabitService service;

    public HabitController(HabitService service) { this.service = service; }

    @GetMapping
    public List<HabitResponse> list(@AuthenticationPrincipal UserPrincipal principal) {
        return service.findAll(principal.id());
    }

    @PostMapping
    public ResponseEntity<HabitResponse> create(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody HabitRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(service.create(principal.id(), req));
    }

    @PostMapping("/{id}/increment")
    public HabitResponse increment(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id) {
        return service.increment(principal.id(), id);
    }
}
