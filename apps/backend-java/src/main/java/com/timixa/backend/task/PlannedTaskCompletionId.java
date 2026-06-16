package com.timixa.backend.task;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

public class PlannedTaskCompletionId implements Serializable {
    private UUID taskId;
    private LocalDate completedDate;

    public PlannedTaskCompletionId() {}
    public PlannedTaskCompletionId(UUID taskId, LocalDate completedDate) {
        this.taskId = taskId;
        this.completedDate = completedDate;
    }

    public UUID getTaskId() { return taskId; }
    public void setTaskId(UUID taskId) { this.taskId = taskId; }
    public LocalDate getCompletedDate() { return completedDate; }
    public void setCompletedDate(LocalDate completedDate) { this.completedDate = completedDate; }

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof PlannedTaskCompletionId other)) return false;
        return Objects.equals(taskId, other.taskId)
            && Objects.equals(completedDate, other.completedDate);
    }
    @Override public int hashCode() { return Objects.hash(taskId, completedDate); }
}
