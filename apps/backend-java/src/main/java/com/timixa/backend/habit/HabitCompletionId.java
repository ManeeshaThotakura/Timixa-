package com.timixa.backend.habit;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

public class HabitCompletionId implements Serializable {

    private UUID habitId;
    private LocalDate completedDate;

    public HabitCompletionId() {}
    public HabitCompletionId(UUID habitId, LocalDate completedDate) {
        this.habitId = habitId;
        this.completedDate = completedDate;
    }

    public UUID getHabitId() { return habitId; }
    public LocalDate getCompletedDate() { return completedDate; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof HabitCompletionId other)) return false;
        return Objects.equals(habitId, other.habitId)
            && Objects.equals(completedDate, other.completedDate);
    }

    @Override
    public int hashCode() {
        return Objects.hash(habitId, completedDate);
    }
}
