package com.timixa.backend.reminder;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.timixa.backend.common.ReminderNotFoundException;
import com.timixa.backend.security.UserPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/reminders")
public class ReminderController {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ReminderResponse(
        UUID id, String title, String description, String time, String type,
        String relatedHabitId, String relatedTaskId, Instant fireAt,
        boolean sent, boolean dismissed, String icon, String iconColor
    ) {
        static ReminderResponse from(Reminder r) {
            return new ReminderResponse(
                r.getId(), r.getTitle(), r.getDescription(), r.getTime(), r.getType(),
                r.getRelatedHabitId(), r.getRelatedTaskId(), r.getFireAt(),
                r.isSent(), r.isDismissed(), r.getIcon(), r.getIconColor());
        }
    }

    public record ReminderRequest(
        @NotBlank @Size(max = 160) String title,
        @Size(max = 500) String description,
        @Size(max = 40) String time,
        @Size(max = 16) String type,
        @Size(max = 80) String relatedHabitId,
        @Size(max = 80) String relatedTaskId,
        Instant fireAt,
        @Size(max = 60) String icon,
        @Size(max = 9) String iconColor
    ) {}

    private final ReminderRepository reminders;

    public ReminderController(ReminderRepository reminders) {
        this.reminders = reminders;
    }

    @GetMapping
    public List<ReminderResponse> list(@AuthenticationPrincipal UserPrincipal principal) {
        return reminders.findByUserIdOrderByCreatedAtDesc(principal.id()).stream()
            .map(ReminderResponse::from).toList();
    }

    @PostMapping
    public ResponseEntity<ReminderResponse> create(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ReminderRequest req) {
        Reminder r = new Reminder();
        r.setUserId(principal.id());
        r.setTitle(req.title());
        if (req.description() != null) r.setDescription(req.description());
        if (req.time() != null) r.setTime(req.time());
        if (req.type() != null) r.setType(req.type());
        r.setRelatedHabitId(req.relatedHabitId());
        r.setRelatedTaskId(req.relatedTaskId());
        r.setFireAt(req.fireAt());
        if (req.icon() != null) r.setIcon(req.icon());
        if (req.iconColor() != null) r.setIconColor(req.iconColor());
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ReminderResponse.from(reminders.save(r)));
    }

    @PatchMapping("/{id}/dismiss")
    public ReminderResponse dismiss(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id) {
        Reminder r = requireOwned(principal.id(), id);
        r.setDismissed(true);
        return ReminderResponse.from(reminders.save(r));
    }

    @PatchMapping("/{id}/snooze")
    public ReminderResponse snooze(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @RequestBody(required = false) Map<String, Object> body) {
        int minutes = 30;
        if (body != null && body.get("minutes") instanceof Number n) {
            minutes = Math.max(1, n.intValue());
        }
        Reminder r = requireOwned(principal.id(), id);
        r.setTime("In " + minutes + " min");
        r.setFireAt(Instant.now().plusSeconds(minutes * 60L));
        r.setSent(false);
        return ReminderResponse.from(reminders.save(r));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id) {
        Reminder r = requireOwned(principal.id(), id);
        reminders.delete(r);
        return ResponseEntity.noContent().build();
    }

    private Reminder requireOwned(UUID userId, UUID id) {
        Reminder r = reminders.findById(id).orElseThrow(ReminderNotFoundException::new);
        if (!r.getUserId().equals(userId)) throw new ReminderNotFoundException();
        return r;
    }
}
