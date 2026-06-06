package com.timixa.backend.test;

import com.timixa.backend.task.PlannedTaskCompletionRepository;
import com.timixa.backend.task.PlannedTaskRepository;
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

    public TestResetController(UserRepository users,
                               PlannedTaskRepository tasks,
                               PlannedTaskCompletionRepository completions) {
        this.users = users;
        this.tasks = tasks;
        this.completions = completions;
    }

    @PostMapping("/reset")
    public ResponseEntity<Void> reset() {
        completions.deleteAll();
        tasks.deleteAll();
        users.deleteAll();
        return ResponseEntity.noContent().build();
    }
}
