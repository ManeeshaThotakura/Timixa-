package com.timixa.backend.project;

import com.timixa.backend.common.ResourceNotFoundException;
import com.timixa.backend.project.dto.NewTeamMemberRequest;
import com.timixa.backend.user.User;
import com.timixa.backend.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The assignable-member directory. Seeded members ({@code userId == null}) coexist with
 * one auto-provisioned member per real account, so the signed-in user is always
 * assignable and can author comments.
 */
@Service
public class TeamService {

    /** Deterministic avatar palette for auto-provisioned members. */
    private static final String[] PALETTE = {
        "#451de3", "#006688", "#15803d", "#b45309", "#be123c", "#7c3aed", "#0891b2"
    };

    private final TeamMemberRepository members;
    private final UserRepository users;

    public TeamService(TeamMemberRepository members, UserRepository users) {
        this.members = members;
        this.users = users;
    }

    /** The member representing the signed-in user, creating it on first use. */
    @Transactional
    public TeamMember currentMember(UUID userId) {
        return members.findByUserId(userId).orElseGet(() -> provision(userId));
    }

    /** Full directory, ensuring the caller has a member row. */
    @Transactional
    public List<TeamMember> team(UUID userId) {
        currentMember(userId);
        return members.findAllByOrderByNameAsc();
    }

    /** Adds a person who has no account yet (a directory member with userId == null). */
    @Transactional
    public TeamMember createMember(NewTeamMemberRequest req) {
        TeamMember m = new TeamMember();
        if (req.id() != null) m.setId(req.id());
        m.setName(req.name().trim());
        m.setInitials(initialsOf(req.name()));
        m.setColor(req.color() != null && !req.color().isBlank()
            ? req.color()
            : PALETTE[Math.floorMod(m.getName().hashCode(), PALETTE.length)]);
        m.setAvatarUrl(req.avatarUrl());
        return members.save(m);
    }

    /** All members keyed by id, for batch resolution of assignees/authors. */
    @Transactional(readOnly = true)
    public Map<UUID, TeamMember> byId() {
        return members.findAll().stream()
            .collect(Collectors.toMap(TeamMember::getId, Function.identity()));
    }

    private TeamMember provision(UUID userId) {
        User u = users.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        TeamMember m = new TeamMember();
        m.setUserId(userId);
        m.setName(u.getName());
        m.setInitials(initialsOf(u.getName()));
        m.setColor(PALETTE[Math.floorMod(userId.hashCode(), PALETTE.length)]);
        return members.save(m);
    }

    static String initialsOf(String name) {
        if (name == null || name.isBlank()) return "?";
        String[] parts = name.trim().split("\\s+");
        String initials = parts.length >= 2
            ? ("" + parts[0].charAt(0) + parts[1].charAt(0))
            : name.trim().substring(0, Math.min(2, name.trim().length()));
        return initials.toUpperCase();
    }
}
