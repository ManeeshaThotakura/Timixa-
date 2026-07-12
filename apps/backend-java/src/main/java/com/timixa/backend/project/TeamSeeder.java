package com.timixa.backend.project;

import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.ApplicationArguments;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Seeds the shared directory members (the former MOCK_TEAM) once, so a fresh
 * database has assignable people before any real account signs in. Kept in Java
 * rather than SQL so it runs identically on H2 (dev) and CockroachDB (prod).
 */
@Component
public class TeamSeeder implements ApplicationRunner {

    private record Seed(String name, String initials, String color, String avatarUrl) {}

    private static final List<Seed> DIRECTORY = List.of(
        new Seed("Chandra Teja", "CT", "#451de3", "assets/avatars/chandra-teja.jpeg"),
        new Seed("Eswar Aditya", "EA", "#006688", null),
        new Seed("Maneesha",     "MA", "#15803d", null)
    );

    private final TeamMemberRepository members;

    public TeamSeeder(TeamMemberRepository members) { this.members = members; }

    @Override
    public void run(ApplicationArguments args) {
        if (members.countByUserIdIsNull() > 0) return; // already seeded
        for (Seed s : DIRECTORY) {
            TeamMember m = new TeamMember();
            m.setName(s.name());
            m.setInitials(s.initials());
            m.setColor(s.color());
            m.setAvatarUrl(s.avatarUrl());
            members.save(m);
        }
    }
}
