package com.timixa.backend.project;

import com.timixa.backend.common.ResourceNotFoundException;
import com.timixa.backend.project.dto.ProjectRequest;
import com.timixa.backend.project.dto.ProjectResponse;
import com.timixa.backend.project.dto.ProjectUpdateRequest;
import com.timixa.backend.project.dto.SprintResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class ProjectService {

    /** Issue types that count toward a project's progress bar. */
    private static final Set<String> BOARD_TYPES = Set.of("story", "task", "bug");

    private final ProjectRepository projects;
    private final IssueRepository issues;
    private final SprintRepository sprints;
    private final IssueCommentRepository comments;
    private final TeamService team;

    public ProjectService(ProjectRepository projects, IssueRepository issues,
                          SprintRepository sprints, IssueCommentRepository comments,
                          TeamService team) {
        this.projects = projects;
        this.issues = issues;
        this.sprints = sprints;
        this.comments = comments;
        this.team = team;
    }

    @Transactional(readOnly = true)
    public List<ProjectResponse> list(UUID userId) {
        List<Project> owned = projects.findByUserIdOrderByCreatedAtAsc(userId);
        if (owned.isEmpty()) return List.of();
        Map<UUID, Integer> progress = progressByProject(owned);
        Map<UUID, TeamMember> membersById = team.byId();
        return owned.stream()
            .map(p -> toResponse(p, progress.getOrDefault(p.getId(), 0), membersById))
            .toList();
    }

    @Transactional(readOnly = true)
    public ProjectResponse getOne(UUID userId, UUID id) {
        Project p = require(userId, id);
        int progress = progressByProject(List.of(p)).getOrDefault(p.getId(), 0);
        return toResponse(p, progress, team.byId());
    }

    @Transactional
    public ProjectResponse create(UUID userId, ProjectRequest req) {
        Project p = new Project();
        if (req.id() != null) p.setId(req.id());
        p.setUserId(userId);
        p.setTitle(req.title().trim());
        p.setDescription(req.description() == null ? "" : req.description().trim());
        p.setWorkspaceId(req.workspaceId());
        p.setKeyPrefix(resolveKeyPrefix(req.keyPrefix(), req.title()));
        if (req.priority() != null) p.setPriority(req.priority());
        p.setStartDate(req.startDate());
        p.setDueDate(req.dueDate());
        if (req.tags() != null) p.setTags(req.tags());
        if (req.memberIds() != null) p.setMemberIds(req.memberIds());
        if (req.color() != null) p.setColor(req.color());
        p.setIcon(req.icon());
        Project saved = projects.save(p);
        return toResponse(saved, 0, team.byId());
    }

    @Transactional
    public ProjectResponse update(UUID userId, UUID id, ProjectUpdateRequest req) {
        Project p = require(userId, id);
        if (req.title() != null) p.setTitle(req.title().trim());
        if (req.description() != null) p.setDescription(req.description());
        if (req.workspaceId() != null) p.setWorkspaceId(req.workspaceId());
        if (req.keyPrefix() != null) p.setKeyPrefix(req.keyPrefix().trim().toUpperCase());
        if (req.priority() != null) p.setPriority(req.priority());
        if (req.status() != null) p.setStatus(req.status());
        if (req.startDate() != null) p.setStartDate(req.startDate());
        if (req.dueDate() != null) p.setDueDate(req.dueDate());
        if (req.tags() != null) p.setTags(req.tags());
        if (req.memberIds() != null) p.setMemberIds(req.memberIds());
        if (req.color() != null) p.setColor(req.color());
        if (req.icon() != null) p.setIcon(req.icon());
        Project saved = projects.save(p);
        int progress = progressByProject(List.of(saved)).getOrDefault(saved.getId(), 0);
        return toResponse(saved, progress, team.byId());
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        Project p = require(userId, id);
        // Explicit child cleanup so it works regardless of DB-level FK cascade config.
        List<Issue> projectIssues = issues.findByProjectId(id);
        if (!projectIssues.isEmpty()) {
            List<UUID> issueIds = projectIssues.stream().map(Issue::getId).toList();
            comments.deleteAllInBatch(comments.findByIssueIdInOrderByCreatedAtAsc(issueIds));
            issues.deleteAllInBatch(projectIssues);
        }
        sprints.deleteAllInBatch(sprints.findByProjectId(id));
        projects.delete(p);
    }

    @Transactional(readOnly = true)
    public List<SprintResponse> sprintsForUser(UUID userId) {
        List<UUID> projectIds = ownedProjectIds(userId);
        if (projectIds.isEmpty()) return List.of();
        return sprints.findByProjectIdInOrderByCreatedAtAsc(projectIds).stream()
            .map(SprintResponse::from).toList();
    }

    // ── helpers ──────────────────────────────────────────────────────────

    List<UUID> ownedProjectIds(UUID userId) {
        return projects.findByUserIdOrderByCreatedAtAsc(userId).stream()
            .map(Project::getId).toList();
    }

    Project require(UUID userId, UUID id) {
        return projects.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
    }

    private Map<UUID, Integer> progressByProject(List<Project> owned) {
        List<UUID> ids = owned.stream().map(Project::getId).toList();
        Map<UUID, int[]> counts = new HashMap<>(); // [done, total]
        for (Issue i : issues.findByProjectIdInOrderByCreatedAtAsc(ids)) {
            if (!BOARD_TYPES.contains(i.getType())) continue;
            int[] c = counts.computeIfAbsent(i.getProjectId(), k -> new int[2]);
            c[1]++;
            if ("done".equals(i.getStatus())) c[0]++;
        }
        Map<UUID, Integer> progress = new HashMap<>();
        for (Project p : owned) {
            int[] c = counts.get(p.getId());
            progress.put(p.getId(), (c == null || c[1] == 0) ? 0 : Math.round(c[0] * 100f / c[1]));
        }
        return progress;
    }

    private ProjectResponse toResponse(Project p, int progress, Map<UUID, TeamMember> membersById) {
        List<String> initials = p.getMemberIds().stream()
            .map(this::parseUuid)
            .filter(Objects::nonNull)
            .map(membersById::get)
            .filter(Objects::nonNull)
            .map(TeamMember::getInitials)
            .collect(Collectors.toList());
        List<String> visible = initials.stream().limit(3).toList();
        int more = Math.max(0, initials.size() - visible.size());
        return ProjectResponse.from(p, progress, visible, more);
    }

    private UUID parseUuid(String s) {
        try { return UUID.fromString(s); } catch (Exception e) { return null; }
    }

    private String resolveKeyPrefix(String explicit, String title) {
        if (explicit != null && !explicit.isBlank()) {
            return explicit.trim().toUpperCase().substring(0, Math.min(4, explicit.trim().length()));
        }
        String letters = Arrays.stream(title.trim().split("\\s+"))
            .filter(w -> !w.isEmpty())
            .map(w -> String.valueOf(Character.toUpperCase(w.charAt(0))))
            .collect(Collectors.joining());
        if (letters.isBlank()) {
            letters = title.trim().toUpperCase();
        }
        letters = letters.replaceAll("[^A-Z0-9]", "");
        if (letters.isBlank()) letters = "IS";
        return letters.substring(0, Math.min(4, letters.length()));
    }
}
