package com.timixa.backend.habit;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "habit_completions")
@IdClass(HabitCompletionId.class)
public class HabitCompletion {

    @Id
    @Column(name = "habit_id", nullable = false)
    private UUID habitId;

    @Id
    @Column(name = "completed_date", nullable = false)
    private LocalDate completedDate;

    @Column(nullable = false)
    private int delta = 1;

    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;

    public HabitCompletion() {}
    public HabitCompletion(UUID habitId, LocalDate completedDate, int delta, Instant completedAt) {
        this.habitId = habitId;
        this.completedDate = completedDate;
        this.delta = delta;
        this.completedAt = completedAt;
    }

    public UUID getHabitId() { return habitId; }
    public void setHabitId(UUID habitId) { this.habitId = habitId; }
    public LocalDate getCompletedDate() { return completedDate; }
    public void setCompletedDate(LocalDate completedDate) { this.completedDate = completedDate; }
    public int getDelta() { return delta; }
    public void setDelta(int delta) { this.delta = delta; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
}
