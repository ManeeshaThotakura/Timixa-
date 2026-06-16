package com.timixa.backend.task;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "planned_task_exceptions")
@IdClass(PlannedTaskExceptionId.class)
public class PlannedTaskException {

    @Id
    @Column(name = "task_id", nullable = false)
    private UUID taskId;

    @Id
    @Column(name = "exception_date", nullable = false)
    private LocalDate exceptionDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "exception_type", nullable = false, length = 8)
    private ExceptionType exceptionType;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public PlannedTaskException() {}
    public PlannedTaskException(UUID taskId, LocalDate exceptionDate, ExceptionType exceptionType, Instant createdAt) {
        this.taskId = taskId;
        this.exceptionDate = exceptionDate;
        this.exceptionType = exceptionType;
        this.createdAt = createdAt;
    }

    public UUID getTaskId() { return taskId; }
    public void setTaskId(UUID taskId) { this.taskId = taskId; }
    public LocalDate getExceptionDate() { return exceptionDate; }
    public void setExceptionDate(LocalDate exceptionDate) { this.exceptionDate = exceptionDate; }
    public ExceptionType getExceptionType() { return exceptionType; }
    public void setExceptionType(ExceptionType exceptionType) { this.exceptionType = exceptionType; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
