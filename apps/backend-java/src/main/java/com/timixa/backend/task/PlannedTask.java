package com.timixa.backend.task;

import jakarta.persistence.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Entity
@Table(name = "planned_tasks")
@EntityListeners(AuditingEntityListener.class)
public class PlannedTask {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(length = 80)
    private String goal;

    @Column(nullable = false, length = 9)
    private String color = "#451de3";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Cadence cadence;

    @Column(name = "needs_time_slot", nullable = false)
    private boolean needsTimeSlot = true;

    @Column(name = "start_time", length = 5)
    private String startTime;

    @Column(name = "end_time", length = 5)
    private String endTime;

    @Column(name = "scheduled_date")
    private LocalDate scheduledDate;

    @Column(length = 96)
    private String weekdays;

    @Column(name = "month_days", length = 96)
    private String monthDays;

    @Column(name = "min_time_minutes")
    private Integer minTimeMinutes;

    @Column(name = "max_time_minutes")
    private Integer maxTimeMinutes;

    @Column(name = "min_count")
    private Integer minCount;

    @Column(name = "max_count")
    private Integer maxCount;

    @Column(name = "notify_at_start", nullable = false)
    private boolean notifyAtStart = false;

    @Column(name = "notify_at_end", nullable = false)
    private boolean notifyAtEnd = false;

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

    public Set<DayOfWeek> getWeekdaysSet() {
        if (weekdays == null || weekdays.isBlank()) return Set.of();
        return Arrays.stream(weekdays.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .map(DayOfWeek::valueOf)
            .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    public void setWeekdaysSet(Set<DayOfWeek> set) {
        if (set == null || set.isEmpty()) { this.weekdays = null; return; }
        this.weekdays = set.stream().map(Enum::name).collect(Collectors.joining(","));
    }

    public Set<Integer> getMonthDaysSet() {
        if (monthDays == null || monthDays.isBlank()) return Set.of();
        return Arrays.stream(monthDays.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .map(Integer::valueOf)
            .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    public void setMonthDaysSet(Set<Integer> set) {
        if (set == null || set.isEmpty()) { this.monthDays = null; return; }
        this.monthDays = set.stream().sorted().map(String::valueOf).collect(Collectors.joining(","));
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getGoal() { return goal; }
    public void setGoal(String goal) { this.goal = goal; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public Cadence getCadence() { return cadence; }
    public void setCadence(Cadence cadence) { this.cadence = cadence; }
    public boolean isNeedsTimeSlot() { return needsTimeSlot; }
    public void setNeedsTimeSlot(boolean v) { this.needsTimeSlot = v; }
    public String getStartTime() { return startTime; }
    public void setStartTime(String startTime) { this.startTime = startTime; }
    public String getEndTime() { return endTime; }
    public void setEndTime(String endTime) { this.endTime = endTime; }
    public LocalDate getScheduledDate() { return scheduledDate; }
    public void setScheduledDate(LocalDate scheduledDate) { this.scheduledDate = scheduledDate; }
    public String getWeekdays() { return weekdays; }
    public void setWeekdays(String weekdays) { this.weekdays = weekdays; }
    public String getMonthDays() { return monthDays; }
    public void setMonthDays(String monthDays) { this.monthDays = monthDays; }
    public Integer getMinTimeMinutes() { return minTimeMinutes; }
    public void setMinTimeMinutes(Integer v) { this.minTimeMinutes = v; }
    public Integer getMaxTimeMinutes() { return maxTimeMinutes; }
    public void setMaxTimeMinutes(Integer v) { this.maxTimeMinutes = v; }
    public Integer getMinCount() { return minCount; }
    public void setMinCount(Integer v) { this.minCount = v; }
    public Integer getMaxCount() { return maxCount; }
    public void setMaxCount(Integer v) { this.maxCount = v; }
    public boolean isNotifyAtStart() { return notifyAtStart; }
    public void setNotifyAtStart(boolean v) { this.notifyAtStart = v; }
    public boolean isNotifyAtEnd() { return notifyAtEnd; }
    public void setNotifyAtEnd(boolean v) { this.notifyAtEnd = v; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
