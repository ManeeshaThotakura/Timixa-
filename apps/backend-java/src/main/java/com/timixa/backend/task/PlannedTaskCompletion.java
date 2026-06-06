package com.timixa.backend.task;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "planned_task_completions")
@IdClass(PlannedTaskCompletionId.class)
public class PlannedTaskCompletion {

    @Id
    @Column(name = "task_id", nullable = false)
    private UUID taskId;

    @Id
    @Column(name = "completed_date", nullable = false)
    private LocalDate completedDate;

    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;

    public PlannedTaskCompletion() {}
    public PlannedTaskCompletion(UUID taskId, LocalDate completedDate, Instant completedAt) {
        this.taskId = taskId;
        this.completedDate = completedDate;
        this.completedAt = completedAt;
    }

    public UUID getTaskId() { return taskId; }
    public void setTaskId(UUID taskId) { this.taskId = taskId; }
    public LocalDate getCompletedDate() { return completedDate; }
    public void setCompletedDate(LocalDate completedDate) { this.completedDate = completedDate; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
}
