package com.timixa.backend.project;

import com.timixa.backend.project.dto.NewTeamMemberRequest;
import com.timixa.backend.project.dto.TeamMemberResponse;
import com.timixa.backend.security.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/team")
public class TeamController {

    private final TeamService service;

    public TeamController(TeamService service) { this.service = service; }

    @GetMapping
    public List<TeamMemberResponse> list(@AuthenticationPrincipal UserPrincipal principal) {
        return service.team(principal.id()).stream().map(TeamMemberResponse::from).toList();
    }

    /** The member representing the signed-in user (used as the default comment author). */
    @GetMapping("/me")
    public TeamMemberResponse me(@AuthenticationPrincipal UserPrincipal principal) {
        return TeamMemberResponse.from(service.currentMember(principal.id()));
    }

    /** Add a person who does not have an account yet, so they can be assigned to projects/issues. */
    @PostMapping
    public ResponseEntity<TeamMemberResponse> create(@Valid @RequestBody NewTeamMemberRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(TeamMemberResponse.from(service.createMember(req)));
    }
}
