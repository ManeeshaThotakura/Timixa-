package com.timixa.backend.task;

import jakarta.persistence.*;

import java.time.DayOfWeek;
import java.time.Instant;
import java.util.UUID;

/**
 * A recurring weekly slot: "this task runs SATURDAY 09:00–12:00 every week".
 * Per-date segments override these; these override the task's template times.
 */
@Entity
@Table(name = "planned_task_week_slots",
    uniqueConstraints = @UniqueConstraint(columnNames = {"task_id", "weekday", "start_time"}))
public class PlannedTaskWeekSlot {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(name = "task_id", nullable = false)
    private UUID taskId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 9)
    private DayOfWeek weekday;

    @Column(name = "start_time", nullable = false, length = 5)
    private String startTime;

    @Column(name = "end_time", nullable = false, length = 5)
    private String endTime;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
    }

    public PlannedTaskWeekSlot() {}
    public PlannedTaskWeekSlot(UUID taskId, DayOfWeek weekday, String startTime, String endTime) {
        this.taskId = taskId;
        this.weekday = weekday;
        this.startTime = startTime;
        this.endTime = endTime;
    }

    public UUID getId() { return id; }
    public UUID getTaskId() { return taskId; }
    public DayOfWeek getWeekday() { return weekday; }
    public String getStartTime() { return startTime; }
    public String getEndTime() { return endTime; }
}
