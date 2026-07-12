package com.timixa.backend.task;

import com.timixa.backend.security.UserPrincipal;
import com.timixa.backend.task.dto.PlannedTaskResponse;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/planned-tasks/{id}/week-pattern")
public class PlannedTaskWeekPatternController {

    public record PatternSlotRequest(
        @NotBlank @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "must be HH:mm") String startTime,
        @NotBlank @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "must be HH:mm") String endTime
    ) {}

    private final PlannedTaskWeekSlotRepository weekSlots;
    private final PlannedTaskService taskService;

    @PersistenceContext
    private EntityManager em;

    public PlannedTaskWeekPatternController(PlannedTaskWeekSlotRepository weekSlots,
                                            PlannedTaskService taskService) {
        this.weekSlots = weekSlots;
        this.taskService = taskService;
    }

    /** Replaces the recurring slots for one weekday. An empty list clears the pattern. */
    @PutMapping("/{weekday}")
    @Transactional
    public PlannedTaskResponse replace(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @PathVariable DayOfWeek weekday,
            @RequestBody List<@Valid PatternSlotRequest> slots,
            @RequestParam(value = "date", required = false) LocalDate date) {
        PlannedTask t = taskService.requireOwnedTask(principal.id(), id);
        validate(slots);
        weekSlots.deleteByTaskIdAndWeekday(t.getId(), weekday);
        em.flush();  // force DELETE before INSERTs so unique constraint can't fire
        for (PatternSlotRequest s : slots) {
            weekSlots.save(new PlannedTaskWeekSlot(t.getId(), weekday, s.startTime(), s.endTime()));
        }
        return taskService.findOneForDate(principal.id(), id, date == null ? LocalDate.now() : date);
    }

    private static void validate(List<PatternSlotRequest> slots) {
        List<PatternSlotRequest> sorted = slots.stream()
            .sorted(Comparator.comparing(PatternSlotRequest::startTime)).toList();
        String prevEnd = null;
        for (PatternSlotRequest s : sorted) {
            if (s.endTime().compareTo(s.startTime()) <= 0)
                throw new IllegalArgumentException("endTime must be after startTime");
            if (prevEnd != null && s.startTime().compareTo(prevEnd) < 0)
                throw new IllegalArgumentException("pattern slots must not overlap");
            prevEnd = s.endTime();
        }
    }
}
