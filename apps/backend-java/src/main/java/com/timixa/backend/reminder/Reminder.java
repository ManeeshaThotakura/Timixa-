package com.timixa.backend.reminder;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "reminders")
public class Reminder {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(nullable = false, length = 500)
    private String description = "";

    @Column(nullable = false, length = 40)
    private String time = "";

    @Column(nullable = false, length = 16)
    private String type = "manual";

    @Column(name = "related_habit_id", length = 80)
    private String relatedHabitId;

    @Column(name = "related_task_id", length = 80)
    private String relatedTaskId;

    @Column(name = "fire_at")
    private Instant fireAt;

    @Column(nullable = false)
    private boolean sent = false;

    @Column(nullable = false)
    private boolean dismissed = false;

    @Column(nullable = false, length = 60)
    private String icon = "notifications";

    @Column(name = "icon_color", nullable = false, length = 9)
    private String iconColor = "#451de3";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getTime() { return time; }
    public void setTime(String time) { this.time = time; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getRelatedHabitId() { return relatedHabitId; }
    public void setRelatedHabitId(String v) { this.relatedHabitId = v; }
    public String getRelatedTaskId() { return relatedTaskId; }
    public void setRelatedTaskId(String v) { this.relatedTaskId = v; }
    public Instant getFireAt() { return fireAt; }
    public void setFireAt(Instant fireAt) { this.fireAt = fireAt; }
    public boolean isSent() { return sent; }
    public void setSent(boolean sent) { this.sent = sent; }
    public boolean isDismissed() { return dismissed; }
    public void setDismissed(boolean dismissed) { this.dismissed = dismissed; }
    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }
    public String getIconColor() { return iconColor; }
    public void setIconColor(String iconColor) { this.iconColor = iconColor; }
    public Instant getCreatedAt() { return createdAt; }
}
