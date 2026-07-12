package com.timixa.backend.project;

import com.timixa.backend.common.ResourceNotFoundException;
import com.timixa.backend.project.dto.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class IssueService {

    private final ProjectRepository projects;
    private final IssueRepository issues;
    private final IssueCommentRepository comments;
    private final TeamService team;

    public IssueService(ProjectRepository projects, IssueRepository issues,
                        IssueCommentRepository comments, TeamService team) {
        this.projects = projects;
        this.issues = issues;
        this.comments = comments;
        this.team = team;
    }

    // ── Issues ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<IssueResponse> listForUser(UUID userId) {
        List<UUID> projectIds = ownedProjectIds(userId);
        if (projectIds.isEmpty()) return List.of();
        return issues.findByProjectIdInOrderByCreatedAtAsc(projectIds).stream()
            .map(IssueResponse::from).toList();
    }

    @Transactional
    public IssueResponse create(UUID userId, IssueRequest req) {
        Project project = projects.findByIdAndUserId(req.projectId(), userId)
            .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        Issue i = new Issue();
        if (req.id() != null) i.setId(req.id());
        i.setProjectId(project.getId());
        i.setType(req.type());
        i.setNumber(project.nextIssueSeq());
        i.setKey(project.getKeyPrefix() + "-" + i.getNumber());
        i.setParentId(req.parentId());
        i.setTitle(req.title().trim());
        i.setDescription(req.description() == null ? "" : req.description().trim());
        i.setAcceptanceCriteria(req.acceptanceCriteria());
        i.setStatus(req.status() == null ? "backlog" : req.status());
        if (req.priority() != null) i.setPriority(req.priority());
        i.setAssigneeId(req.assigneeId());
        i.setReporterId(req.reporterId() != null ? req.reporterId() : team.currentMember(userId).getId());
        i.setStoryPoints(req.storyPoints());
        i.setEstimateHours(req.estimateHours());
        i.setSprintId(req.sprintId());
        i.setStartDate(req.startDate() != null ? req.startDate() : project.getStartDate());
        i.setDueDate(req.dueDate() != null ? req.dueDate() : project.getDueDate());
        i.setColor(req.color());

        Issue saved = issues.save(i);
        projects.save(project); // persist the bumped issue counter
        return IssueResponse.from(saved);
    }

    @Transactional
    public IssueResponse update(UUID userId, UUID id, IssueUpdateRequest req) {
        Issue i = require(userId, id);
        if (req.title() != null) i.setTitle(req.title().trim());
        if (req.description() != null) i.setDescription(req.description());
        if (req.acceptanceCriteria() != null) i.setAcceptanceCriteria(req.acceptanceCriteria());
        if (req.status() != null) i.setStatus(req.status());
        if (req.priority() != null) i.setPriority(req.priority());
        if (req.assigneeId() != null) i.setAssigneeId(req.assigneeId());
        if (req.reporterId() != null) i.setReporterId(req.reporterId());
        if (req.storyPoints() != null) i.setStoryPoints(req.storyPoints());
        if (req.estimateHours() != null) i.setEstimateHours(req.estimateHours());
        if (req.sprintId() != null) i.setSprintId(req.sprintId());
        if (req.parentId() != null) i.setParentId(req.parentId());
        if (req.startDate() != null) i.setStartDate(req.startDate());
        if (req.dueDate() != null) i.setDueDate(req.dueDate());
        if (req.resolution() != null) i.setResolution(req.resolution());
        if (req.color() != null) i.setColor(req.color());
        return IssueResponse.from(issues.save(i));
    }

    @Transactional
    public IssueResponse updateStatus(UUID userId, UUID id, IssueStatusRequest req) {
        Issue i = require(userId, id);
        i.setStatus(req.status());
        i.setResolution("done".equals(req.status()) ? req.resolution() : null);
        return IssueResponse.from(issues.save(i));
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        Issue i = require(userId, id);
        // Gather the issue and all descendants (subtasks, and stories under an epic).
        Map<UUID, List<Issue>> byParent = new HashMap<>();
        for (Issue other : issues.findByProjectId(i.getProjectId())) {
            byParent.computeIfAbsent(other.getParentId(), k -> new ArrayList<>()).add(other);
        }
        List<Issue> toDelete = new ArrayList<>();
        Deque<Issue> stack = new ArrayDeque<>(List.of(i));
        while (!stack.isEmpty()) {
            Issue cur = stack.pop();
            toDelete.add(cur);
            byParent.getOrDefault(cur.getId(), List.of()).forEach(stack::push);
        }
        List<UUID> ids = toDelete.stream().map(Issue::getId).toList();
        comments.deleteAllInBatch(comments.findByIssueIdInOrderByCreatedAtAsc(ids));
        issues.deleteAllInBatch(toDelete);
    }

    // ── Comments ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<CommentResponse> commentsForUser(UUID userId) {
        List<UUID> issueIds = issues.findByProjectIdInOrderByCreatedAtAsc(ownedProjectIds(userId))
            .stream().map(Issue::getId).toList();
        if (issueIds.isEmpty()) return List.of();
        Map<UUID, TeamMember> membersById = team.byId();
        return comments.findByIssueIdInOrderByCreatedAtAsc(issueIds).stream()
            .map(c -> CommentResponse.from(c, membersById.get(c.getAuthorId())))
            .toList();
    }

    @Transactional
    public CommentResponse addComment(UUID userId, UUID issueId, CommentRequest req) {
        require(userId, issueId);
        TeamMember author = team.currentMember(userId);
        IssueComment c = new IssueComment();
        c.setIssueId(issueId);
        c.setAuthorId(author.getId());
        c.setText(req.text().trim());
        return CommentResponse.from(comments.save(c), author);
    }

    @Transactional
    public CommentResponse updateComment(UUID userId, UUID commentId, CommentRequest req) {
        IssueComment c = requireOwnComment(userId, commentId);
        c.setText(req.text().trim());
        return CommentResponse.from(comments.save(c), team.byId().get(c.getAuthorId()));
    }

    @Transactional
    public void deleteComment(UUID userId, UUID commentId) {
        IssueComment c = requireOwnComment(userId, commentId);
        comments.delete(c);
    }

    // ── ownership helpers ────────────────────────────────────────────────

    private List<UUID> ownedProjectIds(UUID userId) {
        return projects.findByUserIdOrderByCreatedAtAsc(userId).stream()
            .map(Project::getId).toList();
    }

    /** Loads an issue only if its project belongs to the caller. */
    Issue require(UUID userId, UUID issueId) {
        Issue i = issues.findById(issueId)
            .orElseThrow(() -> new ResourceNotFoundException("Issue not found"));
        projects.findByIdAndUserId(i.getProjectId(), userId)
            .orElseThrow(() -> new ResourceNotFoundException("Issue not found"));
        return i;
    }

    /** Loads a comment the caller both owns (via project) and authored. */
    private IssueComment requireOwnComment(UUID userId, UUID commentId) {
        IssueComment c = comments.findById(commentId)
            .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));
        require(userId, c.getIssueId());
        UUID myMemberId = team.currentMember(userId).getId();
        if (!c.getAuthorId().equals(myMemberId)) {
            throw new ResourceNotFoundException("Comment not found");
        }
        return c;
    }
}
