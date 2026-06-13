package com.timixa.backend.task;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

public class PlannedTaskExceptionId implements Serializable {
    private UUID taskId;
    private LocalDate exceptionDate;

    public PlannedTaskExceptionId() {}
    public PlannedTaskExceptionId(UUID taskId, LocalDate exceptionDate) {
        this.taskId = taskId;
        this.exceptionDate = exceptionDate;
    }

    public UUID getTaskId() { return taskId; }
    public void setTaskId(UUID taskId) { this.taskId = taskId; }
    public LocalDate getExceptionDate() { return exceptionDate; }
    public void setExceptionDate(LocalDate exceptionDate) { this.exceptionDate = exceptionDate; }

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof PlannedTaskExceptionId other)) return false;
        return Objects.equals(taskId, other.taskId) && Objects.equals(exceptionDate, other.exceptionDate);
    }
    @Override public int hashCode() { return Objects.hash(taskId, exceptionDate); }
}
