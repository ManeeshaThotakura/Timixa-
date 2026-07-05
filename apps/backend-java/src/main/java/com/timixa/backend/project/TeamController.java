package com.timixa.backend.project;

import com.timixa.backend.project.dto.TeamMemberResponse;
import com.timixa.backend.security.UserPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}
