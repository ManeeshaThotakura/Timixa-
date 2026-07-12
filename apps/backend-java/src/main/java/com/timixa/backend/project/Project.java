package com.timixa.backend.project;

import jakarta.persistence.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "projects")
@EntityListeners(AuditingEntityListener.class)
public class Project {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "workspace_id", length = 64)
    private String workspaceId;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(name = "key_prefix", nullable = false, length = 4)
    private String keyPrefix;

    @Column(nullable = false, length = 2000)
    private String description = "";

    @Column(nullable = false, length = 8)
    private String priority = "medium";

    @Column(nullable = false, length = 12)
    private String status = "active";

    @Column(name = "start_date", length = 10)
    private String startDate;

    @Column(name = "due_date", length = 10)
    private String dueDate;

    @Convert(converter = StringListConverter.class)
    @Column(nullable = false, length = 1024)
    private List<String> tags = new ArrayList<>();

    @Convert(converter = StringListConverter.class)
    @Column(name = "member_ids", nullable = false, length = 1024)
    private List<String> memberIds = new ArrayList<>();

    @Column(nullable = false, length = 9)
    private String color = "#451de3";

    @Column(length = 48)
    private String icon;

    /** Monotonic counter used to mint issue keys (WR-1, WR-2, …). */
    @Column(name = "issue_seq", nullable = false)
    private int issueSeq = 0;

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
    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getWorkspaceId() { return workspaceId; }
    public void setWorkspaceId(String workspaceId) { this.workspaceId = workspaceId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getKeyPrefix() { return keyPrefix; }
    public void setKeyPrefix(String keyPrefix) { this.keyPrefix = keyPrefix; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getStartDate() { return startDate; }
    public void setStartDate(String startDate) { this.startDate = startDate; }
    public String getDueDate() { return dueDate; }
    public void setDueDate(String dueDate) { this.dueDate = dueDate; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags == null ? new ArrayList<>() : tags; }
    public List<String> getMemberIds() { return memberIds; }
    public void setMemberIds(List<String> memberIds) { this.memberIds = memberIds == null ? new ArrayList<>() : memberIds; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }
    public int getIssueSeq() { return issueSeq; }
    public void setIssueSeq(int issueSeq) { this.issueSeq = issueSeq; }
    public int nextIssueSeq() { return ++issueSeq; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
