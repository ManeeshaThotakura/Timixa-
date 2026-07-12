package com.timixa.backend.test;

import com.timixa.backend.task.PlannedTaskCompletionRepository;
import com.timixa.backend.task.PlannedTaskExceptionRepository;
import com.timixa.backend.task.PlannedTaskRepository;
import com.timixa.backend.task.PlannedTaskSegmentRepository;
import com.timixa.backend.task.PlannedTaskWeekSlotRepository;
import com.timixa.backend.user.UserRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/test")
@Profile("dev")
public class TestResetController {

    private final UserRepository users;
    private final PlannedTaskRepository tasks;
    private final PlannedTaskCompletionRepository completions;
    private final PlannedTaskExceptionRepository exceptions;
    private final PlannedTaskSegmentRepository segments;
    private final PlannedTaskWeekSlotRepository weekSlots;

    public TestResetController(UserRepository users,
                               PlannedTaskRepository tasks,
                               PlannedTaskCompletionRepository completions,
                               PlannedTaskExceptionRepository exceptions,
                               PlannedTaskSegmentRepository segments,
                               PlannedTaskWeekSlotRepository weekSlots) {
        this.users = users;
        this.tasks = tasks;
        this.completions = completions;
        this.exceptions = exceptions;
        this.segments = segments;
        this.weekSlots = weekSlots;
    }

    @PostMapping("/reset")
    public ResponseEntity<Void> reset() {
        weekSlots.deleteAll();
        segments.deleteAll();
        exceptions.deleteAll();
        completions.deleteAll();
        tasks.deleteAll();
        users.deleteAll();
        return ResponseEntity.noContent().build();
    }
}
