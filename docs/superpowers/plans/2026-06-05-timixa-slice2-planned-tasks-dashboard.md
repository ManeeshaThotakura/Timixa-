# Timixa Slice 2 — PlannedTask + Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `PlannedTask` entity + per-day completion log to Spring Boot, expose it through `/api/planned-tasks/**`, render it on the existing Today dashboard (Now card, Unscheduled banner, Today's Plan, Done), and rewire the New Task page to persist into the new backend.

**Architecture:** New `task/` package in Spring Boot — entity + companion completion entity + repositories + service (validation + cadence "applies on date" filter) + controller. Frontend gets a signal-based `PlannedTaskService` and four new dashboard sections; the New Task page maps its existing form state to the new DTO with documented field drops.

**Tech Stack:** Spring Boot 3.3, Java 20, JPA, H2 (dev) / Postgres (prod), Flyway. Angular 17 standalone components + signals. Playwright (existing workspace from Slice 1).

**Spec:** `docs/superpowers/specs/2026-06-05-timixa-slice2-planned-tasks-dashboard-design.md`

**Git policy:** User does git manually. Where this plan says "Checkpoint", verify the listed tests/builds pass, then stop and tell the user the work is ready to stage.

---

## File structure (locked before tasks start)

```
apps/backend-java/                                  MODIFY
├── src/main/java/com/timixa/backend/
│   ├── task/                                       NEW package
│   │   ├── Cadence.java
│   │   ├── PlannedTask.java
│   │   ├── PlannedTaskCompletion.java
│   │   ├── PlannedTaskCompletionId.java
│   │   ├── PlannedTaskRepository.java
│   │   ├── PlannedTaskCompletionRepository.java
│   │   ├── PlannedTaskService.java
│   │   ├── PlannedTaskController.java
│   │   └── dto/
│   │       ├── PlannedTaskRequest.java
│   │       ├── PlannedTaskUpdateRequest.java
│   │       └── PlannedTaskResponse.java
│   ├── common/
│   │   ├── TaskNotFoundException.java              NEW
│   │   ├── TaskAlreadyCompleteException.java       NEW
│   │   └── GlobalExceptionHandler.java             edited: add two handlers
│   └── test/TestResetController.java               edited: also truncate planned_tasks + completions
├── src/main/resources/
│   └── db/migration/V2__planned_tasks.sql          NEW
└── src/test/java/com/timixa/backend/task/
    ├── PlannedTaskServiceTest.java                 NEW
    └── PlannedTaskControllerTest.java              NEW

apps/frontend/                                      MODIFY
└── src/app/
    ├── core/
    │   ├── models/planned-task.model.ts            NEW
    │   └── services/planned-task.service.ts        NEW
    └── features/
        ├── dashboard/today-dashboard/
        │   └── today-dashboard.component.ts        edited: inject service + 4 sections + ticker
        └── new-task/
            └── new-task.component.ts               edited: createTask() body only

apps/e2e/
└── tests/planned-tasks.spec.ts                     NEW
```

---

## Phase A — Backend domain (entity + migration)

### Task 1: Cadence enum + V2 migration

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/task/Cadence.java`
- Create: `apps/backend-java/src/main/resources/db/migration/V2__planned_tasks.sql`

- [ ] **Step 1.1: Create `Cadence.java`**

```java
package com.timixa.backend.task;

public enum Cadence { ONCE, DAILY, WEEKLY, MONTHLY }
```

- [ ] **Step 1.2: Create `V2__planned_tasks.sql`**

```sql
CREATE TABLE planned_tasks (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(120) NOT NULL,
    goal            VARCHAR(80),
    color           VARCHAR(9) NOT NULL DEFAULT '#451de3',
    cadence         VARCHAR(16) NOT NULL,
    needs_time_slot BOOLEAN NOT NULL DEFAULT TRUE,
    start_time      VARCHAR(5),
    end_time        VARCHAR(5),
    scheduled_date  DATE,
    weekdays        VARCHAR(27),
    month_days      VARCHAR(96),
    created_at      TIMESTAMP NOT NULL,
    updated_at      TIMESTAMP NOT NULL
);
CREATE INDEX idx_planned_tasks_user ON planned_tasks(user_id);

CREATE TABLE planned_task_completions (
    task_id        UUID NOT NULL REFERENCES planned_tasks(id) ON DELETE CASCADE,
    completed_date DATE NOT NULL,
    completed_at   TIMESTAMP NOT NULL,
    PRIMARY KEY (task_id, completed_date)
);
```

- [ ] **Step 1.3: Compile**

```bash
cd apps/backend-java && ./mvnw -q compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 1.4: Checkpoint.**

---

### Task 2: PlannedTask entity

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/task/PlannedTask.java`

- [ ] **Step 2.1: Create `PlannedTask.java`**

```java
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

    /** CSV of DayOfWeek names: "MONDAY,WEDNESDAY,..." */
    @Column(length = 96)
    private String weekdays;

    /** CSV of integers 1..31: "1,15,28" */
    @Column(name = "month_days", length = 96)
    private String monthDays;

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

    // ---- weekdays / monthDays helpers ----

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

    // ---- getters / setters ----
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
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
```

> The `weekdays` column stores `DayOfWeek.name()` values (e.g. `MONDAY`). Length is 96 (room for all seven names + commas).

- [ ] **Step 2.2: Compile**

```bash
./mvnw -q compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 2.3: Checkpoint.**

---

### Task 3: PlannedTaskCompletion + composite ID

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/task/PlannedTaskCompletionId.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/task/PlannedTaskCompletion.java`

- [ ] **Step 3.1: Create `PlannedTaskCompletionId.java`**

```java
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
```

- [ ] **Step 3.2: Create `PlannedTaskCompletion.java`**

```java
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
```

- [ ] **Step 3.3: Compile**

```bash
./mvnw -q compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 3.4: Checkpoint.**

---

### Task 4: Repositories

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/task/PlannedTaskRepository.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/task/PlannedTaskCompletionRepository.java`

- [ ] **Step 4.1: Create `PlannedTaskRepository.java`**

```java
package com.timixa.backend.task;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PlannedTaskRepository extends JpaRepository<PlannedTask, UUID> {
    List<PlannedTask> findByUserIdOrderByCreatedAtDesc(UUID userId);
}
```

- [ ] **Step 4.2: Create `PlannedTaskCompletionRepository.java`**

```java
package com.timixa.backend.task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PlannedTaskCompletionRepository
        extends JpaRepository<PlannedTaskCompletion, PlannedTaskCompletionId> {

    @Query("SELECT c.taskId FROM PlannedTaskCompletion c "
        + "WHERE c.taskId IN :taskIds AND c.completedDate = :date")
    List<UUID> findCompletedTaskIds(@Param("taskIds") Collection<UUID> taskIds,
                                    @Param("date") LocalDate date);

    @Modifying
    @Transactional
    void deleteByTaskIdAndCompletedDate(UUID taskId, LocalDate completedDate);
}
```

- [ ] **Step 4.3: Compile**

```bash
./mvnw -q compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 4.4: Checkpoint.**

---

## Phase B — Backend exceptions + DTOs

### Task 5: New custom exceptions

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/common/TaskNotFoundException.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/common/TaskAlreadyCompleteException.java`

- [ ] **Step 5.1: `TaskNotFoundException.java`**

```java
package com.timixa.backend.common;
public class TaskNotFoundException extends RuntimeException {
    public TaskNotFoundException() { super("Task not found"); }
}
```

- [ ] **Step 5.2: `TaskAlreadyCompleteException.java`**

```java
package com.timixa.backend.common;
public class TaskAlreadyCompleteException extends RuntimeException {
    public TaskAlreadyCompleteException() { super("Task already complete for that date"); }
}
```

- [ ] **Step 5.3: Wire them into `GlobalExceptionHandler.java`**

Open `apps/backend-java/src/main/java/com/timixa/backend/common/GlobalExceptionHandler.java`. Above the catch-all `@ExceptionHandler(Exception.class)` handler, add:

```java
    @ExceptionHandler(TaskNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleTaskNotFound(TaskNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse.of("TASK_NOT_FOUND", e.getMessage()));
    }

    @ExceptionHandler(TaskAlreadyCompleteException.class)
    public ResponseEntity<ErrorResponse> handleTaskAlreadyComplete(TaskAlreadyCompleteException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(ErrorResponse.of("TASK_ALREADY_COMPLETE", e.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException e) {
        return ResponseEntity.badRequest()
            .body(ErrorResponse.of("VALIDATION_ERROR", e.getMessage()));
    }
```

> The `IllegalArgumentException` handler covers the cross-field validations in `PlannedTaskService` (Task 7). `MethodArgumentNotValidException` keeps handling shape-level validation as before.

- [ ] **Step 5.4: Compile**

```bash
./mvnw -q compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 5.5: Checkpoint.**

---

### Task 6: DTOs (request, update, response)

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/task/dto/PlannedTaskRequest.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/task/dto/PlannedTaskUpdateRequest.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/task/dto/PlannedTaskResponse.java`

- [ ] **Step 6.1: `PlannedTaskRequest.java`**

```java
package com.timixa.backend.task.dto;

import com.timixa.backend.task.Cadence;
import jakarta.validation.constraints.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Set;

public record PlannedTaskRequest(
    @NotBlank @Size(max = 120) String title,
    @Size(max = 80) String goal,
    @Pattern(regexp = "^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$") String color,
    @NotNull Cadence cadence,
    Boolean needsTimeSlot,
    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "must be HH:mm") String startTime,
    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "must be HH:mm") String endTime,
    LocalDate scheduledDate,
    Set<DayOfWeek> weekdays,
    Set<@Min(1) @Max(31) Integer> monthDays
) {}
```

- [ ] **Step 6.2: `PlannedTaskUpdateRequest.java`**

Same shape as `PlannedTaskRequest` but every field is nullable (no `@NotNull` / `@NotBlank`):

```java
package com.timixa.backend.task.dto;

import com.timixa.backend.task.Cadence;
import jakarta.validation.constraints.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Set;

public record PlannedTaskUpdateRequest(
    @Size(max = 120) String title,
    @Size(max = 80) String goal,
    @Pattern(regexp = "^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$") String color,
    Cadence cadence,
    Boolean needsTimeSlot,
    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "must be HH:mm") String startTime,
    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "must be HH:mm") String endTime,
    LocalDate scheduledDate,
    Set<DayOfWeek> weekdays,
    Set<@Min(1) @Max(31) Integer> monthDays
) {}
```

- [ ] **Step 6.3: `PlannedTaskResponse.java`**

```java
package com.timixa.backend.task.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.timixa.backend.task.Cadence;
import com.timixa.backend.task.PlannedTask;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record PlannedTaskResponse(
    UUID id, UUID userId, String title, String goal, String color,
    Cadence cadence, boolean needsTimeSlot,
    String startTime, String endTime,
    LocalDate scheduledDate,
    Set<DayOfWeek> weekdays,
    Set<Integer> monthDays,
    boolean completedToday,
    Instant createdAt, Instant updatedAt
) {
    public static PlannedTaskResponse from(PlannedTask t, boolean completedToday) {
        return new PlannedTaskResponse(
            t.getId(), t.getUserId(), t.getTitle(), t.getGoal(), t.getColor(),
            t.getCadence(), t.isNeedsTimeSlot(),
            t.getStartTime(), t.getEndTime(),
            t.getScheduledDate(),
            t.getWeekdaysSet().isEmpty() ? null : t.getWeekdaysSet(),
            t.getMonthDaysSet().isEmpty() ? null : t.getMonthDaysSet(),
            completedToday,
            t.getCreatedAt(), t.getUpdatedAt()
        );
    }
}
```

- [ ] **Step 6.4: Compile**

```bash
./mvnw -q compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 6.5: Checkpoint.**

---

## Phase C — Backend service (TDD)

### Task 7: PlannedTaskService.create + validation, with TDD

**Files:**
- Create: `apps/backend-java/src/test/java/com/timixa/backend/task/PlannedTaskServiceTest.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/task/PlannedTaskService.java`

- [ ] **Step 7.1: Write failing test for valid DAILY task**

```java
package com.timixa.backend.task;

import com.timixa.backend.common.TaskAlreadyCompleteException;
import com.timixa.backend.common.TaskNotFoundException;
import com.timixa.backend.task.dto.PlannedTaskRequest;
import com.timixa.backend.task.dto.PlannedTaskResponse;
import com.timixa.backend.task.dto.PlannedTaskUpdateRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("dev")
class PlannedTaskServiceTest {

    @Autowired PlannedTaskService service;
    @Autowired PlannedTaskRepository tasks;
    @Autowired PlannedTaskCompletionRepository completions;

    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void clean() {
        completions.deleteAll();
        tasks.deleteAll();
    }

    @Test
    void create_daily_with_times() {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Gym", "Fitness", "#451de3", Cadence.DAILY, true,
            "09:00", "10:00", null, null, null
        );
        PlannedTaskResponse r = service.create(userId, req);
        assertThat(r.id()).isNotNull();
        assertThat(r.cadence()).isEqualTo(Cadence.DAILY);
        assertThat(r.startTime()).isEqualTo("09:00");
        assertThat(r.completedToday()).isFalse();
    }
}
```

- [ ] **Step 7.2: Run (expect FAIL — service missing)**

```bash
./mvnw -q test -Dtest=PlannedTaskServiceTest#create_daily_with_times
```

Expected: compile error (no `PlannedTaskService` class).

- [ ] **Step 7.3: Implement `PlannedTaskService` minimal — create + validation**

```java
package com.timixa.backend.task;

import com.timixa.backend.common.TaskAlreadyCompleteException;
import com.timixa.backend.common.TaskNotFoundException;
import com.timixa.backend.task.dto.PlannedTaskRequest;
import com.timixa.backend.task.dto.PlannedTaskResponse;
import com.timixa.backend.task.dto.PlannedTaskUpdateRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Service
public class PlannedTaskService {

    private final PlannedTaskRepository tasks;
    private final PlannedTaskCompletionRepository completions;

    public PlannedTaskService(PlannedTaskRepository tasks,
                              PlannedTaskCompletionRepository completions) {
        this.tasks = tasks;
        this.completions = completions;
    }

    @Transactional
    public PlannedTaskResponse create(UUID userId, PlannedTaskRequest req) {
        PlannedTask t = new PlannedTask();
        t.setUserId(userId);
        t.setTitle(req.title());
        t.setGoal(req.goal());
        if (req.color() != null) t.setColor(req.color());
        t.setCadence(req.cadence());
        if (req.needsTimeSlot() != null) t.setNeedsTimeSlot(req.needsTimeSlot());
        t.setStartTime(req.startTime());
        t.setEndTime(req.endTime());
        t.setScheduledDate(req.scheduledDate());
        t.setWeekdaysSet(req.weekdays());
        t.setMonthDaysSet(req.monthDays());
        validate(t);
        PlannedTask saved = tasks.save(t);
        return PlannedTaskResponse.from(saved, false);
    }

    private void validate(PlannedTask t) {
        Cadence c = t.getCadence();
        if (c == null) throw new IllegalArgumentException("cadence is required");

        switch (c) {
            case ONCE -> {
                if (t.getScheduledDate() == null)
                    throw new IllegalArgumentException("ONCE tasks require scheduledDate");
                if (!t.getWeekdaysSet().isEmpty() || !t.getMonthDaysSet().isEmpty())
                    throw new IllegalArgumentException("ONCE tasks must not set weekdays or monthDays");
            }
            case DAILY -> {
                if (t.getScheduledDate() != null || !t.getWeekdaysSet().isEmpty() || !t.getMonthDaysSet().isEmpty())
                    throw new IllegalArgumentException("DAILY tasks must not set scheduledDate, weekdays, or monthDays");
            }
            case WEEKLY -> {
                if (t.getWeekdaysSet().isEmpty())
                    throw new IllegalArgumentException("WEEKLY tasks require non-empty weekdays");
                if (t.getScheduledDate() != null || !t.getMonthDaysSet().isEmpty())
                    throw new IllegalArgumentException("WEEKLY tasks must not set scheduledDate or monthDays");
            }
            case MONTHLY -> {
                if (t.getMonthDaysSet().isEmpty())
                    throw new IllegalArgumentException("MONTHLY tasks require non-empty monthDays");
                if (t.getScheduledDate() != null || !t.getWeekdaysSet().isEmpty())
                    throw new IllegalArgumentException("MONTHLY tasks must not set scheduledDate or weekdays");
            }
        }

        if (!t.isNeedsTimeSlot() && (t.getStartTime() != null || t.getEndTime() != null))
            throw new IllegalArgumentException("needsTimeSlot=false tasks must not have times");

        if (t.getStartTime() != null) {
            if (t.getEndTime() == null)
                throw new IllegalArgumentException("endTime is required when startTime is set");
            if (t.getEndTime().compareTo(t.getStartTime()) <= 0)
                throw new IllegalArgumentException("endTime must be after startTime");
        }
    }
}
```

- [ ] **Step 7.4: Run (expect PASS)**

```bash
./mvnw -q test -Dtest=PlannedTaskServiceTest#create_daily_with_times
```

Expected: 1 passing.

- [ ] **Step 7.5: Add validation failure tests**

In `PlannedTaskServiceTest.java`, append:

```java
    @Test
    void create_rejects_daily_with_scheduled_date() {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "X", null, null, Cadence.DAILY, true,
            null, null, LocalDate.now(), null, null);
        assertThatThrownBy(() -> service.create(userId, req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("DAILY");
    }

    @Test
    void create_rejects_weekly_without_weekdays() {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "X", null, null, Cadence.WEEKLY, true,
            null, null, null, null, null);
        assertThatThrownBy(() -> service.create(userId, req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("WEEKLY");
    }

    @Test
    void create_rejects_no_time_slot_with_times() {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "X", null, null, Cadence.DAILY, false,
            "09:00", "10:00", null, null, null);
        assertThatThrownBy(() -> service.create(userId, req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("needsTimeSlot=false");
    }

    @Test
    void create_rejects_endTime_before_startTime() {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "X", null, null, Cadence.DAILY, true,
            "10:00", "09:00", null, null, null);
        assertThatThrownBy(() -> service.create(userId, req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("endTime");
    }
```

- [ ] **Step 7.6: Run (expect PASS)**

```bash
./mvnw -q test -Dtest=PlannedTaskServiceTest
```

Expected: 5 passing.

- [ ] **Step 7.7: Checkpoint.**

---

### Task 8: PlannedTaskService — list, "applies on date", findById

**Files:**
- Modify: `apps/backend-java/src/main/java/com/timixa/backend/task/PlannedTaskService.java`
- Modify: `apps/backend-java/src/test/java/com/timixa/backend/task/PlannedTaskServiceTest.java`

- [ ] **Step 8.1: Add tests for date-scoped listing**

Append to `PlannedTaskServiceTest.java`:

```java
    @Test
    void findForDate_daily_always_matches() {
        service.create(userId, new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true, "09:00", "10:00", null, null, null));
        List<PlannedTaskResponse> out = service.findForDate(userId, LocalDate.now());
        assertThat(out).hasSize(1);
    }

    @Test
    void findForDate_weekly_filters_by_weekday() {
        DayOfWeek today = LocalDate.now().getDayOfWeek();
        DayOfWeek tomorrow = today.plus(1);

        service.create(userId, new PlannedTaskRequest(
            "Match", null, null, Cadence.WEEKLY, true,
            "09:00", "10:00", null, Set.of(today), null));
        service.create(userId, new PlannedTaskRequest(
            "NoMatch", null, null, Cadence.WEEKLY, true,
            "09:00", "10:00", null, Set.of(tomorrow), null));

        List<PlannedTaskResponse> out = service.findForDate(userId, LocalDate.now());
        assertThat(out).extracting(PlannedTaskResponse::title).containsExactly("Match");
    }

    @Test
    void findForDate_monthly_filters_by_day_of_month() {
        int today = LocalDate.now().getDayOfMonth();
        int other = today == 1 ? 2 : 1;

        service.create(userId, new PlannedTaskRequest(
            "Match", null, null, Cadence.MONTHLY, true,
            "09:00", "10:00", null, null, Set.of(today)));
        service.create(userId, new PlannedTaskRequest(
            "NoMatch", null, null, Cadence.MONTHLY, true,
            "09:00", "10:00", null, null, Set.of(other)));

        List<PlannedTaskResponse> out = service.findForDate(userId, LocalDate.now());
        assertThat(out).extracting(PlannedTaskResponse::title).containsExactly("Match");
    }

    @Test
    void findForDate_once_matches_only_on_scheduled_date() {
        LocalDate today = LocalDate.now();
        service.create(userId, new PlannedTaskRequest(
            "Today", null, null, Cadence.ONCE, true, null, null, today, null, null));
        service.create(userId, new PlannedTaskRequest(
            "Tomorrow", null, null, Cadence.ONCE, true, null, null, today.plusDays(1), null, null));
        List<PlannedTaskResponse> out = service.findForDate(userId, today);
        assertThat(out).extracting(PlannedTaskResponse::title).containsExactly("Today");
    }

    @Test
    void findForDate_isolates_users() {
        UUID otherUser = UUID.randomUUID();
        service.create(userId, new PlannedTaskRequest(
            "Mine", null, null, Cadence.DAILY, true, "09:00", "10:00", null, null, null));
        service.create(otherUser, new PlannedTaskRequest(
            "Theirs", null, null, Cadence.DAILY, true, "09:00", "10:00", null, null, null));
        List<PlannedTaskResponse> out = service.findForDate(userId, LocalDate.now());
        assertThat(out).extracting(PlannedTaskResponse::title).containsExactly("Mine");
    }
```

- [ ] **Step 8.2: Implement `findForDate` + `findAll` + `findEntityOwnedBy`**

In `PlannedTaskService.java`, add:

```java
    @Transactional(readOnly = true)
    public List<PlannedTaskResponse> findAll(UUID userId) {
        List<PlannedTask> all = tasks.findByUserIdOrderByCreatedAtDesc(userId);
        Set<UUID> completedToday = new HashSet<>(
            completions.findCompletedTaskIds(idsOf(all), LocalDate.now()));
        return all.stream()
            .map(t -> PlannedTaskResponse.from(t, completedToday.contains(t.getId())))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<PlannedTaskResponse> findForDate(UUID userId, LocalDate date) {
        List<PlannedTask> all = tasks.findByUserIdOrderByCreatedAtDesc(userId);
        List<PlannedTask> filtered = all.stream().filter(t -> appliesOn(t, date)).toList();
        Set<UUID> completedToday = new HashSet<>(
            completions.findCompletedTaskIds(idsOf(filtered), LocalDate.now()));
        return filtered.stream()
            .map(t -> PlannedTaskResponse.from(t, completedToday.contains(t.getId())))
            .toList();
    }

    private static List<UUID> idsOf(List<PlannedTask> list) {
        return list.stream().map(PlannedTask::getId).toList();
    }

    static boolean appliesOn(PlannedTask t, LocalDate date) {
        return switch (t.getCadence()) {
            case ONCE -> date.equals(t.getScheduledDate());
            case DAILY -> true;
            case WEEKLY -> t.getWeekdaysSet().contains(date.getDayOfWeek());
            case MONTHLY -> t.getMonthDaysSet().contains(date.getDayOfMonth());
        };
    }

    PlannedTask requireOwnedTask(UUID userId, UUID taskId) {
        PlannedTask t = tasks.findById(taskId).orElseThrow(TaskNotFoundException::new);
        if (!t.getUserId().equals(userId)) throw new TaskNotFoundException();
        return t;
    }
```

Add the missing imports at the top:

```java
import com.timixa.backend.task.dto.PlannedTaskRequest;
import com.timixa.backend.task.dto.PlannedTaskResponse;
import com.timixa.backend.task.dto.PlannedTaskUpdateRequest;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
```

- [ ] **Step 8.3: Run (expect PASS)**

```bash
./mvnw -q test -Dtest=PlannedTaskServiceTest
```

Expected: 10 passing.

- [ ] **Step 8.4: Checkpoint.**

---

### Task 9: PlannedTaskService — update, complete/uncomplete, delete

**Files:**
- Modify: `apps/backend-java/src/main/java/com/timixa/backend/task/PlannedTaskService.java`
- Modify: `apps/backend-java/src/test/java/com/timixa/backend/task/PlannedTaskServiceTest.java`

- [ ] **Step 9.1: Add tests**

Append to `PlannedTaskServiceTest.java`:

```java
    @Test
    void complete_then_uncomplete_round_trip() {
        UUID id = service.create(userId, new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true, "09:00", "10:00", null, null, null)).id();

        PlannedTaskResponse afterComplete = service.complete(userId, id, LocalDate.now());
        assertThat(afterComplete.completedToday()).isTrue();

        assertThatThrownBy(() -> service.complete(userId, id, LocalDate.now()))
            .isInstanceOf(TaskAlreadyCompleteException.class);

        service.uncomplete(userId, id, LocalDate.now());
        List<PlannedTaskResponse> out = service.findForDate(userId, LocalDate.now());
        assertThat(out).singleElement()
            .satisfies(r -> assertThat(r.completedToday()).isFalse());
    }

    @Test
    void complete_404_when_not_owned() {
        UUID id = service.create(UUID.randomUUID(), new PlannedTaskRequest(
            "Theirs", null, null, Cadence.DAILY, true, "09:00", "10:00", null, null, null)).id();

        assertThatThrownBy(() -> service.complete(userId, id, LocalDate.now()))
            .isInstanceOf(TaskNotFoundException.class);
    }

    @Test
    void update_patches_only_provided_fields() {
        UUID id = service.create(userId, new PlannedTaskRequest(
            "Gym", "Fitness", null, Cadence.DAILY, true, "09:00", "10:00", null, null, null)).id();

        PlannedTaskUpdateRequest patch = new PlannedTaskUpdateRequest(
            null, null, null, null, null, "08:00", "09:00", null, null, null);
        PlannedTaskResponse r = service.update(userId, id, patch);
        assertThat(r.title()).isEqualTo("Gym");
        assertThat(r.goal()).isEqualTo("Fitness");
        assertThat(r.startTime()).isEqualTo("08:00");
        assertThat(r.endTime()).isEqualTo("09:00");
    }

    @Test
    void delete_cascades_completions() {
        UUID id = service.create(userId, new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true, "09:00", "10:00", null, null, null)).id();
        service.complete(userId, id, LocalDate.now());
        service.delete(userId, id);
        assertThat(tasks.findById(id)).isEmpty();
        assertThat(completions.findCompletedTaskIds(List.of(id), LocalDate.now())).isEmpty();
    }
```

- [ ] **Step 9.2: Implement the four methods in `PlannedTaskService.java`**

Add:

```java
    @Transactional
    public PlannedTaskResponse update(UUID userId, UUID taskId, PlannedTaskUpdateRequest req) {
        PlannedTask t = requireOwnedTask(userId, taskId);
        if (req.title() != null) t.setTitle(req.title());
        if (req.goal() != null) t.setGoal(req.goal());
        if (req.color() != null) t.setColor(req.color());
        if (req.cadence() != null) t.setCadence(req.cadence());
        if (req.needsTimeSlot() != null) t.setNeedsTimeSlot(req.needsTimeSlot());
        if (req.startTime() != null) t.setStartTime(req.startTime());
        if (req.endTime() != null) t.setEndTime(req.endTime());
        if (req.scheduledDate() != null) t.setScheduledDate(req.scheduledDate());
        if (req.weekdays() != null) t.setWeekdaysSet(req.weekdays());
        if (req.monthDays() != null) t.setMonthDaysSet(req.monthDays());
        validate(t);
        PlannedTask saved = tasks.save(t);
        boolean completed = !completions.findCompletedTaskIds(List.of(saved.getId()), LocalDate.now()).isEmpty();
        return PlannedTaskResponse.from(saved, completed);
    }

    @Transactional
    public PlannedTaskResponse complete(UUID userId, UUID taskId, LocalDate date) {
        PlannedTask t = requireOwnedTask(userId, taskId);
        PlannedTaskCompletionId pk = new PlannedTaskCompletionId(t.getId(), date);
        if (completions.existsById(pk)) throw new TaskAlreadyCompleteException();
        completions.save(new PlannedTaskCompletion(t.getId(), date, Instant.now()));
        boolean completedToday = date.equals(LocalDate.now())
            || !completions.findCompletedTaskIds(List.of(t.getId()), LocalDate.now()).isEmpty();
        return PlannedTaskResponse.from(t, completedToday);
    }

    @Transactional
    public void uncomplete(UUID userId, UUID taskId, LocalDate date) {
        requireOwnedTask(userId, taskId);
        completions.deleteByTaskIdAndCompletedDate(taskId, date);
    }

    @Transactional
    public void delete(UUID userId, UUID taskId) {
        PlannedTask t = requireOwnedTask(userId, taskId);
        tasks.delete(t);
    }
```

- [ ] **Step 9.3: Run (expect PASS)**

```bash
./mvnw -q test -Dtest=PlannedTaskServiceTest
```

Expected: 14 passing.

- [ ] **Step 9.4: Checkpoint.**

---

## Phase D — Backend controller + integration tests

### Task 10: PlannedTaskController + integration tests

**Files:**
- Create: `apps/backend-java/src/test/java/com/timixa/backend/task/PlannedTaskControllerTest.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/task/PlannedTaskController.java`

- [ ] **Step 10.1: Write failing tests**

```java
package com.timixa.backend.task;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timixa.backend.auth.dto.RegisterRequest;
import com.timixa.backend.task.dto.PlannedTaskRequest;
import com.timixa.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class PlannedTaskControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired PlannedTaskRepository tasks;
    @Autowired PlannedTaskCompletionRepository completions;

    private String token;

    @BeforeEach
    void clean() throws Exception {
        completions.deleteAll();
        tasks.deleteAll();
        users.deleteAll();
        token = registerAndGetToken("a@b.com", "password123");
    }

    private String registerAndGetToken(String email, String pw) throws Exception {
        String resp = mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new RegisterRequest(email, pw, "Alex"))))
            .andReturn().getResponse().getContentAsString();
        return json.readTree(resp).get("token").asText();
    }

    @Test
    void post_201_for_valid_daily() throws Exception {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Gym", "Fitness", null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null);
        mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.id").exists())
           .andExpect(jsonPath("$.cadence").value("DAILY"))
           .andExpect(jsonPath("$.completedToday").value(false));
    }

    @Test
    void post_400_for_weekly_without_weekdays() throws Exception {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Run", null, null, Cadence.WEEKLY, true,
            "07:00", "08:00", null, null, null);
        mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
           .andExpect(status().isBadRequest())
           .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void post_401_without_token() throws Exception {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "X", null, null, Cadence.DAILY, true, "09:00", "10:00", null, null, null);
        mvc.perform(post("/api/planned-tasks")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
           .andExpect(status().isUnauthorized());
    }

    @Test
    void get_returns_daily_task() throws Exception {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true, "09:00", "10:00", null, null, null);
        mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)));

        mvc.perform(get("/api/planned-tasks?date=" + LocalDate.now())
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.length()").value(1))
           .andExpect(jsonPath("$[0].title").value("Gym"));
    }

    @Test
    void completion_201_then_409_then_uncomplete_204() throws Exception {
        String body = mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskRequest(
                    "Gym", null, null, Cadence.DAILY, true,
                    "09:00", "10:00", null, null, null))))
            .andReturn().getResponse().getContentAsString();
        String id = json.readTree(body).get("id").asText();

        mvc.perform(post("/api/planned-tasks/" + id + "/completions")
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.completedToday").value(true));

        mvc.perform(post("/api/planned-tasks/" + id + "/completions")
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isConflict())
           .andExpect(jsonPath("$.code").value("TASK_ALREADY_COMPLETE"));

        mvc.perform(delete("/api/planned-tasks/" + id + "/completions/" + LocalDate.now())
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isNoContent());
    }

    @Test
    void other_users_tasks_invisible() throws Exception {
        String otherToken = registerAndGetToken("z@z.com", "password123");
        mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + otherToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskRequest(
                    "Theirs", null, null, Cadence.DAILY, true,
                    "09:00", "10:00", null, null, null))));

        mvc.perform(get("/api/planned-tasks?date=" + LocalDate.now())
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void delete_204_and_subsequent_get_404() throws Exception {
        String body = mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskRequest(
                    "Gym", null, null, Cadence.DAILY, true,
                    "09:00", "10:00", null, null, null))))
            .andReturn().getResponse().getContentAsString();
        String id = json.readTree(body).get("id").asText();

        mvc.perform(delete("/api/planned-tasks/" + id)
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isNoContent());

        mvc.perform(delete("/api/planned-tasks/" + id)
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isNotFound())
           .andExpect(jsonPath("$.code").value("TASK_NOT_FOUND"));
    }
}
```

- [ ] **Step 10.2: Run (expect FAIL — controller missing)**

```bash
./mvnw -q test -Dtest=PlannedTaskControllerTest
```

Expected: 404 / compile failure.

- [ ] **Step 10.3: Create `PlannedTaskController.java`**

```java
package com.timixa.backend.task;

import com.timixa.backend.security.UserPrincipal;
import com.timixa.backend.task.dto.PlannedTaskRequest;
import com.timixa.backend.task.dto.PlannedTaskResponse;
import com.timixa.backend.task.dto.PlannedTaskUpdateRequest;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/planned-tasks")
public class PlannedTaskController {

    private final PlannedTaskService service;

    public PlannedTaskController(PlannedTaskService service) { this.service = service; }

    @GetMapping
    public List<PlannedTaskResponse> list(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(value = "date", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return date == null
            ? service.findAll(principal.id())
            : service.findForDate(principal.id(), date);
    }

    @PostMapping
    public ResponseEntity<PlannedTaskResponse> create(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody PlannedTaskRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(service.create(principal.id(), req));
    }

    @PatchMapping("/{id}")
    public PlannedTaskResponse update(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody PlannedTaskUpdateRequest req) {
        return service.update(principal.id(), id, req);
    }

    @PostMapping("/{id}/completions")
    public ResponseEntity<PlannedTaskResponse> complete(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @RequestBody(required = false) Map<String, String> body) {
        LocalDate date = (body != null && body.get("date") != null)
            ? LocalDate.parse(body.get("date"))
            : LocalDate.now();
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(service.complete(principal.id(), id, date));
    }

    @DeleteMapping("/{id}/completions/{date}")
    public ResponseEntity<Void> uncomplete(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        service.uncomplete(principal.id(), id, date);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id) {
        service.delete(principal.id(), id);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 10.4: Run (expect PASS)**

```bash
./mvnw -q test -Dtest=PlannedTaskControllerTest
```

Expected: 7 passing.

- [ ] **Step 10.5: Run full backend suite**

```bash
./mvnw -q test
```

Expected: all green (Slice 1 + Slice 2 tests).

- [ ] **Step 10.6: Checkpoint.**

---

### Task 11: Extend dev TestResetController

**Files:**
- Modify: `apps/backend-java/src/main/java/com/timixa/backend/test/TestResetController.java`

- [ ] **Step 11.1: Inject the two new repositories and truncate them before users**

Open the file and replace its body with:

```java
package com.timixa.backend.test;

import com.timixa.backend.task.PlannedTaskCompletionRepository;
import com.timixa.backend.task.PlannedTaskRepository;
import com.timixa.backend.user.UserRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/test")
@Profile("dev")
public class TestResetController {

    private final UserRepository users;
    private final PlannedTaskRepository tasks;
    private final PlannedTaskCompletionRepository completions;

    public TestResetController(UserRepository users,
                               PlannedTaskRepository tasks,
                               PlannedTaskCompletionRepository completions) {
        this.users = users;
        this.tasks = tasks;
        this.completions = completions;
    }

    @PostMapping("/reset")
    public ResponseEntity<Void> reset() {
        completions.deleteAll();
        tasks.deleteAll();
        users.deleteAll();
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 11.2: Run full backend suite**

```bash
./mvnw -q test
```

Expected: all green.

- [ ] **Step 11.3: Checkpoint.**

---

## Phase E — Frontend model + service

### Task 12: PlannedTask Angular model

**Files:**
- Create: `apps/frontend/src/app/core/models/planned-task.model.ts`

- [ ] **Step 12.1: Create the file**

```ts
export type PlannedTaskCadence = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type Weekday =
  | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY'
  | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface PlannedTask {
  id: string;
  userId: string;
  title: string;
  goal?: string;
  color: string;
  cadence: PlannedTaskCadence;
  needsTimeSlot: boolean;
  startTime?: string;       // HH:mm
  endTime?: string;
  scheduledDate?: string;   // YYYY-MM-DD
  weekdays?: Weekday[];
  monthDays?: number[];
  completedToday: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlannedTaskInput {
  title: string;
  goal?: string;
  color?: string;
  cadence: PlannedTaskCadence;
  needsTimeSlot?: boolean;
  startTime?: string;
  endTime?: string;
  scheduledDate?: string;
  weekdays?: Weekday[];
  monthDays?: number[];
}

export type PlannedTaskUpdate = Partial<PlannedTaskInput>;
```

- [ ] **Step 12.2: Verify build**

```bash
cd apps/frontend && npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 12.3: Checkpoint.**

---

### Task 13: PlannedTaskService with signal-backed state

**Files:**
- Create: `apps/frontend/src/app/core/services/planned-task.service.ts`

- [ ] **Step 13.1: Create the service**

```ts
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PlannedTask,
  PlannedTaskInput,
  PlannedTaskUpdate,
} from '../models/planned-task.model';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function hhmmNow(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class PlannedTaskService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/planned-tasks`;

  private _tasks = signal<PlannedTask[]>([]);
  readonly tasks = this._tasks.asReadonly();

  /** Re-tick once per minute so `nowTask` recomputes. */
  private _now = signal<Date>(new Date());
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  readonly nowTask = computed<PlannedTask | null>(() => {
    const now = hhmmNow(this._now());
    return (
      this._tasks()
        .filter(
          t =>
            !t.completedToday &&
            t.startTime &&
            t.endTime &&
            t.startTime <= now &&
            now < t.endTime,
        )
        .sort((a, b) => (a.startTime! < b.startTime! ? -1 : 1))[0] ?? null
    );
  });

  readonly upcomingToday = computed<PlannedTask[]>(() => {
    const now = hhmmNow(this._now());
    const current = this.nowTask();
    return this._tasks()
      .filter(
        t =>
          !t.completedToday &&
          t !== current &&
          t.startTime &&
          t.startTime >= now,
      )
      .sort((a, b) => (a.startTime! < b.startTime! ? -1 : 1));
  });

  readonly unscheduledToday = computed<PlannedTask[]>(() =>
    this._tasks().filter(t => !t.completedToday && t.needsTimeSlot && !t.startTime),
  );

  readonly completedToday = computed<PlannedTask[]>(() =>
    this._tasks().filter(t => t.completedToday),
  );

  loadToday(): Observable<PlannedTask[]> {
    return this.http
      .get<PlannedTask[]>(`${this.base}?date=${todayIso()}`)
      .pipe(tap(list => this._tasks.set(list)));
  }

  create(input: PlannedTaskInput): Observable<PlannedTask> {
    return this.http
      .post<PlannedTask>(this.base, input)
      .pipe(tap(t => this._tasks.update(list => [t, ...list])));
  }

  update(id: string, patch: PlannedTaskUpdate): Observable<PlannedTask> {
    return this.http
      .patch<PlannedTask>(`${this.base}/${id}`, patch)
      .pipe(tap(updated => this._tasks.update(list => list.map(t => (t.id === id ? updated : t)))));
  }

  complete(id: string, date: string = todayIso()): Observable<PlannedTask> {
    return this.http
      .post<PlannedTask>(`${this.base}/${id}/completions`, { date })
      .pipe(tap(updated => this._tasks.update(list => list.map(t => (t.id === id ? updated : t)))));
  }

  uncomplete(id: string, date: string = todayIso()): Observable<void> {
    return this.http
      .delete<void>(`${this.base}/${id}/completions/${date}`)
      .pipe(
        tap(() =>
          this._tasks.update(list =>
            list.map(t => (t.id === id ? { ...t, completedToday: false } : t)),
          ),
        ),
      );
  }

  scheduleForToday(id: string, startTime: string, endTime: string): Observable<PlannedTask> {
    return this.update(id, { startTime, endTime, needsTimeSlot: true });
  }

  remove(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.base}/${id}`)
      .pipe(tap(() => this._tasks.update(list => list.filter(t => t.id !== id))));
  }

  startTicker(): void {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => this._now.set(new Date()), 60_000);
  }

  stopTicker(): void {
    if (this.tickHandle) clearInterval(this.tickHandle);
    this.tickHandle = null;
  }
}
```

- [ ] **Step 13.2: Verify build**

```bash
npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 13.3: Checkpoint.**

---

## Phase F — Dashboard wiring (Now / Today's Plan / Done)

### Task 14: Dashboard — inject service + ngOnInit/ngOnDestroy ticker

**Files:**
- Modify: `apps/frontend/src/app/features/dashboard/today-dashboard/today-dashboard.component.ts`

- [ ] **Step 14.1: Add imports + inject + lifecycle hooks**

In `today-dashboard.component.ts`:

1. Add at the top, alongside existing imports:

```ts
import { OnDestroy } from '@angular/core';
import { PlannedTaskService } from '../../../core/services/planned-task.service';
```

2. Change the class declaration line to also `implements OnDestroy`:

```ts
export class TodayDashboardComponent implements OnInit, OnDestroy {
```

3. Inside the class body, alongside the existing private inject lines, add:

```ts
  private plannedTasks = inject(PlannedTaskService);
  readonly nowTask          = this.plannedTasks.nowTask;
  readonly upcomingToday    = this.plannedTasks.upcomingToday;
  readonly unscheduledToday = this.plannedTasks.unscheduledToday;
  readonly completedToday   = this.plannedTasks.completedToday;

  showDone = signal(false);
  bannerOpen = signal(false);
  schedulingId = signal<string | null>(null);
  scheduleStart = signal('');
  scheduleEnd = signal('');
```

`signal` should already be imported in this file; if not, add it to the `@angular/core` import.

4. The existing `ngOnInit` body is:

```ts
  ngOnInit(): void {
    this.habitService.load();
  }
```

Replace it with the merged version:

```ts
  ngOnInit(): void {
    this.habitService.load();
    this.plannedTasks.loadToday().subscribe();
    this.plannedTasks.startTicker();
  }

  ngOnDestroy(): void {
    this.plannedTasks.stopTicker();
  }
```

- [ ] **Step 14.2: Verify build (the new sections aren't rendered yet — just service wiring)**

```bash
npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 14.3: Checkpoint.**

---

### Task 15: Dashboard — Now card + Today's Plan + Done sections in template

**Files:**
- Modify: `apps/frontend/src/app/features/dashboard/today-dashboard/today-dashboard.component.ts`

- [ ] **Step 15.1: Insert the three sections in the template**

In `today-dashboard.component.ts`, find the closing `</section>` of the **Overall Progress Card** (the section that ends right before the comment `<!-- Habit Cards -->`). Immediately *after* that closing `</section>` and *before* the `<!-- Habit Cards -->` comment, insert:

```html
      <!-- Now card -->
      <section *ngIf="nowTask() as t" class="mb-stack-lg" data-testid="now-card">
        <p class="font-label-sm text-label-sm text-primary uppercase mb-2">Right Now</p>
        <div class="bg-surface-container-lowest rounded-[28px] p-6 shadow-card flex gap-4 items-center">
          <span class="w-2 self-stretch rounded-full" [style.background]="t.color"></span>
          <div class="flex-1 min-w-0">
            <h3 class="font-manrope font-bold text-h2 text-on-surface truncate">{{ t.title }}</h3>
            <p class="text-on-surface-variant text-sm mt-1">
              {{ t.startTime }} – {{ t.endTime }}
              <span *ngIf="t.goal" class="ml-2">· {{ t.goal }}</span>
            </p>
          </div>
          <button
            (click)="completePlanned(t.id)"
            class="btn-primary px-4 py-2"
            data-testid="now-complete">
            Complete
          </button>
        </div>
      </section>

      <!-- Today's Plan list -->
      <section *ngIf="upcomingToday().length" class="mb-stack-lg" data-testid="todays-plan">
        <h3 class="font-manrope font-bold text-[18px] text-on-surface mb-stack-md">Today's Plan</h3>
        <div class="grid gap-stack-sm">
          <div *ngFor="let t of upcomingToday()"
               class="bg-surface-container-lowest rounded-[20px] p-4 flex items-center gap-3 shadow-card"
               [attr.data-testid]="'planned-' + t.id">
            <span class="w-3 h-3 rounded-full" [style.background]="t.color"></span>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-on-surface truncate">{{ t.title }}</p>
              <p class="text-on-surface-variant text-sm">
                {{ t.startTime }} – {{ t.endTime }}<span *ngIf="t.goal"> · {{ t.goal }}</span>
              </p>
            </div>
            <button
              (click)="completePlanned(t.id)"
              class="btn-secondary px-3 py-1.5 text-sm"
              [attr.data-testid]="'complete-' + t.id">
              Complete
            </button>
          </div>
        </div>
      </section>

      <!-- Done collapsible -->
      <section *ngIf="completedToday().length" class="mb-stack-lg" data-testid="done-section">
        <button type="button"
                (click)="showDone.set(!showDone())"
                class="w-full flex items-center justify-between py-2"
                data-testid="done-toggle">
          <span class="font-semibold text-on-surface">Done ({{ completedToday().length }})</span>
          <span class="material-symbols-outlined"
                [style.transform]="showDone() ? 'rotate(180deg)' : 'rotate(0deg)'">
            expand_more
          </span>
        </button>
        <div *ngIf="showDone()" class="grid gap-stack-sm mt-2">
          <div *ngFor="let t of completedToday()"
               class="bg-surface-container-low rounded-[20px] p-3 flex items-center gap-3"
               [attr.data-testid]="'done-' + t.id">
            <span class="w-3 h-3 rounded-full opacity-50" [style.background]="t.color"></span>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-on-surface-variant line-through truncate">{{ t.title }}</p>
            </div>
            <button
              (click)="uncompletePlanned(t.id)"
              class="text-sm text-primary font-semibold"
              [attr.data-testid]="'undo-' + t.id">
              Undo
            </button>
          </div>
        </div>
      </section>
```

- [ ] **Step 15.2: Add the two handler methods in the class body**

After the existing methods in `TodayDashboardComponent`, add:

```ts
  completePlanned(id: string): void {
    this.plannedTasks.complete(id).subscribe();
  }

  uncompletePlanned(id: string): void {
    this.plannedTasks.uncomplete(id).subscribe();
  }
```

- [ ] **Step 15.3: Verify build**

```bash
npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 15.4: Checkpoint.**

---

### Task 16: Dashboard — Unscheduled banner + inline schedule popover

**Files:**
- Modify: `apps/frontend/src/app/features/dashboard/today-dashboard/today-dashboard.component.ts`

- [ ] **Step 16.1: Insert the banner above the Now card section in the template**

Find the Now-card `<section *ngIf="nowTask() as t" ...>` you added in Task 15. Immediately *before* it, insert:

```html
      <!-- Unscheduled banner -->
      <section *ngIf="unscheduledToday().length" class="mb-stack-lg" data-testid="unscheduled-banner">
        <button type="button"
                (click)="bannerOpen.set(!bannerOpen())"
                class="w-full flex items-center justify-between p-4 rounded-[20px]"
                style="background:rgba(255,209,102,0.18); border:1px solid rgba(255,179,0,0.4);"
                data-testid="unscheduled-toggle">
          <span class="font-semibold text-on-surface">
            {{ unscheduledToday().length }} task{{ unscheduledToday().length === 1 ? '' : 's' }} need a time slot today
          </span>
          <span class="material-symbols-outlined"
                [style.transform]="bannerOpen() ? 'rotate(180deg)' : 'rotate(0deg)'">
            expand_more
          </span>
        </button>

        <div *ngIf="bannerOpen()" class="mt-3 grid gap-stack-sm">
          <div *ngFor="let t of unscheduledToday()"
               class="bg-surface-container-lowest rounded-[20px] p-4 shadow-card"
               [attr.data-testid]="'unscheduled-' + t.id">
            <div class="flex items-center gap-3">
              <span class="w-3 h-3 rounded-full" [style.background]="t.color"></span>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-on-surface truncate">{{ t.title }}</p>
                <p *ngIf="t.goal" class="text-on-surface-variant text-sm">{{ t.goal }}</p>
              </div>
              <button
                *ngIf="schedulingId() !== t.id"
                (click)="openSchedule(t.id)"
                class="btn-secondary px-3 py-1.5 text-sm"
                [attr.data-testid]="'schedule-' + t.id">
                Schedule
              </button>
            </div>

            <div *ngIf="schedulingId() === t.id" class="mt-3 grid grid-cols-2 gap-2">
              <input type="time"
                     [value]="scheduleStart()"
                     (input)="scheduleStart.set($any($event.target).value)"
                     class="input-ghost"
                     [attr.data-testid]="'schedule-start-' + t.id" />
              <input type="time"
                     [value]="scheduleEnd()"
                     (input)="scheduleEnd.set($any($event.target).value)"
                     class="input-ghost"
                     [attr.data-testid]="'schedule-end-' + t.id" />
              <button
                (click)="cancelSchedule()"
                class="col-span-1 py-2 text-sm font-semibold text-on-surface-variant">
                Cancel
              </button>
              <button
                (click)="saveSchedule(t.id)"
                [disabled]="!scheduleStart() || !scheduleEnd()"
                class="col-span-1 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-40"
                style="background:#5e43fb;"
                [attr.data-testid]="'schedule-save-' + t.id">
                Save
              </button>
            </div>
          </div>
        </div>
      </section>
```

- [ ] **Step 16.2: Add the three banner handler methods in the class body**

```ts
  openSchedule(id: string): void {
    this.schedulingId.set(id);
    this.scheduleStart.set('');
    this.scheduleEnd.set('');
  }

  cancelSchedule(): void {
    this.schedulingId.set(null);
  }

  saveSchedule(id: string): void {
    const start = this.scheduleStart();
    const end = this.scheduleEnd();
    if (!start || !end) return;
    this.plannedTasks.scheduleForToday(id, start, end).subscribe({
      next: () => {
        this.schedulingId.set(null);
        if (this.unscheduledToday().length === 0) this.bannerOpen.set(false);
      },
    });
  }
```

- [ ] **Step 16.3: Verify build**

```bash
npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 16.4: Checkpoint.**

---

## Phase G — New Task form bridge

### Task 17: Rewire `createTask()` in the New Task page

**Files:**
- Modify: `apps/frontend/src/app/features/new-task/new-task.component.ts`

- [ ] **Step 17.1: Add imports + inject `PlannedTaskService`**

At the top of the file, replace the existing imports for `HabitService` and `ScheduleService` with `PlannedTaskService`. After the change the relevant import block looks like:

```ts
import { PlannedTaskService } from '../../core/services/planned-task.service';
import {
  PlannedTaskCadence,
  PlannedTaskInput,
  Weekday,
} from '../../core/models/planned-task.model';
```

Remove the lines:

```ts
import { HabitService } from '../../core/services/habit.service';
import { ScheduleService } from '../../core/services/schedule.service';
```

In the class body, replace:

```ts
  private habitService    = inject(HabitService);
  private scheduleService = inject(ScheduleService);
  private location        = inject(Location);
```

with:

```ts
  private plannedTasks = inject(PlannedTaskService);
  private location     = inject(Location);

  saving = signal(false);
  error  = signal<string | null>(null);
```

- [ ] **Step 17.2: Replace the `createTask()` method body**

Replace the entire existing `createTask()` method with:

```ts
  createTask(): void {
    const title = this.taskName().trim();
    if (!title) return;
    this.saving.set(true);
    this.error.set(null);
    this.plannedTasks.create(this.toPlannedTaskInput(title)).subscribe({
      next: () => { this.saving.set(false); this.location.back(); },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message || 'Could not save task. Please try again.');
      },
    });
  }

  private toPlannedTaskInput(title: string): PlannedTaskInput {
    const cfg = this.scheduleConfig();
    const isTimeTask = this.taskType() === 'time';
    const minutes = isTimeTask ? this.targetMinutes() : 30;

    let cadence: PlannedTaskCadence = 'DAILY';
    let weekdays: Weekday[] | undefined;
    let monthDays: number[] | undefined;

    if (this.isScheduled() && cfg) {
      switch (cfg.frequency) {
        case 'daily':   cadence = 'DAILY'; break;
        case 'weekly':  cadence = 'WEEKLY'; weekdays = this.mapWeeklyDays(cfg.weeklyDays); break;
        case 'monthly': cadence = 'MONTHLY'; monthDays = [new Date().getDate()]; break;
        default:        cadence = 'DAILY';
      }
    }

    let startTime: string | undefined;
    let endTime: string | undefined;
    if (this.isScheduled() && cfg?.startTime) {
      startTime = cfg.startTime;
      endTime = cfg.endTime || this.addMinutesToTime(cfg.startTime, minutes);
    }

    return {
      title,
      goal: this.selectedGoal(),
      color: '#451de3',
      cadence,
      needsTimeSlot: true,
      startTime,
      endTime,
      weekdays,
      monthDays,
    };
  }

  private mapWeeklyDays(days: string[] | undefined): Weekday[] | undefined {
    if (!days || !days.length) return undefined;
    const map: Record<string, Weekday> = {
      mon: 'MONDAY', tue: 'TUESDAY', wed: 'WEDNESDAY', thu: 'THURSDAY',
      fri: 'FRIDAY', sat: 'SATURDAY', sun: 'SUNDAY',
    };
    const out: Weekday[] = [];
    for (const d of days) {
      const w = map[d.toLowerCase()];
      if (w) out.push(w);
    }
    return out.length ? out : undefined;
  }
```

Leave the existing `addMinutesToTime`, `goBack`, and all signal/computed declarations untouched.

- [ ] **Step 17.3: Show the error under the bottom button**

In the template, find the bottom "Sticky Bottom" `<div>` containing the `Create Task` button. Immediately *above* the `<button (click)="createTask()" ...>` line and *inside* the same `<div>`, add:

```html
      <p *ngIf="error()" class="text-red-500 text-sm mb-3 text-center" data-testid="new-task-error">
        {{ error() }}
      </p>
```

- [ ] **Step 17.4: Verify build**

```bash
npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 17.5: Checkpoint.**

---

## Phase H — E2E

### Task 18: Playwright spec for Slice 2

**Files:**
- Create: `apps/e2e/tests/planned-tasks.spec.ts`

- [ ] **Step 18.1: Create the spec**

```ts
import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8080/api';

async function resetDb(page: Page) {
  await page.request.post(`${API}/test/reset`);
}

async function uniqueEmail() {
  return `s2-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;
}

async function registerAndOnboard(page: Page) {
  const email = await uniqueEmail();
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('S2 User');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('password123');
  await page.getByTestId('register-submit').click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByTestId('onboarding-age').fill('28');
  await page.getByTestId('onboarding-occupation').fill('Engineer');
  await page.getByTestId('onboarding-bedtime').fill('22:30');
  await page.getByTestId('onboarding-waketime').fill('06:30');
  await page.getByTestId('onboarding-submit').click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function getToken(page: Page): Promise<string> {
  return await page.evaluate(() => localStorage.getItem('timixa_token')!);
}

async function createTaskViaApi(page: Page, body: any) {
  const token = await getToken(page);
  const res = await page.request.post(`${API}/planned-tasks`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test.beforeEach(async ({ page }) => {
  await resetDb(page);
  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('dashboard is empty when no planned tasks', async ({ page }) => {
  await registerAndOnboard(page);
  await expect(page.getByTestId('now-card')).toHaveCount(0);
  await expect(page.getByTestId('todays-plan')).toHaveCount(0);
  await expect(page.getByTestId('unscheduled-banner')).toHaveCount(0);
  await expect(page.getByTestId('done-section')).toHaveCount(0);
});

test('Now card shows for in-window DAILY task', async ({ page }) => {
  await registerAndOnboard(page);
  const now = new Date();
  const start = `${String(now.getHours()).padStart(2, '0')}:00`;
  const endHour = (now.getHours() + 1) % 24;
  const end = `${String(endHour).padStart(2, '0')}:00`;
  await createTaskViaApi(page, {
    title: 'Gym', goal: 'Fitness', cadence: 'DAILY',
    needsTimeSlot: true, startTime: start, endTime: end,
  });
  await page.reload();
  await expect(page.getByTestId('now-card')).toBeVisible();
  await expect(page.getByTestId('now-card')).toContainText('Gym');
});

test('clicking Complete moves task to Done', async ({ page }) => {
  await registerAndOnboard(page);
  const now = new Date();
  const start = `${String(now.getHours()).padStart(2, '0')}:00`;
  const endHour = (now.getHours() + 1) % 24;
  const end = `${String(endHour).padStart(2, '0')}:00`;
  await createTaskViaApi(page, {
    title: 'Gym', cadence: 'DAILY',
    needsTimeSlot: true, startTime: start, endTime: end,
  });
  await page.reload();
  await page.getByTestId('now-complete').click();
  await expect(page.getByTestId('now-card')).toHaveCount(0);
  await page.getByTestId('done-toggle').click();
  await expect(page.getByTestId('done-section')).toContainText('Gym');
});

test('unscheduled banner schedules a task inline', async ({ page }) => {
  await registerAndOnboard(page);
  const created = await createTaskViaApi(page, {
    title: 'Read', cadence: 'DAILY', needsTimeSlot: true,
  });
  await page.reload();
  await expect(page.getByTestId('unscheduled-banner')).toBeVisible();
  await page.getByTestId('unscheduled-toggle').click();
  await page.getByTestId(`schedule-${created.id}`).click();
  await page.getByTestId(`schedule-start-${created.id}`).fill('14:00');
  await page.getByTestId(`schedule-end-${created.id}`).fill('15:00');
  await page.getByTestId(`schedule-save-${created.id}`).click();
  await expect(page.getByTestId('unscheduled-banner')).toHaveCount(0);
  await expect(page.getByTestId('todays-plan')).toContainText('Read');
});

test('New Task page persists a DAILY task that shows on dashboard', async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto('/new-task');
  await page.locator('input[placeholder="e.g., Study, Exercise"]').fill('Stretch');
  await page.getByRole('button', { name: 'Create Task' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId('unscheduled-banner')).toBeVisible();
  await expect(page.getByTestId('unscheduled-banner')).toContainText('Stretch');
});

test('WEEKLY task with non-matching weekday does not show', async ({ page }) => {
  await registerAndOnboard(page);
  const tomorrow = new Date(Date.now() + 86400000)
    .toLocaleString('en-US', { weekday: 'long' })
    .toUpperCase();
  await createTaskViaApi(page, {
    title: 'Run', cadence: 'WEEKLY',
    weekdays: [tomorrow],
    needsTimeSlot: true, startTime: '07:00', endTime: '08:00',
  });
  await page.reload();
  await expect(page.getByTestId('now-card')).toHaveCount(0);
  await expect(page.getByTestId('todays-plan')).toHaveCount(0);
  await expect(page.getByTestId('unscheduled-banner')).toHaveCount(0);
});

test('user isolation — other user\'s tasks invisible', async ({ page, browser }) => {
  await registerAndOnboard(page);
  await createTaskViaApi(page, {
    title: 'Mine', cadence: 'DAILY', needsTimeSlot: true,
    startTime: '09:00', endTime: '10:00',
  });

  const other = await browser.newContext();
  const p2 = await other.newPage();
  await resetDb(p2);
  await p2.goto('/');
  await p2.evaluate(() => localStorage.clear());
  await registerAndOnboard(p2);
  await expect(p2.getByTestId('todays-plan')).toHaveCount(0);
  await other.close();
});
```

> The "user isolation" test resets the DB twice within its own setup (so it stands alone). It only inspects `p2`'s dashboard — `page`'s state is acceptable to lose.

- [ ] **Step 18.2: Run Slice 2 e2e**

```bash
cd apps/e2e && ../../node_modules/.bin/playwright test tests/planned-tasks.spec.ts
```

Expected: 7 passing. The webServer config from Slice 1 auto-starts Express, Spring Boot, and Angular.

- [ ] **Step 18.3: Run the full e2e suite to check Slice 1 still passes**

```bash
../../node_modules/.bin/playwright test
```

Expected: 14 passing (7 from Slice 1 + 7 from Slice 2).

- [ ] **Step 18.4: Checkpoint.**

---

## Phase I — Final verification

### Task 19: Full slice verification

- [ ] **Step 19.1: Backend test suite (green)**

```bash
cd apps/backend-java && ./mvnw -q test
```

Expected: all tests pass (Slice 1 + Slice 2).

- [ ] **Step 19.2: Frontend production build (green)**

```bash
cd ../frontend && npx ng build
```

Expected: BUILD SUCCESS (warnings about chunk size are OK).

- [ ] **Step 19.3: Playwright suite (green)**

```bash
cd ../e2e && ../../node_modules/.bin/playwright test
```

Expected: 14 passing.

- [ ] **Step 19.4: Manual walk-through (mirrors design § 11)**

Start all three servers, register a fresh user, onboard. Then:

1. Dashboard is empty.
2. Open New Task → enter "Gym" → Create. Returns to dashboard. Verify the Unscheduled banner appears (no schedule was set).
3. Click banner → Schedule on the row → fill 09:00 / 10:00 → Save. Verify it moves to Today's Plan.
4. Reload — state persists.
5. Click Complete on the Today's Plan row. Verify it moves to Done. Expand Done. Click Undo. Verify it returns to Today's Plan.
6. From the API, `POST /api/planned-tasks/{id}/completions` again (or click Complete in the UI). Verify Done count = 1.
7. Reset DB: `curl -X POST :8080/api/test/reset`. Reload — dashboard back to empty.

- [ ] **Step 19.5: Final checkpoint.** Slice 2 is complete. Ready for Slice 3 (constraints + schedule pages).

---

## Spec coverage check

| Spec section | Implementing tasks |
|---|---|
| § 4 Domain model — entities, validation, "applies on date" | Tasks 1, 2, 3, 4, 7, 8 |
| § 5 REST API — endpoints, error envelope | Tasks 5, 6, 10 |
| § 6 Spring Boot package layout | Tasks 1–10 (delivers the full `task/` package) |
| § 7 Frontend wiring — model, service, dashboard sections | Tasks 12, 13, 14, 15, 16 |
| § 8 Frontend ↔ backend interaction happy path | Tasks 13, 14, 15 |
| § 9 New Task page bridging | Task 17 |
| § 10 Testing — backend unit/integration, frontend, Playwright | Tasks 7, 8, 9, 10, 18 |
| § 11 Verification | Task 19 |
| § 11 TestResetController extension | Task 11 |
