# Timixa Slice 3 — Schedule Pages + Exceptions + Constraints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the day and week schedule pages to `PlannedTaskService` with drag-and-drop, introduce a per-date exception model (SKIP/ADD) with an "apply permanently" popup, add two optional constraint fields (Time min/max minutes, Count min/max) to `PlannedTask`, and convert the month + calendar views to read-only renderings of planned tasks.

**Architecture:** New `PlannedTaskException` entity + service + endpoints (`POST/DELETE /api/planned-tasks/{id}/exceptions[/{date}]`). Extended `PlannedTask` with four nullable INT4 constraint columns. `PlannedTaskService.appliesOn(t, date)` consults exceptions. Frontend rewrites `schedule-day` + `schedule-week` around `PlannedTaskService`, with a shared `<exception-popup>`. New Task page drops the old task-type UI and replaces it with two optional constraint cards (Time, Count).

**Tech Stack:** Spring Boot 3.3, Java 20, JPA, Flyway, H2 dev / CockroachDB prod. Angular 17 standalone components + signals. Playwright (existing workspace).

**Spec:** `docs/superpowers/specs/2026-06-07-timixa-slice3-schedule-and-constraints-design.md`

**Git policy:** User does git manually. Where this plan says "Checkpoint", verify the listed tests/builds pass, then stop and tell the user the work is ready to stage.

---

## File structure (locked before tasks start)

```
apps/backend-java/                                  MODIFY
├── src/main/java/com/timixa/backend/
│   ├── task/
│   │   ├── ExceptionType.java                      NEW enum
│   │   ├── PlannedTask.java                        edited: 4 new fields + getters/setters
│   │   ├── PlannedTaskException.java               NEW entity
│   │   ├── PlannedTaskExceptionId.java             NEW composite PK
│   │   ├── PlannedTaskExceptionRepository.java     NEW
│   │   ├── PlannedTaskExceptionService.java        NEW
│   │   ├── PlannedTaskExceptionController.java     NEW (POST/DELETE endpoints)
│   │   ├── PlannedTaskService.java                 edited: appliesOn(date) reads exceptions; constraint validation; PlannedTaskResponse mapping
│   │   ├── PlannedTaskController.java              unchanged (DTOs change handles it)
│   │   └── dto/
│   │       ├── PlannedTaskRequest.java             edited: 4 nullable constraint fields
│   │       ├── PlannedTaskUpdateRequest.java       edited: 4 nullable constraint fields
│   │       ├── PlannedTaskResponse.java            edited: constraints + exceptions list
│   │       ├── PlannedTaskExceptionRequest.java    NEW
│   │       └── PlannedTaskExceptionResponse.java   NEW
│   └── common/
│       ├── ExceptionNotAllowedException.java       NEW
│       ├── ExceptionAlreadyExistsException.java    NEW
│       └── GlobalExceptionHandler.java             edited: 2 new handlers
├── src/main/resources/
│   └── db/migration/V3__planned_task_constraints_and_exceptions.sql   NEW
└── src/test/java/com/timixa/backend/task/
    ├── PlannedTaskServiceTest.java                 edited: constraint + appliesOn-with-exceptions tests
    ├── PlannedTaskControllerTest.java              edited: constraint + exceptions array round-trip
    └── PlannedTaskExceptionControllerTest.java     NEW

apps/frontend/                                      MODIFY
└── src/app/
    ├── core/
    │   ├── models/planned-task.model.ts            edited: 4 constraint fields + PlannedTaskException + exceptions array
    │   └── services/planned-task.service.ts        edited: addException, removeException, applyPermanently, loadForDate, loadForWeek
    └── features/
        ├── new-task/
        │   └── new-task.component.ts               edited: remove task-type UI; add 2 constraint cards; field mapping
        └── schedule/
            ├── exception-popup.component.ts        NEW
            ├── schedule-day/schedule-day.component.ts        rewrite
            ├── schedule-week/schedule-week.component.ts      rewrite
            ├── schedule-month/schedule-month.component.ts    rewrite (read-only)
            └── calendar/calendar.component.ts                rewrite (read-only)

apps/e2e/tests/                                     NEW + MODIFY
├── schedule-day.spec.ts                            NEW
├── schedule-week.spec.ts                           NEW
└── new-task-constraints.spec.ts                    NEW
```

---

## Phase A — Backend domain (entities + migration)

### Task 1: ExceptionType enum + V3 migration

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/task/ExceptionType.java`
- Create: `apps/backend-java/src/main/resources/db/migration/V3__planned_task_constraints_and_exceptions.sql`

- [ ] **Step 1.1: Create `ExceptionType.java`**

```java
package com.timixa.backend.task;

public enum ExceptionType { SKIP, ADD }
```

- [ ] **Step 1.2: Create the V3 migration**

```sql
ALTER TABLE planned_tasks
  ADD COLUMN min_time_minutes INT4,
  ADD COLUMN max_time_minutes INT4,
  ADD COLUMN min_count        INT4,
  ADD COLUMN max_count        INT4;

CREATE TABLE planned_task_exceptions (
  task_id        UUID NOT NULL REFERENCES planned_tasks(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  exception_type VARCHAR(8) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (task_id, exception_date)
);
```

- [ ] **Step 1.3: Compile**

```bash
cd apps/backend-java && ./mvnw -q compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 1.4: Checkpoint.**

---

### Task 2: PlannedTaskException entity + composite PK

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/task/PlannedTaskExceptionId.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/task/PlannedTaskException.java`

- [ ] **Step 2.1: `PlannedTaskExceptionId.java`**

```java
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
```

- [ ] **Step 2.2: `PlannedTaskException.java`**

```java
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
```

- [ ] **Step 2.3: Compile**

```bash
./mvnw -q compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 2.4: Checkpoint.**

---

### Task 3: Exception repository

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/task/PlannedTaskExceptionRepository.java`

- [ ] **Step 3.1: Create the repository**

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

public interface PlannedTaskExceptionRepository
        extends JpaRepository<PlannedTaskException, PlannedTaskExceptionId> {

    List<PlannedTaskException> findByTaskIdIn(Collection<UUID> taskIds);

    List<PlannedTaskException> findByTaskIdAndExceptionDateBetween(
            UUID taskId, LocalDate from, LocalDate to);

    @Modifying
    @Transactional
    void deleteByTaskIdAndExceptionDate(UUID taskId, LocalDate exceptionDate);

    @Modifying
    @Transactional
    void deleteByTaskId(UUID taskId);
}
```

- [ ] **Step 3.2: Compile**

```bash
./mvnw -q compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 3.3: Checkpoint.**

---

### Task 4: Extend PlannedTask entity with constraint columns

**Files:**
- Modify: `apps/backend-java/src/main/java/com/timixa/backend/task/PlannedTask.java`

- [ ] **Step 4.1: Add four fields + getters/setters**

In `PlannedTask.java`, add these fields after the existing `monthDays` field (around line where `monthDays` ends):

```java
    @Column(name = "min_time_minutes")
    private Integer minTimeMinutes;

    @Column(name = "max_time_minutes")
    private Integer maxTimeMinutes;

    @Column(name = "min_count")
    private Integer minCount;

    @Column(name = "max_count")
    private Integer maxCount;
```

Add getters/setters at the bottom of the getters/setters block (before `getCreatedAt`):

```java
    public Integer getMinTimeMinutes() { return minTimeMinutes; }
    public void setMinTimeMinutes(Integer v) { this.minTimeMinutes = v; }
    public Integer getMaxTimeMinutes() { return maxTimeMinutes; }
    public void setMaxTimeMinutes(Integer v) { this.maxTimeMinutes = v; }
    public Integer getMinCount() { return minCount; }
    public void setMinCount(Integer v) { this.minCount = v; }
    public Integer getMaxCount() { return maxCount; }
    public void setMaxCount(Integer v) { this.maxCount = v; }
```

- [ ] **Step 4.2: Compile**

```bash
./mvnw -q compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 4.3: Checkpoint.**

---

## Phase B — Backend exceptions + DTOs

### Task 5: New custom exceptions + wire into GlobalExceptionHandler

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/common/ExceptionNotAllowedException.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/common/ExceptionAlreadyExistsException.java`
- Modify: `apps/backend-java/src/main/java/com/timixa/backend/common/GlobalExceptionHandler.java`

- [ ] **Step 5.1: `ExceptionNotAllowedException.java`**

```java
package com.timixa.backend.common;
public class ExceptionNotAllowedException extends RuntimeException {
    public ExceptionNotAllowedException(String message) { super(message); }
}
```

- [ ] **Step 5.2: `ExceptionAlreadyExistsException.java`**

```java
package com.timixa.backend.common;
public class ExceptionAlreadyExistsException extends RuntimeException {
    public ExceptionAlreadyExistsException() { super("Exception already exists for that date"); }
}
```

- [ ] **Step 5.3: Add two handlers to `GlobalExceptionHandler.java`**

Open the file. Locate the catch-all `@ExceptionHandler(Exception.class)` handler. Add the following two handlers immediately above it:

```java
    @ExceptionHandler(ExceptionNotAllowedException.class)
    public ResponseEntity<ErrorResponse> handleExceptionNotAllowed(ExceptionNotAllowedException e) {
        return ResponseEntity.badRequest()
            .body(ErrorResponse.of("EXCEPTION_NOT_ALLOWED", e.getMessage()));
    }

    @ExceptionHandler(ExceptionAlreadyExistsException.class)
    public ResponseEntity<ErrorResponse> handleExceptionAlreadyExists(ExceptionAlreadyExistsException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(ErrorResponse.of("EXCEPTION_ALREADY_EXISTS", e.getMessage()));
    }
```

- [ ] **Step 5.4: Compile**

```bash
./mvnw -q compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 5.5: Checkpoint.**

---

### Task 6: Exception DTOs

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/task/dto/PlannedTaskExceptionRequest.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/task/dto/PlannedTaskExceptionResponse.java`

- [ ] **Step 6.1: `PlannedTaskExceptionRequest.java`**

```java
package com.timixa.backend.task.dto;

import com.timixa.backend.task.ExceptionType;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record PlannedTaskExceptionRequest(
    @NotNull LocalDate date,
    @NotNull ExceptionType type
) {}
```

- [ ] **Step 6.2: `PlannedTaskExceptionResponse.java`**

```java
package com.timixa.backend.task.dto;

import com.timixa.backend.task.ExceptionType;
import com.timixa.backend.task.PlannedTaskException;

import java.time.LocalDate;

public record PlannedTaskExceptionResponse(
    LocalDate date,
    ExceptionType type
) {
    public static PlannedTaskExceptionResponse from(PlannedTaskException e) {
        return new PlannedTaskExceptionResponse(e.getExceptionDate(), e.getExceptionType());
    }
}
```

- [ ] **Step 6.3: Compile**

```bash
./mvnw -q compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 6.4: Checkpoint.**

---

### Task 7: Extend PlannedTask DTOs with constraint fields + exceptions

**Files:**
- Modify: `apps/backend-java/src/main/java/com/timixa/backend/task/dto/PlannedTaskRequest.java`
- Modify: `apps/backend-java/src/main/java/com/timixa/backend/task/dto/PlannedTaskUpdateRequest.java`
- Modify: `apps/backend-java/src/main/java/com/timixa/backend/task/dto/PlannedTaskResponse.java`

- [ ] **Step 7.1: Replace `PlannedTaskRequest.java`**

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
    Set<@Min(1) @Max(31) Integer> monthDays,
    @Min(1) Integer minTimeMinutes,
    @Min(1) Integer maxTimeMinutes,
    @Min(1) Integer minCount,
    @Min(1) Integer maxCount
) {}
```

- [ ] **Step 7.2: Replace `PlannedTaskUpdateRequest.java`**

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
    Set<@Min(1) @Max(31) Integer> monthDays,
    @Min(1) Integer minTimeMinutes,
    @Min(1) Integer maxTimeMinutes,
    @Min(1) Integer minCount,
    @Min(1) Integer maxCount
) {}
```

- [ ] **Step 7.3: Replace `PlannedTaskResponse.java`**

```java
package com.timixa.backend.task.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.timixa.backend.task.Cadence;
import com.timixa.backend.task.PlannedTask;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
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
    Integer minTimeMinutes,
    Integer maxTimeMinutes,
    Integer minCount,
    Integer maxCount,
    List<PlannedTaskExceptionResponse> exceptions,
    boolean completedToday,
    Instant createdAt, Instant updatedAt
) {
    public static PlannedTaskResponse from(
            PlannedTask t,
            List<PlannedTaskExceptionResponse> exceptions,
            boolean completedToday) {
        return new PlannedTaskResponse(
            t.getId(), t.getUserId(), t.getTitle(), t.getGoal(), t.getColor(),
            t.getCadence(), t.isNeedsTimeSlot(),
            t.getStartTime(), t.getEndTime(),
            t.getScheduledDate(),
            t.getWeekdaysSet().isEmpty() ? null : t.getWeekdaysSet(),
            t.getMonthDaysSet().isEmpty() ? null : t.getMonthDaysSet(),
            t.getMinTimeMinutes(),
            t.getMaxTimeMinutes(),
            t.getMinCount(),
            t.getMaxCount(),
            exceptions == null ? List.of() : exceptions,
            completedToday,
            t.getCreatedAt(), t.getUpdatedAt()
        );
    }
}
```

- [ ] **Step 7.4: Compile (expect failures in `PlannedTaskService` because `from(t, completedToday)` no longer exists)**

```bash
./mvnw -q compile
```

Expected: compile errors referencing `PlannedTaskResponse.from(PlannedTask, boolean)` — these are fixed in Task 11 + 12.

- [ ] **Step 7.5: Checkpoint** — note that compilation will be broken until Task 12; this is intentional staging.

---

## Phase C — Backend service updates

### Task 8: Add `appliesOn` overload + exception map; update PlannedTaskService

**Files:**
- Modify: `apps/backend-java/src/main/java/com/timixa/backend/task/PlannedTaskService.java`

This task only changes the static helper `appliesOn` to accept an exceptions map. The full re-mapping happens in Task 11.

- [ ] **Step 8.1: Add a new package-private method**

In `PlannedTaskService.java`, locate the existing `appliesOn(PlannedTask t, LocalDate date)` method. Add a new overload immediately above it:

```java
    static boolean appliesOn(PlannedTask t,
                             LocalDate date,
                             java.util.Map<LocalDate, ExceptionType> exceptionsForTask) {
        ExceptionType ex = exceptionsForTask == null ? null : exceptionsForTask.get(date);
        return switch (t.getCadence()) {
            case ONCE -> date.equals(t.getScheduledDate());
            case DAILY -> ex != ExceptionType.SKIP;
            case WEEKLY -> {
                boolean covered = t.getWeekdaysSet().contains(date.getDayOfWeek());
                yield (covered && ex != ExceptionType.SKIP) || (!covered && ex == ExceptionType.ADD);
            }
            case MONTHLY -> {
                boolean covered = t.getMonthDaysSet().contains(date.getDayOfMonth());
                yield (covered && ex != ExceptionType.SKIP) || (!covered && ex == ExceptionType.ADD);
            }
        };
    }
```

> The existing `appliesOn(t, date)` stays for compatibility; it is updated in Task 11 to delegate.

- [ ] **Step 8.2: Compile**

```bash
./mvnw -q compile
```

Expected: errors from Task 7 still present; this task's code compiles independently.

- [ ] **Step 8.3: Checkpoint.**

---

### Task 9: PlannedTaskExceptionService (TDD)

**Files:**
- Create: `apps/backend-java/src/test/java/com/timixa/backend/task/PlannedTaskExceptionServiceTest.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/task/PlannedTaskExceptionService.java`

- [ ] **Step 9.1: Write the test file** (will not compile until the service is added in 9.3)

```java
package com.timixa.backend.task;

import com.timixa.backend.common.ExceptionAlreadyExistsException;
import com.timixa.backend.common.ExceptionNotAllowedException;
import com.timixa.backend.common.TaskNotFoundException;
import com.timixa.backend.task.dto.PlannedTaskExceptionRequest;
import com.timixa.backend.task.dto.PlannedTaskRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("dev")
class PlannedTaskExceptionServiceTest {

    @Autowired PlannedTaskService taskService;
    @Autowired PlannedTaskExceptionService exService;
    @Autowired PlannedTaskRepository tasks;
    @Autowired PlannedTaskExceptionRepository exceptions;
    @Autowired PlannedTaskCompletionRepository completions;

    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void clean() {
        exceptions.deleteAll();
        completions.deleteAll();
        tasks.deleteAll();
    }

    @Test
    void weekly_add_on_uncovered_date_ok() {
        UUID id = createWeekly(Set.of(DayOfWeek.MONDAY));
        LocalDate tue = mostRecent(DayOfWeek.TUESDAY);
        exService.addException(userId, id, new PlannedTaskExceptionRequest(tue, ExceptionType.ADD));
        assertThat(exceptions.findByTaskIdIn(java.util.List.of(id))).hasSize(1);
    }

    @Test
    void weekly_skip_on_covered_date_ok() {
        UUID id = createWeekly(Set.of(DayOfWeek.MONDAY));
        LocalDate mon = mostRecent(DayOfWeek.MONDAY);
        exService.addException(userId, id, new PlannedTaskExceptionRequest(mon, ExceptionType.SKIP));
        assertThat(exceptions.findByTaskIdIn(java.util.List.of(id))).hasSize(1);
    }

    @Test
    void once_any_exception_rejected() {
        UUID id = createOnce(LocalDate.now());
        assertThatThrownBy(() ->
            exService.addException(userId, id, new PlannedTaskExceptionRequest(LocalDate.now(), ExceptionType.SKIP)))
            .isInstanceOf(ExceptionNotAllowedException.class);
    }

    @Test
    void daily_add_rejected() {
        UUID id = createDaily();
        assertThatThrownBy(() ->
            exService.addException(userId, id, new PlannedTaskExceptionRequest(LocalDate.now(), ExceptionType.ADD)))
            .isInstanceOf(ExceptionNotAllowedException.class);
    }

    @Test
    void weekly_add_on_covered_date_rejected_noop() {
        UUID id = createWeekly(Set.of(DayOfWeek.MONDAY));
        LocalDate mon = mostRecent(DayOfWeek.MONDAY);
        assertThatThrownBy(() ->
            exService.addException(userId, id, new PlannedTaskExceptionRequest(mon, ExceptionType.ADD)))
            .isInstanceOf(ExceptionNotAllowedException.class);
    }

    @Test
    void weekly_skip_on_uncovered_date_rejected_noop() {
        UUID id = createWeekly(Set.of(DayOfWeek.MONDAY));
        LocalDate tue = mostRecent(DayOfWeek.TUESDAY);
        assertThatThrownBy(() ->
            exService.addException(userId, id, new PlannedTaskExceptionRequest(tue, ExceptionType.SKIP)))
            .isInstanceOf(ExceptionNotAllowedException.class);
    }

    @Test
    void duplicate_409() {
        UUID id = createDaily();
        LocalDate d = LocalDate.now();
        exService.addException(userId, id, new PlannedTaskExceptionRequest(d, ExceptionType.SKIP));
        assertThatThrownBy(() ->
            exService.addException(userId, id, new PlannedTaskExceptionRequest(d, ExceptionType.SKIP)))
            .isInstanceOf(ExceptionAlreadyExistsException.class);
    }

    @Test
    void remove_404_when_task_not_owned() {
        UUID id = createDaily();
        exService.addException(userId, id, new PlannedTaskExceptionRequest(LocalDate.now(), ExceptionType.SKIP));
        assertThatThrownBy(() ->
            exService.removeException(UUID.randomUUID(), id, LocalDate.now()))
            .isInstanceOf(TaskNotFoundException.class);
    }

    @Test
    void remove_clears_row() {
        UUID id = createDaily();
        LocalDate d = LocalDate.now();
        exService.addException(userId, id, new PlannedTaskExceptionRequest(d, ExceptionType.SKIP));
        exService.removeException(userId, id, d);
        assertThat(exceptions.findByTaskIdIn(java.util.List.of(id))).isEmpty();
    }

    private UUID createDaily() {
        return taskService.create(userId, new PlannedTaskRequest(
            "Daily", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null,
            null, null, null, null)).id();
    }

    private UUID createWeekly(Set<DayOfWeek> weekdays) {
        return taskService.create(userId, new PlannedTaskRequest(
            "Weekly", null, null, Cadence.WEEKLY, true,
            "09:00", "10:00", null, weekdays, null,
            null, null, null, null)).id();
    }

    private UUID createOnce(LocalDate date) {
        return taskService.create(userId, new PlannedTaskRequest(
            "Once", null, null, Cadence.ONCE, true,
            "09:00", "10:00", date, null, null,
            null, null, null, null)).id();
    }

    private LocalDate mostRecent(DayOfWeek dow) {
        LocalDate d = LocalDate.now();
        while (d.getDayOfWeek() != dow) d = d.minusDays(1);
        return d;
    }
}
```

- [ ] **Step 9.2: Run (expect FAIL — `PlannedTaskExceptionService` doesn't exist)**

```bash
./mvnw -q test -Dtest=PlannedTaskExceptionServiceTest
```

Expected: compile error.

- [ ] **Step 9.3: Implement `PlannedTaskExceptionService.java`**

```java
package com.timixa.backend.task;

import com.timixa.backend.common.ExceptionAlreadyExistsException;
import com.timixa.backend.common.ExceptionNotAllowedException;
import com.timixa.backend.common.TaskNotFoundException;
import com.timixa.backend.task.dto.PlannedTaskExceptionRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Service
public class PlannedTaskExceptionService {

    private final PlannedTaskRepository tasks;
    private final PlannedTaskExceptionRepository exceptions;
    private final PlannedTaskService taskService;

    public PlannedTaskExceptionService(PlannedTaskRepository tasks,
                                       PlannedTaskExceptionRepository exceptions,
                                       PlannedTaskService taskService) {
        this.tasks = tasks;
        this.exceptions = exceptions;
        this.taskService = taskService;
    }

    @Transactional
    public void addException(UUID userId, UUID taskId, PlannedTaskExceptionRequest req) {
        PlannedTask t = taskService.requireOwnedTask(userId, taskId);
        validate(t, req);
        if (exceptions.existsById(new PlannedTaskExceptionId(taskId, req.date())))
            throw new ExceptionAlreadyExistsException();
        exceptions.save(new PlannedTaskException(taskId, req.date(), req.type(), Instant.now()));
    }

    @Transactional
    public void removeException(UUID userId, UUID taskId, LocalDate date) {
        taskService.requireOwnedTask(userId, taskId);
        exceptions.deleteByTaskIdAndExceptionDate(taskId, date);
    }

    private void validate(PlannedTask t, PlannedTaskExceptionRequest req) {
        Cadence c = t.getCadence();
        if (c == Cadence.ONCE)
            throw new ExceptionNotAllowedException("Exceptions are not allowed on ONCE tasks");
        if (c == Cadence.DAILY && req.type() == ExceptionType.ADD)
            throw new ExceptionNotAllowedException("ADD exception is not allowed on DAILY tasks");

        boolean covered = switch (c) {
            case DAILY -> true;
            case WEEKLY -> t.getWeekdaysSet().contains(req.date().getDayOfWeek());
            case MONTHLY -> t.getMonthDaysSet().contains(req.date().getDayOfMonth());
            case ONCE -> false; // unreachable
        };

        if (req.type() == ExceptionType.ADD && covered)
            throw new ExceptionNotAllowedException("ADD on a date already covered by cadence is a no-op");
        if (req.type() == ExceptionType.SKIP && !covered)
            throw new ExceptionNotAllowedException("SKIP on a date not covered by cadence is a no-op");
    }
}
```

- [ ] **Step 9.4: Make `PlannedTaskService.requireOwnedTask` public-package**

In `PlannedTaskService.java`, the method `requireOwnedTask(UUID userId, UUID taskId)` is currently package-private (no modifier). Leave it package-private — `PlannedTaskExceptionService` is in the same package, so it can call it.

- [ ] **Step 9.5: Run (expect PASS)** — note that the helper methods in the test use the new 15-field `PlannedTaskRequest` constructor; this is intentional given the DTO changes in Task 7.

```bash
./mvnw -q test -Dtest=PlannedTaskExceptionServiceTest
```

Expected: 9 passing.

- [ ] **Step 9.6: Checkpoint.**

---

### Task 10: PlannedTaskExceptionController + integration tests

**Files:**
- Create: `apps/backend-java/src/test/java/com/timixa/backend/task/PlannedTaskExceptionControllerTest.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/task/PlannedTaskExceptionController.java`

- [ ] **Step 10.1: Write the test**

```java
package com.timixa.backend.task;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timixa.backend.auth.dto.RegisterRequest;
import com.timixa.backend.task.dto.PlannedTaskExceptionRequest;
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

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class PlannedTaskExceptionControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired PlannedTaskRepository tasks;
    @Autowired PlannedTaskExceptionRepository exceptions;
    @Autowired PlannedTaskCompletionRepository completions;

    private String token;

    @BeforeEach
    void clean() throws Exception {
        exceptions.deleteAll();
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

    private String createWeekly(Set<DayOfWeek> weekdays) throws Exception {
        String body = mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskRequest(
                    "Weekly", null, null, Cadence.WEEKLY, true,
                    "09:00", "10:00", null, weekdays, null,
                    null, null, null, null))))
            .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asText();
    }

    private LocalDate mostRecent(DayOfWeek dow) {
        LocalDate d = LocalDate.now();
        while (d.getDayOfWeek() != dow) d = d.minusDays(1);
        return d;
    }

    @Test
    void post_201_for_add_on_uncovered_date() throws Exception {
        String id = createWeekly(Set.of(DayOfWeek.MONDAY));
        LocalDate tue = mostRecent(DayOfWeek.TUESDAY);
        mvc.perform(post("/api/planned-tasks/" + id + "/exceptions")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskExceptionRequest(tue, ExceptionType.ADD))))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.exceptions[0].date").value(tue.toString()))
           .andExpect(jsonPath("$.exceptions[0].type").value("ADD"));
    }

    @Test
    void post_400_for_add_on_covered_date() throws Exception {
        String id = createWeekly(Set.of(DayOfWeek.MONDAY));
        LocalDate mon = mostRecent(DayOfWeek.MONDAY);
        mvc.perform(post("/api/planned-tasks/" + id + "/exceptions")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskExceptionRequest(mon, ExceptionType.ADD))))
           .andExpect(status().isBadRequest())
           .andExpect(jsonPath("$.code").value("EXCEPTION_NOT_ALLOWED"));
    }

    @Test
    void post_409_on_duplicate() throws Exception {
        String id = createWeekly(Set.of(DayOfWeek.MONDAY));
        LocalDate tue = mostRecent(DayOfWeek.TUESDAY);
        mvc.perform(post("/api/planned-tasks/" + id + "/exceptions")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskExceptionRequest(tue, ExceptionType.ADD))));
        mvc.perform(post("/api/planned-tasks/" + id + "/exceptions")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskExceptionRequest(tue, ExceptionType.ADD))))
           .andExpect(status().isConflict())
           .andExpect(jsonPath("$.code").value("EXCEPTION_ALREADY_EXISTS"));
    }

    @Test
    void delete_204_then_subsequent_get_clean() throws Exception {
        String id = createWeekly(Set.of(DayOfWeek.MONDAY));
        LocalDate tue = mostRecent(DayOfWeek.TUESDAY);
        mvc.perform(post("/api/planned-tasks/" + id + "/exceptions")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskExceptionRequest(tue, ExceptionType.ADD))));
        mvc.perform(delete("/api/planned-tasks/" + id + "/exceptions/" + tue)
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isNoContent());
        mvc.perform(get("/api/planned-tasks?date=" + tue)
                .header("Authorization", "Bearer " + token))
           .andExpect(jsonPath("$.length()").value(0));
    }
}
```

- [ ] **Step 10.2: Run (expect FAIL — controller missing)**

```bash
./mvnw -q test -Dtest=PlannedTaskExceptionControllerTest
```

Expected: 404 / compile error.

- [ ] **Step 10.3: Create `PlannedTaskExceptionController.java`**

```java
package com.timixa.backend.task;

import com.timixa.backend.security.UserPrincipal;
import com.timixa.backend.task.dto.PlannedTaskExceptionRequest;
import com.timixa.backend.task.dto.PlannedTaskResponse;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/planned-tasks/{id}/exceptions")
public class PlannedTaskExceptionController {

    private final PlannedTaskExceptionService exService;
    private final PlannedTaskService taskService;

    public PlannedTaskExceptionController(PlannedTaskExceptionService exService,
                                          PlannedTaskService taskService) {
        this.exService = exService;
        this.taskService = taskService;
    }

    @PostMapping
    public ResponseEntity<PlannedTaskResponse> add(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody PlannedTaskExceptionRequest req) {
        exService.addException(principal.id(), id, req);
        PlannedTaskResponse out = taskService.findOne(principal.id(), id);
        return ResponseEntity.status(HttpStatus.CREATED).body(out);
    }

    @DeleteMapping("/{date}")
    public ResponseEntity<Void> remove(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        exService.removeException(principal.id(), id, date);
        return ResponseEntity.noContent().build();
    }
}
```

> `taskService.findOne(userId, id)` is added in Task 11.

- [ ] **Step 10.4: Checkpoint** — tests still fail because Task 11 hasn't added `findOne` yet. Proceed.

---

### Task 11: PlannedTaskService updates (constraints + exceptions + findOne)

**Files:**
- Modify: `apps/backend-java/src/main/java/com/timixa/backend/task/PlannedTaskService.java`

- [ ] **Step 11.1: Replace the file with the new version**

```java
package com.timixa.backend.task;

import com.timixa.backend.common.TaskAlreadyCompleteException;
import com.timixa.backend.common.TaskNotFoundException;
import com.timixa.backend.task.dto.PlannedTaskExceptionResponse;
import com.timixa.backend.task.dto.PlannedTaskRequest;
import com.timixa.backend.task.dto.PlannedTaskResponse;
import com.timixa.backend.task.dto.PlannedTaskUpdateRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Service
public class PlannedTaskService {

    private final PlannedTaskRepository tasks;
    private final PlannedTaskCompletionRepository completions;
    private final PlannedTaskExceptionRepository exceptions;

    public PlannedTaskService(PlannedTaskRepository tasks,
                              PlannedTaskCompletionRepository completions,
                              PlannedTaskExceptionRepository exceptions) {
        this.tasks = tasks;
        this.completions = completions;
        this.exceptions = exceptions;
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
        t.setMinTimeMinutes(req.minTimeMinutes());
        t.setMaxTimeMinutes(req.maxTimeMinutes());
        t.setMinCount(req.minCount());
        t.setMaxCount(req.maxCount());
        validate(t);
        PlannedTask saved = tasks.save(t);
        return PlannedTaskResponse.from(saved, List.of(), false);
    }

    @Transactional(readOnly = true)
    public List<PlannedTaskResponse> findAll(UUID userId) {
        List<PlannedTask> all = tasks.findByUserIdOrderByCreatedAtDesc(userId);
        Map<UUID, List<PlannedTaskExceptionResponse>> exMap = exceptionsByTask(all);
        Set<UUID> completedToday = completedIdsForToday(all);
        return all.stream()
            .map(t -> PlannedTaskResponse.from(
                t,
                exMap.getOrDefault(t.getId(), List.of()),
                completedToday.contains(t.getId())))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<PlannedTaskResponse> findForDate(UUID userId, LocalDate date) {
        List<PlannedTask> all = tasks.findByUserIdOrderByCreatedAtDesc(userId);
        Map<UUID, Map<LocalDate, ExceptionType>> exByTaskAndDate = exceptionsByTaskAndDate(all);
        List<PlannedTask> filtered = all.stream()
            .filter(t -> appliesOn(t, date, exByTaskAndDate.getOrDefault(t.getId(), Map.of())))
            .toList();
        Map<UUID, List<PlannedTaskExceptionResponse>> exMap = exceptionsByTask(filtered);
        Set<UUID> completedToday = completedIdsForToday(filtered);
        return filtered.stream()
            .map(t -> PlannedTaskResponse.from(
                t,
                exMap.getOrDefault(t.getId(), List.of()),
                completedToday.contains(t.getId())))
            .toList();
    }

    @Transactional(readOnly = true)
    public PlannedTaskResponse findOne(UUID userId, UUID taskId) {
        PlannedTask t = requireOwnedTask(userId, taskId);
        List<PlannedTaskExceptionResponse> ex = exceptions.findByTaskIdIn(List.of(t.getId())).stream()
            .map(PlannedTaskExceptionResponse::from).toList();
        boolean completed = !completions
            .findCompletedTaskIds(List.of(t.getId()), LocalDate.now()).isEmpty();
        return PlannedTaskResponse.from(t, ex, completed);
    }

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
        if (req.minTimeMinutes() != null) t.setMinTimeMinutes(req.minTimeMinutes());
        if (req.maxTimeMinutes() != null) t.setMaxTimeMinutes(req.maxTimeMinutes());
        if (req.minCount() != null) t.setMinCount(req.minCount());
        if (req.maxCount() != null) t.setMaxCount(req.maxCount());
        validate(t);
        PlannedTask saved = tasks.save(t);
        return findOne(userId, saved.getId());
    }

    @Transactional
    public PlannedTaskResponse complete(UUID userId, UUID taskId, LocalDate date) {
        PlannedTask t = requireOwnedTask(userId, taskId);
        PlannedTaskCompletionId pk = new PlannedTaskCompletionId(t.getId(), date);
        if (completions.existsById(pk)) throw new TaskAlreadyCompleteException();
        completions.save(new PlannedTaskCompletion(t.getId(), date, Instant.now()));
        return findOne(userId, t.getId());
    }

    @Transactional
    public void uncomplete(UUID userId, UUID taskId, LocalDate date) {
        requireOwnedTask(userId, taskId);
        completions.deleteByTaskIdAndCompletedDate(taskId, date);
    }

    @Transactional
    public void delete(UUID userId, UUID taskId) {
        PlannedTask t = requireOwnedTask(userId, taskId);
        completions.deleteByTaskId(taskId);
        exceptions.deleteByTaskId(taskId);
        tasks.delete(t);
    }

    PlannedTask requireOwnedTask(UUID userId, UUID taskId) {
        PlannedTask t = tasks.findById(taskId).orElseThrow(TaskNotFoundException::new);
        if (!t.getUserId().equals(userId)) throw new TaskNotFoundException();
        return t;
    }

    static boolean appliesOn(PlannedTask t,
                             LocalDate date,
                             Map<LocalDate, ExceptionType> exForTask) {
        ExceptionType ex = exForTask == null ? null : exForTask.get(date);
        return switch (t.getCadence()) {
            case ONCE -> date.equals(t.getScheduledDate());
            case DAILY -> ex != ExceptionType.SKIP;
            case WEEKLY -> {
                boolean covered = t.getWeekdaysSet().contains(date.getDayOfWeek());
                yield (covered && ex != ExceptionType.SKIP) || (!covered && ex == ExceptionType.ADD);
            }
            case MONTHLY -> {
                boolean covered = t.getMonthDaysSet().contains(date.getDayOfMonth());
                yield (covered && ex != ExceptionType.SKIP) || (!covered && ex == ExceptionType.ADD);
            }
        };
    }

    static boolean appliesOn(PlannedTask t, LocalDate date) {
        return appliesOn(t, date, Map.of());
    }

    private Set<UUID> completedIdsForToday(List<PlannedTask> list) {
        if (list.isEmpty()) return Set.of();
        List<UUID> ids = list.stream().map(PlannedTask::getId).toList();
        return new HashSet<>(completions.findCompletedTaskIds(ids, LocalDate.now()));
    }

    private Map<UUID, List<PlannedTaskExceptionResponse>> exceptionsByTask(List<PlannedTask> list) {
        if (list.isEmpty()) return Map.of();
        List<UUID> ids = list.stream().map(PlannedTask::getId).toList();
        Map<UUID, List<PlannedTaskExceptionResponse>> out = new HashMap<>();
        for (PlannedTaskException e : exceptions.findByTaskIdIn(ids)) {
            out.computeIfAbsent(e.getTaskId(), k -> new ArrayList<>())
               .add(PlannedTaskExceptionResponse.from(e));
        }
        return out;
    }

    private Map<UUID, Map<LocalDate, ExceptionType>> exceptionsByTaskAndDate(List<PlannedTask> list) {
        if (list.isEmpty()) return Map.of();
        List<UUID> ids = list.stream().map(PlannedTask::getId).toList();
        Map<UUID, Map<LocalDate, ExceptionType>> out = new HashMap<>();
        for (PlannedTaskException e : exceptions.findByTaskIdIn(ids)) {
            out.computeIfAbsent(e.getTaskId(), k -> new HashMap<>())
               .put(e.getExceptionDate(), e.getExceptionType());
        }
        return out;
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

        if (t.getMinTimeMinutes() != null && t.getMinTimeMinutes() <= 0)
            throw new IllegalArgumentException("minTimeMinutes must be > 0");
        if (t.getMaxTimeMinutes() != null && t.getMaxTimeMinutes() <= 0)
            throw new IllegalArgumentException("maxTimeMinutes must be > 0");
        if (t.getMinCount() != null && t.getMinCount() <= 0)
            throw new IllegalArgumentException("minCount must be > 0");
        if (t.getMaxCount() != null && t.getMaxCount() <= 0)
            throw new IllegalArgumentException("maxCount must be > 0");
        if (t.getMinTimeMinutes() != null && t.getMaxTimeMinutes() != null
                && t.getMaxTimeMinutes() < t.getMinTimeMinutes())
            throw new IllegalArgumentException("maxTimeMinutes must be >= minTimeMinutes");
        if (t.getMinCount() != null && t.getMaxCount() != null
                && t.getMaxCount() < t.getMinCount())
            throw new IllegalArgumentException("maxCount must be >= minCount");
    }
}
```

- [ ] **Step 11.2: Compile + run ALL existing backend tests**

```bash
./mvnw -q test
```

Expected: existing Slice 1 + Slice 2 tests still pass; new Task 9 / Task 10 tests now pass too.

- [ ] **Step 11.3: Checkpoint.**

---

### Task 12: Extend PlannedTaskService tests for constraints

**Files:**
- Modify: `apps/backend-java/src/test/java/com/timixa/backend/task/PlannedTaskServiceTest.java`

- [ ] **Step 12.1: Update the existing helper methods**

In the file, the existing test helper methods (`registerAndGetToken` and any internal `create*` shortcuts) use the old `PlannedTaskRequest` constructor (11 fields). They are already compiling after Task 7 because they pass `null` everywhere — but verify by reading the test file. If any test method instantiates `PlannedTaskRequest` directly with positional args, update it to use the new 15-field constructor by appending four trailing `null`s.

- [ ] **Step 12.2: Append constraint tests**

At the end of `PlannedTaskServiceTest` (inside the class, before the closing brace):

```java
    @Test
    void create_accepts_constraints() {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null,
            30, 60, 5, 10);
        var r = service.create(userId, req);
        assertThat(r.minTimeMinutes()).isEqualTo(30);
        assertThat(r.maxTimeMinutes()).isEqualTo(60);
        assertThat(r.minCount()).isEqualTo(5);
        assertThat(r.maxCount()).isEqualTo(10);
    }

    @Test
    void create_accepts_partial_constraints() {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null,
            null, 60, 5, null);
        var r = service.create(userId, req);
        assertThat(r.minTimeMinutes()).isNull();
        assertThat(r.maxTimeMinutes()).isEqualTo(60);
        assertThat(r.minCount()).isEqualTo(5);
        assertThat(r.maxCount()).isNull();
    }

    @Test
    void create_rejects_negative_constraint() {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null,
            -5, null, null, null);
        assertThatThrownBy(() -> service.create(userId, req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("minTimeMinutes");
    }

    @Test
    void create_rejects_max_less_than_min_time() {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null,
            60, 30, null, null);
        assertThatThrownBy(() -> service.create(userId, req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("maxTimeMinutes");
    }

    @Test
    void create_rejects_max_less_than_min_count() {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null,
            null, null, 10, 5);
        assertThatThrownBy(() -> service.create(userId, req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("maxCount");
    }

    @Test
    void findForDate_daily_respects_skip_exception() {
        var id = service.create(userId, new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null,
            null, null, null, null)).id();
        exceptionService.addException(userId, id,
            new com.timixa.backend.task.dto.PlannedTaskExceptionRequest(
                java.time.LocalDate.now(), ExceptionType.SKIP));
        var out = service.findForDate(userId, java.time.LocalDate.now());
        assertThat(out).isEmpty();
    }

    @Test
    void findForDate_weekly_respects_add_exception_on_uncovered_day() {
        java.time.DayOfWeek today = java.time.LocalDate.now().getDayOfWeek();
        java.time.DayOfWeek tomorrow = today.plus(1);
        var id = service.create(userId, new PlannedTaskRequest(
            "Gym", null, null, Cadence.WEEKLY, true,
            "09:00", "10:00", null, java.util.Set.of(tomorrow), null,
            null, null, null, null)).id();
        // Today is NOT in weekdays — should be empty.
        assertThat(service.findForDate(userId, java.time.LocalDate.now())).isEmpty();
        // Add ADD exception for today → should appear.
        exceptionService.addException(userId, id,
            new com.timixa.backend.task.dto.PlannedTaskExceptionRequest(
                java.time.LocalDate.now(), ExceptionType.ADD));
        assertThat(service.findForDate(userId, java.time.LocalDate.now())).hasSize(1);
    }
```

- [ ] **Step 12.3: Add the new field for the exception service**

At the top of `PlannedTaskServiceTest` class (with the other `@Autowired` fields):

```java
    @Autowired PlannedTaskExceptionService exceptionService;
```

- [ ] **Step 12.4: Run all PlannedTaskService tests**

```bash
./mvnw -q test -Dtest=PlannedTaskServiceTest
```

Expected: original 14 tests + 7 new = 21 passing.

- [ ] **Step 12.5: Checkpoint.**

---

### Task 13: Update PlannedTaskControllerTest for constraint round-trip + exceptions array

**Files:**
- Modify: `apps/backend-java/src/test/java/com/timixa/backend/task/PlannedTaskControllerTest.java`

- [ ] **Step 13.1: Update any existing helpers**

If `PlannedTaskControllerTest` has helper methods or test methods that construct `PlannedTaskRequest` directly, append four trailing `null`s to each call to match the new 15-field constructor. The existing tests should otherwise still pass.

- [ ] **Step 13.2: Append two new tests**

Inside the class (before closing brace):

```java
    @Test
    void post_201_round_trips_constraints() throws Exception {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Gym", "Fitness", null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null,
            30, 60, 5, 10);
        mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.minTimeMinutes").value(30))
           .andExpect(jsonPath("$.maxTimeMinutes").value(60))
           .andExpect(jsonPath("$.minCount").value(5))
           .andExpect(jsonPath("$.maxCount").value(10))
           .andExpect(jsonPath("$.exceptions").isArray())
           .andExpect(jsonPath("$.exceptions").isEmpty());
    }

    @Test
    void post_400_for_max_less_than_min_time() throws Exception {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null,
            60, 30, null, null);
        mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
           .andExpect(status().isBadRequest())
           .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }
```

- [ ] **Step 13.3: Run all controller tests**

```bash
./mvnw -q test -Dtest=PlannedTaskControllerTest
```

Expected: original 7 tests + 2 new = 9 passing.

- [ ] **Step 13.4: Run full backend suite**

```bash
./mvnw -q test
```

Expected: all green.

- [ ] **Step 13.5: Checkpoint.**

---

## Phase E — Frontend model + service

### Task 14: Update PlannedTask Angular model

**Files:**
- Modify: `apps/frontend/src/app/core/models/planned-task.model.ts`

- [ ] **Step 14.1: Replace the file**

```ts
export type PlannedTaskCadence = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type Weekday =
  | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY'
  | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export type ExceptionType = 'SKIP' | 'ADD';

export interface PlannedTaskException {
  date: string;            // YYYY-MM-DD
  type: ExceptionType;
}

export interface PlannedTask {
  id: string;
  userId: string;
  title: string;
  goal?: string;
  color: string;
  cadence: PlannedTaskCadence;
  needsTimeSlot: boolean;
  startTime?: string;
  endTime?: string;
  scheduledDate?: string;
  weekdays?: Weekday[];
  monthDays?: number[];
  minTimeMinutes?: number;
  maxTimeMinutes?: number;
  minCount?: number;
  maxCount?: number;
  exceptions: PlannedTaskException[];
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
  minTimeMinutes?: number | null;
  maxTimeMinutes?: number | null;
  minCount?: number | null;
  maxCount?: number | null;
}

export type PlannedTaskUpdate = Partial<PlannedTaskInput>;
```

- [ ] **Step 14.2: Verify build (expect compile errors in any code that reads `exceptions` since the field is now required)**

```bash
cd apps/frontend && npx ng build --configuration development
```

Expected: BUILD SUCCESS if no consumers iterate over `exceptions`. Otherwise note the failing line for follow-up — likely none.

- [ ] **Step 14.3: Checkpoint.**

---

### Task 15: Extend PlannedTaskService — exceptions + loadForDate/loadForWeek + applyPermanently

**Files:**
- Modify: `apps/frontend/src/app/core/services/planned-task.service.ts`

- [ ] **Step 15.1: Replace the file**

```ts
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ExceptionType,
  PlannedTask,
  PlannedTaskInput,
  PlannedTaskUpdate,
  Weekday,
} from '../models/planned-task.model';

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
    return this.loadForDate(todayIso()).pipe(tap(list => this._tasks.set(list)));
  }

  loadForDate(date: string): Observable<PlannedTask[]> {
    return this.http.get<PlannedTask[]>(`${this.base}?date=${date}`);
  }

  loadForWeek(weekStart: string): Observable<Map<string, PlannedTask[]>> {
    const start = new Date(weekStart);
    const calls: { [date: string]: Observable<PlannedTask[]> } = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = isoFromDate(d);
      calls[iso] = this.loadForDate(iso);
    }
    return forkJoin(calls).pipe(
      switchMap(map => of(new Map(Object.entries(map)))),
    );
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

  addException(id: string, date: string, type: ExceptionType): Observable<PlannedTask> {
    return this.http
      .post<PlannedTask>(`${this.base}/${id}/exceptions`, { date, type })
      .pipe(tap(updated => this._tasks.update(list => list.map(t => (t.id === id ? updated : t)))));
  }

  removeException(id: string, date: string): Observable<PlannedTask> {
    return this.http
      .delete<void>(`${this.base}/${id}/exceptions/${date}`)
      .pipe(
        switchMap(() => this.loadOne(id)),
        tap(updated => this._tasks.update(list => list.map(t => (t.id === id ? updated : t)))),
      );
  }

  applyPermanently(
    id: string,
    date: string,
    template: { weekdays?: Weekday[]; monthDays?: number[] },
  ): Observable<PlannedTask> {
    return this.removeException(id, date).pipe(
      switchMap(() => this.update(id, template)),
    );
  }

  startTicker(): void {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => this._now.set(new Date()), 60_000);
  }

  stopTicker(): void {
    if (this.tickHandle) clearInterval(this.tickHandle);
    this.tickHandle = null;
  }

  private loadOne(id: string): Observable<PlannedTask> {
    return this.http.get<PlannedTask>(`${this.base}/${id}`);
  }
}
```

> The `loadOne` helper uses `GET /api/planned-tasks/{id}`. That endpoint doesn't exist on the backend yet. Add it in Task 16.

- [ ] **Step 15.2: Verify build (expect failure if `loadOne` is referenced and TypeScript can't tell)**

```bash
npx ng build --configuration development
```

Expected: BUILD SUCCESS (TypeScript doesn't know about the missing backend endpoint).

- [ ] **Step 15.3: Checkpoint.**

---

### Task 16: Add `GET /api/planned-tasks/{id}` endpoint

**Files:**
- Modify: `apps/backend-java/src/main/java/com/timixa/backend/task/PlannedTaskController.java`

- [ ] **Step 16.1: Add a `findOne` endpoint**

In `PlannedTaskController.java`, add the following method above the existing `@PostMapping` for create:

```java
    @GetMapping("/{id}")
    public PlannedTaskResponse findOne(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id) {
        return service.findOne(principal.id(), id);
    }
```

- [ ] **Step 16.2: Run all backend tests**

```bash
cd ../backend-java && ./mvnw -q test
```

Expected: all green.

- [ ] **Step 16.3: Checkpoint.**

---

## Phase F — Shared popup

### Task 17: ExceptionPopupComponent

**Files:**
- Create: `apps/frontend/src/app/features/schedule/exception-popup.component.ts`

- [ ] **Step 17.1: Create the component**

```ts
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-exception-popup',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-6"
         style="background:rgba(26,28,30,0.4); backdrop-filter:blur(4px);"
         (click)="no.emit()">
      <div class="bg-surface-container-lowest w-full max-w-sm rounded-[20px] overflow-hidden border border-outline-variant/10"
           style="box-shadow:0 24px 48px rgba(0,0,0,0.12);"
           (click)="$event.stopPropagation()"
           data-testid="exception-popup">
        <div class="p-6">
          <h3 class="font-bold text-[20px] text-on-surface" style="font-family:Manrope;"
              data-testid="exception-popup-title">{{ title }}</h3>
        </div>
        <div class="flex gap-3 p-4 border-t border-outline-variant/10"
             style="background:rgba(238,238,240,0.3);">
          <button (click)="no.emit()"
                  class="flex-1 py-3 text-on-surface-variant font-semibold hover:bg-surface-container-high rounded-xl transition-colors"
                  data-testid="exception-popup-no">{{ noLabel }}</button>
          <button (click)="yes.emit()"
                  class="flex-1 py-3 text-white font-semibold rounded-xl transition-all active:scale-95"
                  style="background:#5e43fb; box-shadow:0 4px 12px rgba(94,67,251,0.3);"
                  data-testid="exception-popup-yes">{{ yesLabel }}</button>
        </div>
      </div>
    </div>
  `,
})
export class ExceptionPopupComponent {
  @Input() title = '';
  @Input() yesLabel = 'Yes, every week';
  @Input() noLabel = 'No, just this date';
  @Output() yes = new EventEmitter<void>();
  @Output() no = new EventEmitter<void>();
}
```

- [ ] **Step 17.2: Verify build**

```bash
cd apps/frontend && npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 17.3: Checkpoint.**

---

## Phase G — Schedule day view rewrite

### Task 18: schedule-day.component.ts — layout + load + render

**Files:**
- Modify (rewrite): `apps/frontend/src/app/features/schedule/schedule-day/schedule-day.component.ts`

- [ ] **Step 18.1: Replace the file with a minimal version (no interactions yet — interactions added in Task 19+)**

```ts
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlannedTaskService } from '../../../core/services/planned-task.service';
import { PlannedTask } from '../../../core/models/planned-task.model';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

@Component({
  selector: 'app-schedule-day',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="px-margin-page pt-stack-lg pb-4">
      <header class="flex items-center justify-between mb-stack-md">
        <button (click)="prev()" class="p-2 rounded-full hover:bg-surface-container" data-testid="day-prev">‹</button>
        <h2 class="font-manrope font-bold text-h2" data-testid="day-label">{{ label() }}</h2>
        <button (click)="next()" class="p-2 rounded-full hover:bg-surface-container" data-testid="day-next">›</button>
      </header>

      <section *ngIf="unscheduled().length" class="mb-stack-md" data-testid="day-unscheduled">
        <h3 class="font-semibold text-[14px] text-outline mb-2 uppercase">Needs a time slot</h3>
        <div class="flex gap-2 overflow-x-auto pb-2">
          <div *ngFor="let t of unscheduled()"
               class="flex-none w-40 p-3 rounded-[16px] bg-surface-container-lowest shadow-card cursor-grab"
               draggable="true"
               (dragstart)="onQueueDragStart($event, t)"
               [attr.data-testid]="'day-queue-' + t.id">
            <span class="w-2 h-2 rounded-full inline-block mr-2" [style.background]="t.color"></span>
            <span class="font-semibold text-on-surface">{{ t.title }}</span>
          </div>
        </div>
      </section>

      <section class="relative bg-surface-container-lowest rounded-[20px] p-0 shadow-card overflow-hidden">
        <div *ngFor="let h of hours" class="relative h-12 border-t border-outline-variant/10"
             (dragover)="$event.preventDefault()"
             (drop)="onDrop($event, h)"
             [attr.data-testid]="'day-slot-' + h">
          <span class="absolute left-2 top-1 text-[11px] text-outline">{{ pad(h) }}:00</span>
        </div>

        <div *ngFor="let t of scheduled()"
             class="absolute left-12 right-2 rounded-[12px] px-2 py-1 text-white text-[13px] font-semibold"
             [style.top.px]="topPx(t)"
             [style.height.px]="heightPx(t)"
             [style.background]="t.color"
             [attr.data-testid]="'day-bar-' + t.id">
          {{ t.title }} <span class="font-normal">{{ t.startTime }}–{{ t.endTime }}</span>
        </div>
      </section>
    </div>
  `,
})
export class ScheduleDayComponent implements OnInit, OnDestroy {
  protected plannedTasks = inject(PlannedTaskService);
  private router = inject(Router);

  viewDate = signal<string>(todayIso());
  tasksForDay = signal<PlannedTask[]>([]);
  hours = Array.from({length: 24}, (_, i) => i);

  unscheduled = computed(() => this.tasksForDay().filter(t => t.needsTimeSlot && !t.startTime));
  scheduled   = computed(() => this.tasksForDay().filter(t => !!t.startTime));

  label = computed(() => new Date(this.viewDate()).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  }));

  ngOnInit(): void { this.reload(); }
  ngOnDestroy(): void {}

  prev(): void { this.shift(-1); }
  next(): void { this.shift(+1); }

  pad(n: number): string { return String(n).padStart(2, '0'); }

  topPx(t: PlannedTask): number {
    const [h, m] = (t.startTime ?? '00:00').split(':').map(Number);
    return (h * 60 + m) * 0.8; // 48px per hour
  }
  heightPx(t: PlannedTask): number {
    const [sh, sm] = (t.startTime ?? '00:00').split(':').map(Number);
    const [eh, em] = (t.endTime ?? '00:00').split(':').map(Number);
    return Math.max(20, (eh*60+em - sh*60-sm) * 0.8);
  }

  onQueueDragStart(ev: DragEvent, t: PlannedTask): void {
    ev.dataTransfer?.setData('text/plain', t.id);
  }

  onDrop(ev: DragEvent, hour: number): void {
    ev.preventDefault();
    const id = ev.dataTransfer?.getData('text/plain');
    if (!id) return;
    const start = `${this.pad(hour)}:00`;
    const end   = `${this.pad((hour+1) % 24)}:00`;
    this.plannedTasks.update(id, { startTime: start, endTime: end, needsTimeSlot: true }).subscribe({
      next: () => this.reload(),
    });
  }

  private shift(deltaDays: number): void {
    const d = new Date(this.viewDate());
    d.setDate(d.getDate() + deltaDays);
    this.viewDate.set(
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
    );
    this.reload();
  }

  private reload(): void {
    this.plannedTasks.loadForDate(this.viewDate()).subscribe({
      next: list => this.tasksForDay.set(list),
    });
  }
}
```

- [ ] **Step 18.2: Verify build**

```bash
npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 18.3: Checkpoint.**

---

### Task 19: schedule-day — bar drag (time change) + resize + skip with popup

**Files:**
- Modify: `apps/frontend/src/app/features/schedule/schedule-day/schedule-day.component.ts`

- [ ] **Step 19.1: Add the popup state + render**

In `ScheduleDayComponent`, add:

```ts
  pendingSkipId = signal<string | null>(null);
  pendingPopupTitle = signal('');
  popupYesLabel = signal('');
```

In `imports`, add `ExceptionPopupComponent`:

```ts
import { ExceptionPopupComponent } from '../exception-popup.component';

@Component({
  // ...
  imports: [CommonModule, ExceptionPopupComponent],
  template: `
    // ... keep existing template ...

    <app-exception-popup *ngIf="pendingSkipId()"
      [title]="pendingPopupTitle()"
      [yesLabel]="popupYesLabel()"
      noLabel="No, just this date"
      (yes)="onSkipYes()"
      (no)="onSkipNo()" />
  `,
})
```

- [ ] **Step 19.2: Make bars draggable + add resize handle**

In the template, change the scheduled-bar `div` block to:

```html
<div *ngFor="let t of scheduled()"
     class="absolute left-12 right-2 rounded-[12px] px-2 py-1 text-white text-[13px] font-semibold cursor-grab"
     [style.top.px]="topPx(t)"
     [style.height.px]="heightPx(t)"
     [style.background]="t.color"
     draggable="true"
     (dragstart)="onBarDragStart($event, t)"
     (dragover)="$event.preventDefault()"
     [attr.data-testid]="'day-bar-' + t.id">
  <div class="flex items-center justify-between">
    <span>{{ t.title }} <span class="font-normal">{{ t.startTime }}–{{ t.endTime }}</span></span>
    <button (click)="requestSkip(t)" class="text-[11px] opacity-80 hover:opacity-100"
            [attr.data-testid]="'day-skip-' + t.id">skip</button>
  </div>
  <div class="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-white/10"
       (mousedown)="onResizeStart($event, t)"
       [attr.data-testid]="'day-resize-' + t.id"></div>
</div>
```

- [ ] **Step 19.3: Add handler methods to the class**

Append:

```ts
  onBarDragStart(ev: DragEvent, t: PlannedTask): void {
    ev.dataTransfer?.setData('text/plain', t.id);
  }

  requestSkip(t: PlannedTask): void {
    // DAILY: no popup. Write SKIP and move on.
    if (t.cadence === 'DAILY') {
      this.plannedTasks.addException(t.id, this.viewDate(), 'SKIP').subscribe({
        next: () => this.reload(),
      });
      return;
    }
    // ONCE: confirm delete (treated as no-popup for slice 3 — call remove).
    if (t.cadence === 'ONCE') {
      if (confirm(`Delete ${t.title}?`)) {
        this.plannedTasks.remove(t.id).subscribe({ next: () => this.reload() });
      }
      return;
    }
    // WEEKLY / MONTHLY: write SKIP exception, then ask via popup.
    this.plannedTasks.addException(t.id, this.viewDate(), 'SKIP').subscribe({
      next: () => {
        this.pendingSkipId.set(t.id);
        if (t.cadence === 'WEEKLY') {
          const weekday = new Date(this.viewDate()).toLocaleDateString(undefined, { weekday: 'long' });
          this.pendingPopupTitle.set(`Skip every ${weekday}'s ${t.title}?`);
          this.popupYesLabel.set('Yes, every week');
        } else {
          const dayOfMonth = new Date(this.viewDate()).getDate();
          this.pendingPopupTitle.set(`Skip ${t.title} every day ${dayOfMonth} of the month?`);
          this.popupYesLabel.set('Yes, every month');
        }
        this.reload();
      },
    });
  }

  onSkipYes(): void {
    const id = this.pendingSkipId();
    if (!id) return;
    const t = this.tasksForDay().find(x => x.id === id);
    if (!t) { this.dismissPopup(); return; }

    if (t.cadence === 'WEEKLY') {
      const weekday = new Date(this.viewDate()).toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase();
      const newWeekdays = (t.weekdays ?? []).filter(d => d !== weekday);
      this.plannedTasks.applyPermanently(id, this.viewDate(), { weekdays: newWeekdays as any }).subscribe({
        next: () => { this.dismissPopup(); this.reload(); },
      });
    } else if (t.cadence === 'MONTHLY') {
      const day = new Date(this.viewDate()).getDate();
      const newDays = (t.monthDays ?? []).filter(d => d !== day);
      this.plannedTasks.applyPermanently(id, this.viewDate(), { monthDays: newDays }).subscribe({
        next: () => { this.dismissPopup(); this.reload(); },
      });
    } else {
      this.dismissPopup();
    }
  }

  onSkipNo(): void {
    this.dismissPopup();
  }

  private dismissPopup(): void {
    this.pendingSkipId.set(null);
    this.pendingPopupTitle.set('');
    this.popupYesLabel.set('');
  }

  // --- Resize ---
  private resizingTaskId: string | null = null;
  private resizingTaskStart: string | null = null;
  private resizeStartY = 0;

  onResizeStart(ev: MouseEvent, t: PlannedTask): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.resizingTaskId = t.id;
    this.resizingTaskStart = t.startTime ?? null;
    this.resizeStartY = ev.clientY;
    document.addEventListener('mousemove', this.onResizeMove);
    document.addEventListener('mouseup', this.onResizeEnd);
  }
  private onResizeMove = (ev: MouseEvent) => {
    // Live preview omitted; only the end position is used.
  };
  private onResizeEnd = (ev: MouseEvent) => {
    const id = this.resizingTaskId;
    const start = this.resizingTaskStart;
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
    this.resizingTaskId = null; this.resizingTaskStart = null;
    if (!id || !start) return;

    const dy = ev.clientY - this.resizeStartY;
    const deltaMinutes = Math.round(dy / 0.8);
    if (deltaMinutes === 0) return;
    const t = this.tasksForDay().find(x => x.id === id);
    if (!t || !t.endTime) return;

    const [eh, em] = t.endTime.split(':').map(Number);
    const totalEndMin = Math.min(23*60+59, Math.max(0, eh*60 + em + deltaMinutes));
    const newEnd = `${String(Math.floor(totalEndMin/60)).padStart(2,'0')}:${String(totalEndMin%60).padStart(2,'0')}`;
    if (newEnd <= t.startTime!) return;

    this.plannedTasks.update(id, { endTime: newEnd }).subscribe({ next: () => this.reload() });
  };
```

> Update `onDrop` to also handle the case where a bar is dragged within the grid (same `dataTransfer` mechanism — the `id` resolves whether it's from queue or from a bar). Replace `onDrop` with:

```ts
  onDrop(ev: DragEvent, hour: number): void {
    ev.preventDefault();
    const id = ev.dataTransfer?.getData('text/plain');
    if (!id) return;
    const t = this.tasksForDay().find(x => x.id === id);
    const start = `${this.pad(hour)}:00`;
    let end: string;
    if (t?.startTime && t?.endTime) {
      // Existing bar moved — preserve duration.
      const [sh, sm] = t.startTime.split(':').map(Number);
      const [eh, em] = t.endTime.split(':').map(Number);
      const durMin = eh*60+em - sh*60-sm;
      const totalEndMin = hour*60 + durMin;
      end = `${String(Math.floor(totalEndMin/60)%24).padStart(2,'0')}:${String(totalEndMin%60).padStart(2,'0')}`;
    } else {
      end = `${this.pad((hour+1) % 24)}:00`;
    }
    this.plannedTasks.update(id, { startTime: start, endTime: end, needsTimeSlot: true }).subscribe({
      next: () => this.reload(),
    });
  }
```

- [ ] **Step 19.4: Verify build**

```bash
npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 19.5: Checkpoint.**

---

## Phase H — Schedule week view rewrite

### Task 20: schedule-week.component.ts — layout + load + render

**Files:**
- Modify (rewrite): `apps/frontend/src/app/features/schedule/schedule-week/schedule-week.component.ts`

- [ ] **Step 20.1: Replace the file with a minimal version (no popup logic yet)**

```ts
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { PlannedTaskService } from '../../../core/services/planned-task.service';
import { PlannedTask, Weekday } from '../../../core/models/planned-task.model';

const WEEKDAY_NAMES: Weekday[] = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'];

function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function mondayOfThisWeek(): string {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow);
  return isoFromDate(d);
}

@Component({
  selector: 'app-schedule-week',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="px-margin-page pt-stack-lg pb-4">
      <header class="flex items-center justify-between mb-stack-md">
        <button (click)="prev()" class="p-2 rounded-full hover:bg-surface-container" data-testid="week-prev">‹</button>
        <h2 class="font-manrope font-bold text-h2" data-testid="week-label">Week of {{ weekStart() }}</h2>
        <button (click)="next()" class="p-2 rounded-full hover:bg-surface-container" data-testid="week-next">›</button>
      </header>

      <section *ngIf="unscheduled().length" class="mb-stack-md" data-testid="week-unscheduled">
        <h3 class="font-semibold text-[14px] text-outline mb-2 uppercase">Needs a time slot</h3>
        <div class="flex gap-2 overflow-x-auto pb-2">
          <div *ngFor="let t of unscheduled()"
               class="flex-none w-40 p-3 rounded-[16px] bg-surface-container-lowest shadow-card cursor-grab"
               draggable="true"
               (dragstart)="onQueueDragStart($event, t)"
               [attr.data-testid]="'week-queue-' + t.id">
            <span class="w-2 h-2 rounded-full inline-block mr-2" [style.background]="t.color"></span>
            <span class="font-semibold text-on-surface">{{ t.title }}</span>
          </div>
        </div>
      </section>

      <section class="grid grid-cols-7 gap-1 bg-surface-container-lowest rounded-[20px] p-2 shadow-card">
        <div *ngFor="let date of weekDates(); let i = index" class="relative min-h-[400px] bg-surface-container/30 rounded-[12px]"
             (dragover)="$event.preventDefault()"
             (drop)="onDrop($event, date, i)"
             [attr.data-testid]="'week-col-' + date">
          <div class="sticky top-0 px-2 py-1 text-[11px] font-bold uppercase text-outline bg-surface-container-lowest border-b border-outline-variant/10">
            {{ dayLabel(date) }}
          </div>
          <div *ngFor="let t of tasksOn(date)"
               class="m-1 px-2 py-1 rounded-[8px] text-white text-[12px] font-semibold cursor-grab"
               [style.background]="t.color"
               draggable="true"
               (dragstart)="onBarDragStart($event, t, date)"
               [attr.data-testid]="'week-bar-' + t.id + '-' + date">
            {{ t.title }} <span class="font-normal">{{ t.startTime }}–{{ t.endTime }}</span>
          </div>
        </div>
      </section>
    </div>
  `,
})
export class ScheduleWeekComponent implements OnInit, OnDestroy {
  protected plannedTasks = inject(PlannedTaskService);

  weekStart = signal<string>(mondayOfThisWeek());
  tasksByDay = signal<Map<string, PlannedTask[]>>(new Map());

  weekDates = computed<string[]>(() => {
    const d = new Date(this.weekStart());
    return Array.from({length: 7}, (_, i) => {
      const x = new Date(d); x.setDate(d.getDate() + i); return isoFromDate(x);
    });
  });

  unscheduled = computed<PlannedTask[]>(() => {
    const seen = new Set<string>();
    const out: PlannedTask[] = [];
    for (const list of this.tasksByDay().values()) {
      for (const t of list) {
        if (t.needsTimeSlot && !t.startTime && !seen.has(t.id)) {
          seen.add(t.id); out.push(t);
        }
      }
    }
    return out;
  });

  ngOnInit(): void { this.reload(); }
  ngOnDestroy(): void {}

  prev(): void { this.shift(-7); }
  next(): void { this.shift(+7); }

  dayLabel(date: string): string {
    return new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  tasksOn(date: string): PlannedTask[] {
    return (this.tasksByDay().get(date) ?? []).filter(t => !!t.startTime)
      .sort((a, b) => (a.startTime! < b.startTime! ? -1 : 1));
  }

  onQueueDragStart(ev: DragEvent, t: PlannedTask): void {
    ev.dataTransfer?.setData('text/plain', JSON.stringify({ id: t.id, fromDate: null }));
  }

  onBarDragStart(ev: DragEvent, t: PlannedTask, fromDate: string): void {
    ev.dataTransfer?.setData('text/plain', JSON.stringify({ id: t.id, fromDate }));
  }

  onDrop(ev: DragEvent, toDate: string, dayIndex: number): void {
    ev.preventDefault();
    const raw = ev.dataTransfer?.getData('text/plain');
    if (!raw) return;
    let payload: { id: string; fromDate: string | null };
    try { payload = JSON.parse(raw); } catch { return; }

    const t = [...this.tasksByDay().values()].flat().find(x => x.id === payload.id);
    if (!t) return;

    if (payload.fromDate && payload.fromDate !== toDate) {
      // cross-day move — see Task 21
      this.onCrossDayDrop(t, payload.fromDate, toDate);
    } else if (!payload.fromDate) {
      // from queue — see Task 21
      this.onQueueDrop(t, toDate);
    } else {
      // same-day drop = time change (we use slot index 0 = hour from drop Y; for slice MVP use existing time)
      // No-op for now — same-day time refinement handled by resize in a follow-up
    }
  }

  // Stubs filled in Task 21:
  onCrossDayDrop(_t: PlannedTask, _from: string, _to: string): void {}
  onQueueDrop(_t: PlannedTask, _toDate: string): void {}

  private shift(deltaDays: number): void {
    const d = new Date(this.weekStart());
    d.setDate(d.getDate() + deltaDays);
    this.weekStart.set(isoFromDate(d));
    this.reload();
  }

  private reload(): void {
    this.plannedTasks.loadForWeek(this.weekStart()).subscribe({
      next: map => this.tasksByDay.set(map),
    });
  }
}
```

- [ ] **Step 20.2: Verify build**

```bash
npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 20.3: Checkpoint.**

---

### Task 21: schedule-week — popup + queue/cross-day drop handlers

**Files:**
- Modify: `apps/frontend/src/app/features/schedule/schedule-week/schedule-week.component.ts`

- [ ] **Step 21.1: Import the popup component**

In the existing file's imports:

```ts
import { ExceptionPopupComponent } from '../exception-popup.component';
```

Add to `@Component.imports`:

```ts
imports: [CommonModule, ExceptionPopupComponent],
```

In the template, append after the week-grid `</section>`:

```html
<app-exception-popup *ngIf="popupVisible()"
  [title]="popupTitle()"
  [yesLabel]="popupYesLabel()"
  noLabel="No, just this date"
  (yes)="onPopupYes()"
  (no)="onPopupNo()" />
```

- [ ] **Step 21.2: Add popup state + handlers**

In the class:

```ts
  popupVisible = signal(false);
  popupTitle = signal('');
  popupYesLabel = signal('');
  private pendingAction: (() => void) | null = null;

  // --- Queue drop ---
  override onQueueDrop(t: PlannedTask, toDate: string): void {
    // Default 09:00–10:00 for queue drops; user can resize after.
    const start = '09:00', end = '10:00';
    this.plannedTasks.update(t.id, { startTime: start, endTime: end, needsTimeSlot: true }).subscribe({
      next: () => {
        const covered = this.dateCovered(t, toDate);
        if (covered) {
          this.reload();
        } else {
          this.plannedTasks.addException(t.id, toDate, 'ADD').subscribe({
            next: () => {
              this.openPermanentPopup(t, toDate, /*isAdd*/ true);
              this.reload();
            },
          });
        }
      },
    });
  }

  // --- Cross-day move ---
  override onCrossDayDrop(t: PlannedTask, fromDate: string, toDate: string): void {
    // Write SKIP on fromDate, ADD on toDate.
    this.plannedTasks.addException(t.id, fromDate, 'SKIP').pipe().subscribe({
      next: () => this.plannedTasks.addException(t.id, toDate, 'ADD').subscribe({
        next: () => {
          this.openMovePopup(t, fromDate, toDate);
          this.reload();
        },
      }),
    });
  }

  private dateCovered(t: PlannedTask, dateIso: string): boolean {
    const d = new Date(dateIso);
    if (t.cadence === 'DAILY') return true;
    if (t.cadence === 'WEEKLY') {
      const dow = WEEKDAY_NAMES[(d.getDay() + 6) % 7];
      return (t.weekdays ?? []).includes(dow);
    }
    if (t.cadence === 'MONTHLY') {
      return (t.monthDays ?? []).includes(d.getDate());
    }
    return t.scheduledDate === dateIso;
  }

  private openPermanentPopup(t: PlannedTask, addedDate: string, isAdd: boolean): void {
    const wd = WEEKDAY_NAMES[(new Date(addedDate).getDay() + 6) % 7];
    const friendly = wd.charAt(0) + wd.slice(1).toLowerCase();
    this.popupTitle.set(`Add ${friendly} to every week's ${t.title}?`);
    this.popupYesLabel.set('Yes, every week');
    this.pendingAction = () => {
      const newWeekdays = [...(t.weekdays ?? []), wd] as Weekday[];
      this.plannedTasks.applyPermanently(t.id, addedDate, { weekdays: newWeekdays }).subscribe({
        next: () => { this.closePopup(); this.reload(); },
      });
    };
    this.popupVisible.set(true);
  }

  private openMovePopup(t: PlannedTask, fromDate: string, toDate: string): void {
    const fromWd = WEEKDAY_NAMES[(new Date(fromDate).getDay() + 6) % 7];
    const toWd   = WEEKDAY_NAMES[(new Date(toDate).getDay() + 6) % 7];
    const friendly = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
    this.popupTitle.set(`Move ${t.title} from ${friendly(fromWd)} to ${friendly(toWd)} every week?`);
    this.popupYesLabel.set('Yes, every week');
    this.pendingAction = () => {
      // remove the "to" ADD exception, then patch template, then remove the "from" SKIP exception.
      this.plannedTasks.removeException(t.id, toDate).subscribe({
        next: () => this.plannedTasks.applyPermanently(t.id, fromDate, {
          weekdays: ([...(t.weekdays ?? [])].filter(d => d !== fromWd).concat(toWd)) as Weekday[],
        }).subscribe({
          next: () => { this.closePopup(); this.reload(); },
        }),
      });
    };
    this.popupVisible.set(true);
  }

  onPopupYes(): void { this.pendingAction?.(); }
  onPopupNo(): void { this.closePopup(); this.reload(); }

  private closePopup(): void {
    this.popupVisible.set(false);
    this.popupTitle.set('');
    this.popupYesLabel.set('');
    this.pendingAction = null;
  }
```

> The `override` keyword on `onQueueDrop` / `onCrossDayDrop` requires the class to extend a base — they're not actually overriding anything. Remove `override` and turn the stub methods in Task 20 into class methods that get *replaced* by this Task 21 code. Concretely: delete the two stub lines `onCrossDayDrop(_t...) {}` and `onQueueDrop(_t...) {}` from Task 20's version of the file, and add these implementations directly (without `override`).

- [ ] **Step 21.3: Remove the placeholder stubs**

Inside the class, delete:
```ts
  onCrossDayDrop(_t: PlannedTask, _from: string, _to: string): void {}
  onQueueDrop(_t: PlannedTask, _toDate: string): void {}
```

And replace with the real implementations from Step 21.2 (without `override`):
```ts
  onQueueDrop(t: PlannedTask, toDate: string): void { /* as above */ }
  onCrossDayDrop(t: PlannedTask, fromDate: string, toDate: string): void { /* as above */ }
```

- [ ] **Step 21.4: Verify build**

```bash
npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 21.5: Checkpoint.**

---

## Phase I — Month + calendar read-only

### Task 22: schedule-month.component.ts — read-only

**Files:**
- Modify (rewrite): `apps/frontend/src/app/features/schedule/schedule-month/schedule-month.component.ts`

- [ ] **Step 22.1: Replace with a minimal read-only month grid**

```ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { PlannedTaskService } from '../../../core/services/planned-task.service';
import { PlannedTask } from '../../../core/models/planned-task.model';

function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

@Component({
  selector: 'app-schedule-month',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="px-margin-page pt-stack-lg pb-4">
      <header class="flex items-center justify-between mb-stack-md">
        <button (click)="prev()" class="p-2 rounded-full hover:bg-surface-container" data-testid="month-prev">‹</button>
        <h2 class="font-manrope font-bold text-h2" data-testid="month-label">{{ label() }}</h2>
        <button (click)="next()" class="p-2 rounded-full hover:bg-surface-container" data-testid="month-next">›</button>
      </header>
      <div class="grid grid-cols-7 gap-1">
        <div *ngFor="let date of monthDates(); let i = index"
             class="aspect-square p-1 rounded-[12px] bg-surface-container-lowest cursor-pointer"
             [attr.data-testid]="'month-cell-' + date"
             (click)="selectedDate.set(date)">
          <div class="text-[12px] font-bold text-on-surface">{{ dayNumber(date) }}</div>
          <div class="flex gap-0.5 mt-1 flex-wrap">
            <span *ngFor="let t of tasksOn(date)"
                  class="w-1.5 h-1.5 rounded-full"
                  [style.background]="t.color"></span>
          </div>
        </div>
      </div>
      <div *ngIf="selectedDate() as d" class="mt-stack-md p-4 rounded-[16px] bg-surface-container-lowest shadow-card" data-testid="month-selected">
        <h3 class="font-bold text-on-surface mb-2">{{ d }}</h3>
        <div *ngFor="let t of tasksOn(d)" class="flex items-center gap-2 py-1">
          <span class="w-3 h-3 rounded-full" [style.background]="t.color"></span>
          <span class="font-semibold text-on-surface">{{ t.title }}</span>
          <span *ngIf="t.startTime" class="text-sm text-on-surface-variant">{{ t.startTime }}–{{ t.endTime }}</span>
        </div>
        <p *ngIf="!tasksOn(d).length" class="text-sm text-outline">No tasks on this day.</p>
      </div>
    </div>
  `,
})
export class ScheduleMonthComponent implements OnInit {
  private plannedTasks = inject(PlannedTaskService);

  monthStart = signal<string>((() => {
    const d = new Date(); d.setDate(1); return isoFromDate(d);
  })());

  selectedDate = signal<string | null>(null);
  tasksByDay = signal<Map<string, PlannedTask[]>>(new Map());

  label = computed(() => new Date(this.monthStart()).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));

  monthDates = computed<string[]>(() => {
    const d = new Date(this.monthStart());
    const days: string[] = [];
    while (d.getMonth() === new Date(this.monthStart()).getMonth()) {
      days.push(isoFromDate(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  });

  ngOnInit(): void { this.reload(); }

  prev(): void {
    const d = new Date(this.monthStart()); d.setMonth(d.getMonth() - 1); d.setDate(1);
    this.monthStart.set(isoFromDate(d)); this.selectedDate.set(null); this.reload();
  }
  next(): void {
    const d = new Date(this.monthStart()); d.setMonth(d.getMonth() + 1); d.setDate(1);
    this.monthStart.set(isoFromDate(d)); this.selectedDate.set(null); this.reload();
  }

  dayNumber(date: string): number { return new Date(date).getDate(); }

  tasksOn(date: string): PlannedTask[] {
    return this.tasksByDay().get(date) ?? [];
  }

  private reload(): void {
    const dates = this.monthDates();
    const calls: { [date: string]: ReturnType<typeof this.plannedTasks.loadForDate> } = {};
    for (const iso of dates) calls[iso] = this.plannedTasks.loadForDate(iso);
    forkJoin(calls).subscribe({
      next: map => this.tasksByDay.set(new Map(Object.entries(map))),
    });
  }
}
```

- [ ] **Step 22.2: Verify build**

```bash
npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 22.3: Checkpoint.**

---

### Task 23: calendar.component.ts — read-only

**Files:**
- Modify (rewrite): `apps/frontend/src/app/features/schedule/calendar/calendar.component.ts`

- [ ] **Step 23.1: Replace with a read-only day view (similar visual to schedule-day but no interactions)**

```ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlannedTaskService } from '../../../core/services/planned-task.service';
import { PlannedTask } from '../../../core/models/planned-task.model';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="px-margin-page pt-stack-lg pb-4">
      <header class="flex items-center justify-between mb-stack-md">
        <button (click)="prev()" class="p-2 rounded-full hover:bg-surface-container" data-testid="cal-prev">‹</button>
        <h2 class="font-manrope font-bold text-h2" data-testid="cal-label">{{ label() }}</h2>
        <button (click)="next()" class="p-2 rounded-full hover:bg-surface-container" data-testid="cal-next">›</button>
      </header>

      <section *ngIf="unscheduled().length" class="mb-stack-md p-4 rounded-[16px]"
               style="background:rgba(255,209,102,0.18); border:1px solid rgba(255,179,0,0.4);"
               data-testid="cal-unscheduled-banner">
        <p class="font-semibold text-on-surface">
          {{ unscheduled().length }} task{{ unscheduled().length === 1 ? '' : 's' }} need a time slot today
        </p>
        <button (click)="goSchedule()" class="btn-primary mt-3 px-4 py-2" data-testid="cal-open-schedule">Open today's schedule</button>
      </section>

      <section class="relative bg-surface-container-lowest rounded-[20px] p-0 shadow-card overflow-hidden">
        <div *ngFor="let h of hours" class="relative h-12 border-t border-outline-variant/10">
          <span class="absolute left-2 top-1 text-[11px] text-outline">{{ pad(h) }}:00</span>
        </div>
        <div *ngFor="let t of scheduled()"
             class="absolute left-12 right-2 rounded-[12px] px-2 py-1 text-white text-[13px] font-semibold"
             [style.top.px]="topPx(t)"
             [style.height.px]="heightPx(t)"
             [style.background]="t.color"
             [attr.data-testid]="'cal-bar-' + t.id">
          {{ t.title }} <span class="font-normal">{{ t.startTime }}–{{ t.endTime }}</span>
        </div>
      </section>
    </div>
  `,
})
export class CalendarComponent implements OnInit {
  private plannedTasks = inject(PlannedTaskService);
  private router = inject(Router);

  viewDate = signal<string>(todayIso());
  tasksForDay = signal<PlannedTask[]>([]);
  hours = Array.from({length: 24}, (_, i) => i);

  unscheduled = computed(() => this.tasksForDay().filter(t => t.needsTimeSlot && !t.startTime));
  scheduled   = computed(() => this.tasksForDay().filter(t => !!t.startTime));

  label = computed(() => new Date(this.viewDate()).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));

  ngOnInit(): void { this.reload(); }

  prev(): void { this.shift(-1); }
  next(): void { this.shift(+1); }
  pad(n: number): string { return String(n).padStart(2, '0'); }
  topPx(t: PlannedTask): number {
    const [h, m] = (t.startTime ?? '00:00').split(':').map(Number);
    return (h * 60 + m) * 0.8;
  }
  heightPx(t: PlannedTask): number {
    const [sh, sm] = (t.startTime ?? '00:00').split(':').map(Number);
    const [eh, em] = (t.endTime ?? '00:00').split(':').map(Number);
    return Math.max(20, (eh*60+em - sh*60-sm) * 0.8);
  }
  goSchedule(): void { this.router.navigateByUrl('/schedule'); }

  private shift(deltaDays: number): void {
    const d = new Date(this.viewDate());
    d.setDate(d.getDate() + deltaDays);
    this.viewDate.set(
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
    );
    this.reload();
  }
  private reload(): void {
    this.plannedTasks.loadForDate(this.viewDate()).subscribe({
      next: list => this.tasksForDay.set(list),
    });
  }
}
```

- [ ] **Step 23.2: Verify build**

```bash
npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 23.3: Checkpoint.**

---

## Phase J — New Task constraint UI

### Task 24: New Task — remove old task-type UI + add Time/Count constraint cards

**Files:**
- Modify: `apps/frontend/src/app/features/new-task/new-task.component.ts`

- [ ] **Step 24.1: Remove the Task Type + dynamic-parameters section from the template**

In `new-task.component.ts`, locate `<!-- Section 3: Task Type -->` and delete from that comment through the closing `</section>` of `<!-- Section 4: Dynamic Parameters -->` (the section that ends just before `<!-- Section 4b: Needs time slot toggle -->`).

- [ ] **Step 24.2: Insert the Constraints section above the "Needs time slot" toggle**

Above `<!-- Section 4b: Needs time slot toggle -->`, insert:

```html
      <!-- Section 4: Constraints (optional) -->
      <section class="space-y-stack-sm" data-testid="constraints-section">
        <h2 class="font-semibold text-[16px] text-on-surface">Constraints <span class="text-outline font-normal">(optional)</span></h2>

        <!-- Time card -->
        <div class="bg-surface-container-lowest rounded-[20px] border border-outline-variant/20 shadow-sm p-4" data-testid="time-card">
          <label class="flex items-center justify-between cursor-pointer">
            <span class="font-semibold text-[15px] text-on-surface">Time</span>
            <div class="relative inline-flex items-center">
              <input type="checkbox" class="sr-only peer"
                     [checked]="timeConstraintEnabled()"
                     (change)="timeConstraintEnabled.set($any($event.target).checked)"
                     data-testid="time-toggle" />
              <div class="w-11 h-6 bg-surface-container rounded-full peer
                          peer-checked:bg-primary-container
                          after:content-[''] after:absolute after:top-[2px] after:start-[2px]
                          after:bg-white after:border after:border-gray-300 after:rounded-full
                          after:h-5 after:w-5 after:transition-all
                          peer-checked:after:translate-x-full"></div>
            </div>
          </label>
          <div *ngIf="timeConstraintEnabled()" class="mt-3 grid grid-cols-2 gap-2" data-testid="time-fields">
            <input type="number" min="1" placeholder="Min minutes"
                   [value]="minTimeMinutes() ?? ''"
                   (input)="minTimeMinutes.set(parseNum($any($event.target).value))"
                   class="input-ghost" data-testid="time-min" />
            <input type="number" min="1" placeholder="Max minutes"
                   [value]="maxTimeMinutes() ?? ''"
                   (input)="maxTimeMinutes.set(parseNum($any($event.target).value))"
                   class="input-ghost" data-testid="time-max" />
          </div>
          <p *ngIf="timeConstraintEnabled()" class="text-[12px] text-outline mt-2">Either, both, or neither is fine.</p>
        </div>

        <!-- Count card -->
        <div class="bg-surface-container-lowest rounded-[20px] border border-outline-variant/20 shadow-sm p-4" data-testid="count-card">
          <label class="flex items-center justify-between cursor-pointer">
            <span class="font-semibold text-[15px] text-on-surface">Count</span>
            <div class="relative inline-flex items-center">
              <input type="checkbox" class="sr-only peer"
                     [checked]="countConstraintEnabled()"
                     (change)="countConstraintEnabled.set($any($event.target).checked)"
                     data-testid="count-toggle" />
              <div class="w-11 h-6 bg-surface-container rounded-full peer
                          peer-checked:bg-primary-container
                          after:content-[''] after:absolute after:top-[2px] after:start-[2px]
                          after:bg-white after:border after:border-gray-300 after:rounded-full
                          after:h-5 after:w-5 after:transition-all
                          peer-checked:after:translate-x-full"></div>
            </div>
          </label>
          <div *ngIf="countConstraintEnabled()" class="mt-3 grid grid-cols-2 gap-2" data-testid="count-fields">
            <input type="number" min="1" placeholder="Min count"
                   [value]="minCount() ?? ''"
                   (input)="minCount.set(parseNum($any($event.target).value))"
                   class="input-ghost" data-testid="count-min" />
            <input type="number" min="1" placeholder="Max count"
                   [value]="maxCount() ?? ''"
                   (input)="maxCount.set(parseNum($any($event.target).value))"
                   class="input-ghost" data-testid="count-max" />
          </div>
          <p *ngIf="countConstraintEnabled()" class="text-[12px] text-outline mt-2">Either, both, or neither is fine.</p>
        </div>

        <p *ngIf="constraintError()" class="text-red-500 text-sm" data-testid="constraint-error">{{ constraintError() }}</p>
      </section>
```

- [ ] **Step 24.3: Replace the class state**

In the class:

- Remove these old signals:
  ```ts
  taskType          = signal<'time' | 'count' | 'frequency'>('count');
  targetCount       = signal<number>(10);
  targetMinutes     = signal<number>(60);
  selectedFrequency = signal<string>('daily');
  ```
- Remove the helper methods `increment`, `decrement`, `incrementTime`, `decrementTime` and the `taskTypes`, `frequencies` arrays.
- Remove `previewIcon`, `previewGoalLabel`, `previewCounter` computed properties or update them to no longer reference removed signals.
- Add these signals next to the existing `needsTimeSlot`:

  ```ts
  timeConstraintEnabled  = signal(false);
  minTimeMinutes         = signal<number | null>(null);
  maxTimeMinutes         = signal<number | null>(null);
  countConstraintEnabled = signal(false);
  minCount               = signal<number | null>(null);
  maxCount               = signal<number | null>(null);
  constraintError        = signal<string | null>(null);
  ```
- Add a helper:
  ```ts
  parseNum(v: string): number | null {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  ```

- [ ] **Step 24.4: Update `toPlannedTaskInput` mapping**

In `toPlannedTaskInput(title)`:

Replace the line:
```ts
const isTimeTask = this.taskType() === 'time';
const minutes = isTimeTask ? this.targetMinutes() : 30;
```
With:
```ts
const minutes = 30; // default duration for queue drops elsewhere; no longer driven by task type.
```

Append these field assignments before the return statement:

```ts
    const minTimeMinutes = this.timeConstraintEnabled() ? this.minTimeMinutes() : null;
    const maxTimeMinutes = this.timeConstraintEnabled() ? this.maxTimeMinutes() : null;
    const minCount       = this.countConstraintEnabled() ? this.minCount() : null;
    const maxCount       = this.countConstraintEnabled() ? this.maxCount() : null;
```

And update the returned object to spread them in:

```ts
return {
  title, goal: this.selectedGoal(), color: '#451de3',
  cadence, needsTimeSlot, startTime, endTime, weekdays, monthDays,
  minTimeMinutes, maxTimeMinutes, minCount, maxCount,
};
```

- [ ] **Step 24.5: Add submit-time validation**

In `createTask()`, immediately after the existing `if (!title) return;`, add:

```ts
this.constraintError.set(null);
if (this.timeConstraintEnabled()
    && this.minTimeMinutes() != null && this.maxTimeMinutes() != null
    && this.maxTimeMinutes()! < this.minTimeMinutes()!) {
  this.constraintError.set('Max minutes must be at least Min minutes'); return;
}
if (this.countConstraintEnabled()
    && this.minCount() != null && this.maxCount() != null
    && this.maxCount()! < this.minCount()!) {
  this.constraintError.set('Max count must be at least Min count'); return;
}
```

- [ ] **Step 24.6: Verify build**

```bash
npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 24.7: Checkpoint.**

---

## Phase K — Playwright e2e

### Task 25: schedule-day.spec.ts

**Files:**
- Create: `apps/e2e/tests/schedule-day.spec.ts`

- [ ] **Step 25.1: Create the spec**

```ts
import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8080/api';

async function resetDb(page: Page) { await page.request.post(`${API}/test/reset`); }
async function uniqueEmail() { return `s3d-${Date.now()}-${Math.floor(Math.random()*1e6)}@test.local`; }

async function registerAndOnboard(page: Page) {
  const email = await uniqueEmail();
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('S3 Day');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('password123');
  await page.getByTestId('register-submit').click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByTestId('onboarding-age').fill('28');
  await page.getByTestId('onboarding-occupation').fill('Eng');
  await page.getByTestId('onboarding-bedtime').fill('22:30');
  await page.getByTestId('onboarding-waketime').fill('06:30');
  await page.getByTestId('onboarding-submit').click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function token(page: Page): Promise<string> {
  return await page.evaluate(() => localStorage.getItem('timixa_token')!);
}

async function createTask(page: Page, body: any) {
  const t = await token(page);
  const res = await page.request.post(`${API}/planned-tasks`, {
    headers: { Authorization: `Bearer ${t}` },
    data: body,
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function getTask(page: Page, id: string) {
  const t = await token(page);
  const res = await page.request.get(`${API}/planned-tasks/${id}`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  return res.json();
}

test.beforeEach(async ({ page }) => {
  await resetDb(page);
  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('drag DAILY task from queue onto 10:00 → task gets startTime', async ({ page }) => {
  await registerAndOnboard(page);
  const t = await createTask(page, {
    title: 'Stretch', cadence: 'DAILY', needsTimeSlot: true,
  });
  await page.goto('/schedule');
  const queue = page.getByTestId(`day-queue-${t.id}`);
  const slot10 = page.getByTestId('day-slot-10');
  await queue.dragTo(slot10);
  await expect(page.getByTestId(`day-bar-${t.id}`)).toBeVisible();
  const after = await getTask(page, t.id);
  expect(after.startTime).toBe('10:00');
  expect(after.endTime).toBe('11:00');
});

test('skip DAILY bar → bar disappears (SKIP exception, no popup)', async ({ page }) => {
  await registerAndOnboard(page);
  const t = await createTask(page, {
    title: 'Stretch', cadence: 'DAILY', needsTimeSlot: true,
    startTime: '10:00', endTime: '11:00',
  });
  await page.goto('/schedule');
  await expect(page.getByTestId(`day-bar-${t.id}`)).toBeVisible();
  await page.getByTestId(`day-skip-${t.id}`).click();
  await expect(page.getByTestId(`day-bar-${t.id}`)).toHaveCount(0);
});
```

- [ ] **Step 25.2: Run the spec**

```bash
cd apps/e2e && ../../node_modules/.bin/playwright test tests/schedule-day.spec.ts
```

Expected: 2 passing.

- [ ] **Step 25.3: Checkpoint.**

---

### Task 26: schedule-week.spec.ts

**Files:**
- Create: `apps/e2e/tests/schedule-week.spec.ts`

- [ ] **Step 26.1: Create the spec**

```ts
import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8080/api';

async function resetDb(page: Page) { await page.request.post(`${API}/test/reset`); }
async function uniqueEmail() { return `s3w-${Date.now()}-${Math.floor(Math.random()*1e6)}@test.local`; }

async function registerAndOnboard(page: Page) {
  const email = await uniqueEmail();
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('S3 Week');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('password123');
  await page.getByTestId('register-submit').click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByTestId('onboarding-age').fill('28');
  await page.getByTestId('onboarding-occupation').fill('Eng');
  await page.getByTestId('onboarding-bedtime').fill('22:30');
  await page.getByTestId('onboarding-waketime').fill('06:30');
  await page.getByTestId('onboarding-submit').click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function token(page: Page): Promise<string> {
  return await page.evaluate(() => localStorage.getItem('timixa_token')!);
}

async function createTask(page: Page, body: any) {
  const t = await token(page);
  const res = await page.request.post(`${API}/planned-tasks`, {
    headers: { Authorization: `Bearer ${t}` },
    data: body,
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function getTask(page: Page, id: string) {
  const t = await token(page);
  const res = await page.request.get(`${API}/planned-tasks/${id}`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  return res.json();
}

function thisMonday(): Date {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  d.setHours(0,0,0,0);
  return d;
}
function isoOfDay(weekday: 'MON'|'TUE'|'WED'|'THU'|'FRI'|'SAT'|'SUN'): string {
  const map = { MON:0, TUE:1, WED:2, THU:3, FRI:4, SAT:5, SUN:6 };
  const d = thisMonday(); d.setDate(d.getDate() + map[weekday]);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

test.beforeEach(async ({ page }) => {
  await resetDb(page);
  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('drag WEEKLY bar across days → popup → No keeps exceptions', async ({ page }) => {
  await registerAndOnboard(page);
  const t = await createTask(page, {
    title: 'Gym', cadence: 'WEEKLY',
    weekdays: ['MONDAY','WEDNESDAY','FRIDAY'],
    needsTimeSlot: true, startTime: '07:00', endTime: '08:00',
  });
  await page.goto('/schedule/week');
  const wedIso = isoOfDay('WED');
  const thuIso = isoOfDay('THU');
  const wedBar = page.getByTestId(`week-bar-${t.id}-${wedIso}`);
  const thuCol = page.getByTestId(`week-col-${thuIso}`);
  await wedBar.dragTo(thuCol);
  await expect(page.getByTestId('exception-popup')).toBeVisible();
  await page.getByTestId('exception-popup-no').click();
  const after = await getTask(page, t.id);
  expect(new Set(after.weekdays)).toEqual(new Set(['MONDAY','WEDNESDAY','FRIDAY']));
  expect(after.exceptions.map((e: any) => `${e.date}:${e.type}`).sort())
    .toEqual([`${thuIso}:ADD`, `${wedIso}:SKIP`].sort());
});

test('drag WEEKLY bar across days → popup → Yes promotes', async ({ page }) => {
  await registerAndOnboard(page);
  const t = await createTask(page, {
    title: 'Gym', cadence: 'WEEKLY',
    weekdays: ['MONDAY','WEDNESDAY','FRIDAY'],
    needsTimeSlot: true, startTime: '07:00', endTime: '08:00',
  });
  await page.goto('/schedule/week');
  const wedBar = page.getByTestId(`week-bar-${t.id}-${isoOfDay('WED')}`);
  const thuCol = page.getByTestId(`week-col-${isoOfDay('THU')}`);
  await wedBar.dragTo(thuCol);
  await expect(page.getByTestId('exception-popup')).toBeVisible();
  await page.getByTestId('exception-popup-yes').click();
  await expect(page.getByTestId('exception-popup')).toHaveCount(0);
  const after = await getTask(page, t.id);
  expect(new Set(after.weekdays)).toEqual(new Set(['MONDAY','THURSDAY','FRIDAY']));
  expect(after.exceptions).toEqual([]);
});
```

- [ ] **Step 26.2: Run the spec**

```bash
../../node_modules/.bin/playwright test tests/schedule-week.spec.ts
```

Expected: 2 passing. If `dragTo` is flaky, use `force: true` on the drop target.

- [ ] **Step 26.3: Checkpoint.**

---

### Task 27: new-task-constraints.spec.ts

**Files:**
- Create: `apps/e2e/tests/new-task-constraints.spec.ts`

- [ ] **Step 27.1: Create the spec**

```ts
import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8080/api';

async function resetDb(page: Page) { await page.request.post(`${API}/test/reset`); }
async function uniqueEmail() { return `s3c-${Date.now()}-${Math.floor(Math.random()*1e6)}@test.local`; }

async function registerAndOnboard(page: Page) {
  const email = await uniqueEmail();
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('S3 C');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('password123');
  await page.getByTestId('register-submit').click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByTestId('onboarding-age').fill('28');
  await page.getByTestId('onboarding-occupation').fill('Eng');
  await page.getByTestId('onboarding-bedtime').fill('22:30');
  await page.getByTestId('onboarding-waketime').fill('06:30');
  await page.getByTestId('onboarding-submit').click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.beforeEach(async ({ page }) => {
  await resetDb(page);
  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('both cards default OFF; toggling ON shows the fields', async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto('/new-task');
  await expect(page.getByTestId('time-fields')).toHaveCount(0);
  await expect(page.getByTestId('count-fields')).toHaveCount(0);
  await page.getByTestId('time-toggle').check();
  await expect(page.getByTestId('time-fields')).toBeVisible();
  await page.getByTestId('count-toggle').check();
  await expect(page.getByTestId('count-fields')).toBeVisible();
});

test('save with only max-minutes → backend stores minTime=null, maxTime=60', async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto('/new-task');
  await page.locator('input[placeholder="e.g., Study, Exercise"]').fill('Read');
  await page.getByTestId('time-toggle').check();
  await page.getByTestId('time-max').fill('60');
  await page.getByTestId('new-task-save').click();
  await expect(page).toHaveURL(/\/schedule$/);

  const t = await page.evaluate(() => localStorage.getItem('timixa_token')!);
  const list = await page.request.get(`${API}/planned-tasks`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json());
  const created = list.find((x: any) => x.title === 'Read');
  expect(created.minTimeMinutes).toBeNull();
  expect(created.maxTimeMinutes).toBe(60);
});

test('save with max < min → error shown, no submit', async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto('/new-task');
  await page.locator('input[placeholder="e.g., Study, Exercise"]').fill('Bad');
  await page.getByTestId('time-toggle').check();
  await page.getByTestId('time-min').fill('60');
  await page.getByTestId('time-max').fill('30');
  await page.getByTestId('new-task-save').click();
  await expect(page.getByTestId('constraint-error')).toBeVisible();
  // URL should not have changed.
  await expect(page).toHaveURL(/\/new-task$/);
});
```

- [ ] **Step 27.2: Run the spec**

```bash
../../node_modules/.bin/playwright test tests/new-task-constraints.spec.ts
```

Expected: 3 passing.

- [ ] **Step 27.3: Run the full e2e suite**

```bash
../../node_modules/.bin/playwright test
```

Expected: Slice 1 (7) + Slice 2 (8) + Slice 3 (7) = 22 passing.

- [ ] **Step 27.4: Checkpoint.**

---

## Phase L — Final verification

### Task 28: Full slice verification

- [ ] **Step 28.1: Backend test suite**

```bash
cd /Users/thotakuramaneesha/Desktop/Timixa/Timixa/apps/backend-java && SPRING_PROFILES_ACTIVE=dev ./mvnw test
```

Expected: all tests pass (Slice 1 + 2 + 3).

- [ ] **Step 28.2: Frontend production build**

```bash
cd /Users/thotakuramaneesha/Desktop/Timixa/Timixa/apps/frontend && npx ng build
```

Expected: BUILD SUCCESS.

- [ ] **Step 28.3: Playwright suite**

```bash
cd /Users/thotakuramaneesha/Desktop/Timixa/Timixa/apps/e2e && ../../node_modules/.bin/playwright test
```

Expected: 22 passing.

- [ ] **Step 28.4: Manual walk-through**

Start all three servers per the previous slice's runbook. Fresh user, then:

1. Create a WEEKLY task `[MON, WED, FRI]` via the New Task form. Toggle Time card ON, fill only Min minutes (30). Save. Land on `/schedule/week`.
2. Find your 3 bars (Mon / Wed / Fri). Drag the Wednesday bar to Thursday. Popup appears.
3. Click "No, just this date". Reload. This week shows MON/WED/FRI/THU (4 bars; Wed has SKIP + Thu has ADD). Next week shows MON/WED/FRI (3 bars).
4. Drag the Wednesday bar to Thursday again. Popup. Click "Yes, every week". Reload. Both weeks show MON/THU/FRI.
5. Open `/schedule` (day view). Drag the bar from one hour slot to another → time updates → reload, time stays.
6. Open New Task. Toggle Count card ON, set Max=10 leave Min empty. Save. From dashboard or API verify `minCount=null, maxCount=10`.
7. Reset DB → all schedule pages empty.

- [ ] **Step 28.5: Final checkpoint.** Slice 3 is complete. Ready for Slice 4 (per-occurrence time overrides, calendar editing, constraint enforcement / soft warnings, notification settings).

---

## Spec coverage check

| Spec section | Implementing tasks |
|---|---|
| § 4 Domain model — constraints + exceptions + applies-on-date | Tasks 1, 2, 3, 4, 11 |
| § 5 REST API — new endpoints + modified responses | Tasks 5, 6, 7, 10, 13, 16 |
| § 6 Spring Boot package layout | Tasks 1–13, 16 |
| § 7 Frontend wiring — model, service, popup, schedule pages, calendar, new task UI | Tasks 14, 15, 17, 18, 19, 20, 21, 22, 23, 24 |
| § 8 Frontend ↔ backend interaction happy paths | Tasks 19, 21, 25, 26 |
| § 9 Testing strategy | Tasks 9, 10, 12, 13, 25, 26, 27 |
| § 10 Verification | Task 28 |
| § 11 Future work (not Slice 3) | Documented in spec; not implemented |
