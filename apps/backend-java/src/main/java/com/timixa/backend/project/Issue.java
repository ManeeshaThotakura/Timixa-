package com.timixa.backend.project;

import jakarta.persistence.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * A single node in the project hierarchy. {@code type} + {@code parentId} express the tree:
 * epic (parent null) → story/task/bug (parent = epic) → subtask (parent = story).
 * Statuses/priorities/types are stored as the frontend's literal strings
 * (e.g. "in-progress") to avoid enum-mapping friction with hyphenated values.
 */
@Entity
@Table(name = "issues")
@EntityListeners(AuditingEntityListener.class)
public class Issue {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "issue_key", nullable = false, length = 16)
    private String key;

    @Column(name = "issue_number", nullable = false)
    private int number;

    /** epic | story | task | bug | subtask */
    @Column(nullable = false, length = 8)
    private String type;

    @Column(name = "parent_id")
    private UUID parentId;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, length = 4000)
    private String description = "";

    @Column(name = "acceptance_criteria", length = 4000)
    private String acceptanceCriteria;

    /** backlog | todo | in-progress | done */
    @Column(nullable = false, length = 12)
    private String status = "backlog";

    /** lowest | low | medium | high | critical */
    @Column(nullable = false, length = 8)
    private String priority = "medium";

    @Column(name = "assignee_id")
    private UUID assigneeId;

    @Column(name = "reporter_id")
    private UUID reporterId;

    @Column(name = "story_points")
    private Integer storyPoints;

    @Column(name = "estimate_hours")
    private Integer estimateHours;

    @Column(name = "sprint_id")
    private UUID sprintId;

    @Column(name = "start_date", length = 10)
    private String startDate;

    @Column(name = "due_date", length = 10)
    private String dueDate;

    /** Set only when status is done. */
    @Column(length = 20)
    private String resolution;

    @Column(length = 9)
    private String color;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getProjectId() { return projectId; }
    public void setProjectId(UUID projectId) { this.projectId = projectId; }
    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }
    public int getNumber() { return number; }
    public void setNumber(int number) { this.number = number; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public UUID getParentId() { return parentId; }
    public void setParentId(UUID parentId) { this.parentId = parentId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getAcceptanceCriteria() { return acceptanceCriteria; }
    public void setAcceptanceCriteria(String acceptanceCriteria) { this.acceptanceCriteria = acceptanceCriteria; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public UUID getAssigneeId() { return assigneeId; }
    public void setAssigneeId(UUID assigneeId) { this.assigneeId = assigneeId; }
    public UUID getReporterId() { return reporterId; }
    public void setReporterId(UUID reporterId) { this.reporterId = reporterId; }
    public Integer getStoryPoints() { return storyPoints; }
    public void setStoryPoints(Integer storyPoints) { this.storyPoints = storyPoints; }
    public Integer getEstimateHours() { return estimateHours; }
    public void setEstimateHours(Integer estimateHours) { this.estimateHours = estimateHours; }
    public UUID getSprintId() { return sprintId; }
    public void setSprintId(UUID sprintId) { this.sprintId = sprintId; }
    public String getStartDate() { return startDate; }
    public void setStartDate(String startDate) { this.startDate = startDate; }
    public String getDueDate() { return dueDate; }
    public void setDueDate(String dueDate) { this.dueDate = dueDate; }
    public String getResolution() { return resolution; }
    public void setResolution(String resolution) { this.resolution = resolution; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
