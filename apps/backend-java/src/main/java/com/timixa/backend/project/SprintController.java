package com.timixa.backend.project;

import com.timixa.backend.project.dto.SprintResponse;
import com.timixa.backend.security.UserPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/sprints")
public class SprintController {

    private final ProjectService service;

    public SprintController(ProjectService service) { this.service = service; }

    @GetMapping
    public List<SprintResponse> list(@AuthenticationPrincipal UserPrincipal principal) {
        return service.sprintsForUser(principal.id());
    }
}
