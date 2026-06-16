# Timixa Slice 2 — PlannedTask + Dashboard Design

**Status:** approved (brainstorming complete, ready for plan).
**Date:** 2026-06-05.
**Builds on:** Slice 1 (`docs/superpowers/specs/2026-06-03-timixa-slice1-auth-onboarding-design.md`).

## 1. Overview

Slice 2 introduces the `PlannedTask` entity — a user-scoped, cadence-driven, recurring task template — and surfaces it on the existing Today dashboard. The dashboard gains three new sections (Now card, Today's Plan list, Done collapsible) and one banner (Unscheduled). The existing New Task page is rewired to persist into the real backend instead of mock signals; its visual layout is left untouched. No schedule/calendar pages, no constraints (time/count/frequency), no notification config — those are explicit Slice 3+ concerns.

### Context

Slice 1 stood up Spring Boot on `:8080`, JWT auth, and the `register → onboarding → dashboard` flow. After login, the dashboard renders but stays empty — habit endpoints proxy to Express which doesn't accept Spring Boot JWTs, and there's no other server-owned data yet. Slice 2 fills the dashboard with real, user-owned data from Spring Boot. Habits remain mock-backed; they are left in place but no longer the only thing on the dashboard.

## 2. Scope

### In scope

- `PlannedTask` JPA entity + `PlannedTaskCompletion` companion (per-day completion log).
- Spring Boot REST endpoints under `/api/planned-tasks/**`, behind the existing JWT filter.
- Flyway migration `V2__planned_tasks.sql` (prod profile).
- Angular `PlannedTask` model + `PlannedTaskService` with signal-based state.
- Today dashboard: Now card, Unscheduled banner, Today's Plan list, Done collapsible — all derived from `PlannedTaskService`.
- Inline scheduling popover inside the Unscheduled banner (start / end time inputs + Save).
- New Task page (`features/new-task/new-task.component.ts`): `createTask()` rewired to `POST /api/planned-tasks`; field mapping documented in § 9. Visuals untouched.
- Backend unit/integration tests for the new endpoints; Playwright e2e for the dashboard flow.

### Out of scope

- Time, count, and frequency constraints (the three optional structs from the original PLAN.md).
- Notification config (atStart/atEnd/customOffsets).
- Schedule day/week/month pages, calendar view, drag/drop scheduling.
- Bedtime summary, insights/analytics revamp.
- Habit migration to Spring Boot.
- Recurrence enforcement against frequency rules (e.g., "you planned 4 sessions but cadence is 3×/week").
- Goals as first-class entities — `goal` stays a free-text label on `PlannedTask` (no goals table).
- A "schedule for today" CTA that navigates anywhere — Unscheduled banner schedules inline.

## 3. Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| Scope shape | B + Now card + Unscheduled banner (no New Task UI rewrite, no schedule pages) |
| Data model fidelity | Minimal model — cadence stored, constraints/notifications deferred |
| Recurrence semantics | `PlannedTask` is a template; "today's list" is computed server-side per cadence |
| Default cadence | `DAILY` when no schedule accordion is opened (habit tracker default) |
| Per-day completion | Separate `planned_task_completions` table keyed `(taskId, completedDate)` |
| Create flow | Rewire existing New Task page to backend; do not rewrite the form |
| Dropped form fields | `taskType`, `targetCount`/`targetMinutes`, notification toggles, deep recurrence rules — silently ignored |
| Goals | Free-text label on `PlannedTask.goal`; no goals table |
| Frontend state | Signal-based service, dashboard reads computed signals; no global store |
| Java version | 20 (carries over from Slice 1; Java 21 is the target whenever available) |

## 4. Domain model

### `PlannedTask` entity (`com.timixa.backend.task.PlannedTask`)

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | UUID | PK, generated in `@PrePersist` |
| `user_id` | UUID | FK → `users.id`, not null, indexed |
| `title` | varchar(120) | not null |
| `goal` | varchar(80) | nullable |
| `color` | varchar(9) | not null, default `#451de3`, hex `#RRGGBB` or `#RRGGBBAA` |
| `cadence` | varchar(16) | not null, one of `ONCE`/`DAILY`/`WEEKLY`/`MONTHLY` |
| `needs_time_slot` | boolean | not null, default `true` |
| `start_time` | varchar(5) | nullable, `HH:mm` |
| `end_time` | varchar(5) | nullable, `HH:mm` |
| `scheduled_date` | date | nullable, **ONCE only** |
| `weekdays` | varchar(27) | nullable, CSV of `MON,TUE,WED,THU,FRI,SAT,SUN`, **WEEKLY only** |
| `month_days` | varchar(96) | nullable, CSV of integers 1..31, **MONTHLY only** |
| `created_at` | timestamp | audited |
| `updated_at` | timestamp | audited |

JPA: `@EntityListeners(AuditingEntityListener.class)`, same pattern as `User`.

### `PlannedTaskCompletion` entity (`com.timixa.backend.task.PlannedTaskCompletion`)

| Column | Type |
|---|---|
| `task_id` | UUID, FK → `planned_tasks.id` ON DELETE CASCADE |
| `completed_date` | date |
| `completed_at` | timestamp, not null |

Composite primary key `(task_id, completed_date)` — a recurring task gets at most one completion per calendar day. Uncompleting deletes the row.

### `Cadence` enum

```java
public enum Cadence { ONCE, DAILY, WEEKLY, MONTHLY }
```

### DTOs (Java records)

```java
public record PlannedTaskRequest(
    @NotBlank @Size(max = 120) String title,
    @Size(max = 80) String goal,
    @Pattern(regexp = "^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$") String color,
    @NotNull Cadence cadence,
    Boolean needsTimeSlot,
    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$") String startTime,
    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$") String endTime,
    LocalDate scheduledDate,
    Set<DayOfWeek> weekdays,
    Set<@Min(1) @Max(31) Integer> monthDays
) {}

public record PlannedTaskUpdateRequest(
    @Size(max = 120) String title,
    @Size(max = 80) String goal,
    @Pattern(...) String color,
    Cadence cadence,
    Boolean needsTimeSlot,
    @Pattern(...) String startTime,
    @Pattern(...) String endTime,
    LocalDate scheduledDate,
    Set<DayOfWeek> weekdays,
    Set<@Min(1) @Max(31) Integer> monthDays
) {}

public record PlannedTaskResponse(
    UUID id, UUID userId, String title, String goal, String color,
    Cadence cadence, boolean needsTimeSlot,
    String startTime, String endTime,
    LocalDate scheduledDate, Set<DayOfWeek> weekdays, Set<Integer> monthDays,
    boolean completedToday,
    Instant createdAt, Instant updatedAt
) {}
```

`completedToday` is always populated relative to `LocalDate.now()` (server local date) — independent of any `?date=` filter. It reflects whether a completion row exists for the server's current local date. Slice 2 only queries `?date=today` so the field name is accurate; querying past/future dates is allowed but the field still answers "is this completed today" (a known imprecision parked for a later slice that needs historical views).

### Cross-field validation

Enforced in `PlannedTaskService` (throws `IllegalArgumentException` → 400 `VALIDATION_ERROR`). Field-level constraint annotations cover format only.

- `cadence=ONCE` → `scheduledDate` required; `weekdays`/`monthDays` must be null/empty.
- `cadence=DAILY` → `scheduledDate`/`weekdays`/`monthDays` must be null/empty.
- `cadence=WEEKLY` → `weekdays` non-empty; `scheduledDate`/`monthDays` null/empty.
- `cadence=MONTHLY` → `monthDays` non-empty; `scheduledDate`/`weekdays` null/empty.
- `needsTimeSlot=false` → `startTime`/`endTime` must be null.
- `startTime != null` → `endTime != null` AND `endTime > startTime` (string compare on `HH:mm` is safe).
- `needsTimeSlot=true` with no times is **allowed** — this is the "needs scheduling" state.

### "Applies on date" rule (server-side filter)

Given target `date d`:

- `ONCE` → `scheduledDate == d`.
- `DAILY` → always.
- `WEEKLY` → `d.dayOfWeek ∈ weekdays`.
- `MONTHLY` → `d.dayOfMonth ∈ monthDays`.

Encoded as a Spring Data JPA query with a CASE/UNION (or simpler: load all user tasks and filter in Java — Slice 2 user volumes are tiny). Implementation choice deferred to the plan.

### Repositories

```java
public interface PlannedTaskRepository extends JpaRepository<PlannedTask, UUID> {
    List<PlannedTask> findByUserIdOrderByCreatedAtDesc(UUID userId);
}

public interface PlannedTaskCompletionRepository
        extends JpaRepository<PlannedTaskCompletion, PlannedTaskCompletionId> {
    Set<UUID> findTaskIdsByTaskIdInAndCompletedDate(Collection<UUID> taskIds, LocalDate date);
    void deleteByTaskIdAndCompletedDate(UUID taskId, LocalDate date);
}
```

### DB schema — `V2__planned_tasks.sql` (prod only; dev uses `ddl-auto: create-drop`)

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

## 5. REST API

All endpoints are user-scoped — every read filters by `principal.id`, every write checks ownership and 404s on mismatch. The existing JWT filter chain protects them via `.anyRequest().authenticated()` (no SecurityConfig change needed).

| Method | Path | Body | 2xx Response | Errors |
|---|---|---|---|---|
| `GET` | `/api/planned-tasks` | — | `200` `PlannedTaskResponse[]` — all user tasks, newest first | 401 |
| `GET` | `/api/planned-tasks?date=YYYY-MM-DD` | — | `200` `PlannedTaskResponse[]` — only tasks applying on `date` (default `today`), with `completedToday` populated | 401, 400 (bad date) |
| `POST` | `/api/planned-tasks` | `PlannedTaskRequest` | `201` `PlannedTaskResponse` | 401, 400 |
| `PATCH` | `/api/planned-tasks/{id}` | `PlannedTaskUpdateRequest` | `200` `PlannedTaskResponse` | 401, 404, 400 |
| `POST` | `/api/planned-tasks/{id}/completions` | optional `{ "date": "YYYY-MM-DD" }`; default today | `201` `PlannedTaskResponse` with `completedToday=true` if date is today | 401, 404, 409 (already complete for that date) |
| `DELETE` | `/api/planned-tasks/{id}/completions/{date}` | — | `204` | 401, 404 |
| `DELETE` | `/api/planned-tasks/{id}` | — | `204` (cascade deletes completions) | 401, 404 |

### Error envelope

Reuses Slice 1's `ErrorResponse` and `GlobalExceptionHandler`. New entries:

| Exception | Status | `code` |
|---|---|---|
| `TaskNotFoundException` | 404 | `TASK_NOT_FOUND` |
| `TaskAlreadyCompleteException` | 409 | `TASK_ALREADY_COMPLETE` |
| `IllegalArgumentException` (cross-field validation) | 400 | `VALIDATION_ERROR` (reuses validation handler shape but without `fields`) |

## 6. Spring Boot package layout (delta from Slice 1)

```
apps/backend-java/src/main/java/com/timixa/backend/
├── task/                                    NEW
│   ├── PlannedTask.java                     entity
│   ├── PlannedTaskCompletion.java           entity
│   ├── PlannedTaskCompletionId.java         composite PK
│   ├── Cadence.java                         enum
│   ├── PlannedTaskRepository.java
│   ├── PlannedTaskCompletionRepository.java
│   ├── PlannedTaskService.java
│   ├── PlannedTaskController.java
│   └── dto/
│       ├── PlannedTaskRequest.java
│       ├── PlannedTaskUpdateRequest.java
│       └── PlannedTaskResponse.java
└── common/
    ├── TaskNotFoundException.java           NEW
    └── TaskAlreadyCompleteException.java    NEW
```

`GlobalExceptionHandler.java` gets two new `@ExceptionHandler` methods.

`src/main/resources/db/migration/V2__planned_tasks.sql` is added.

## 7. Frontend wiring

### New files

- `apps/frontend/src/app/core/models/planned-task.model.ts` — `PlannedTask`, `PlannedTaskInput`, `PlannedTaskCadence`.
- `apps/frontend/src/app/core/services/planned-task.service.ts` — signal-based store + HTTP methods.
- `apps/frontend/src/app/features/dashboard/today-dashboard/now-card.component.ts` — small standalone subcomponent.
- `apps/frontend/src/app/features/dashboard/today-dashboard/unscheduled-banner.component.ts` — banner + inline schedule popover.

### `PlannedTaskService` shape

State:

- `private _tasks = signal<PlannedTask[]>([])` — today's tasks (the date-scoped response).
- `readonly tasks = this._tasks.asReadonly()`.
- `readonly nowTask: Signal<PlannedTask | null>` — earliest non-completed task where `startTime ≤ HH:mm(now) < endTime`. Recomputes every minute via a `signal<Date>` ticker.
- `readonly upcomingToday: Signal<PlannedTask[]>` — non-completed today's tasks with `startTime > now`, sorted asc, excluding `nowTask`.
- `readonly unscheduledToday: Signal<PlannedTask[]>` — today's tasks with `needsTimeSlot=true` and `startTime == null`.
- `readonly completedToday: Signal<PlannedTask[]>` — today's tasks with `completedToday == true`.

Methods:

- `loadToday(): Observable<PlannedTask[]>` — `GET /api/planned-tasks?date=<today>`; replaces `_tasks`.
- `create(input: PlannedTaskInput): Observable<PlannedTask>` — `POST`; if the new task applies today, prepend to `_tasks`.
- `update(id, patch): Observable<PlannedTask>` — `PATCH`; replace in-place.
- `complete(id, date = today): Observable<PlannedTask>` — `POST /completions`; replace in-place.
- `uncomplete(id, date = today): Observable<void>` — `DELETE /completions/{date}`; flip `completedToday=false`.
- `scheduleForToday(id, startTime, endTime): Observable<PlannedTask>` — sets `startTime`/`endTime` via `update`. For ONCE tasks the row already has `scheduledDate=today` (that's why it's in the banner); for DAILY/WEEKLY/MONTHLY it already applies today via its cadence. So no `scheduledDate` write is needed in either case — only the times.
- `delete(id): Observable<void>` — `DELETE`; remove from `_tasks`.

The service URL is `${environment.apiUrl}/planned-tasks`. The Slice 1 auth interceptor attaches the JWT automatically (this path is not in the public-prefix list).

### Dashboard component changes

File: `apps/frontend/src/app/features/dashboard/today-dashboard/today-dashboard.component.ts`. Modified, not rewritten. Habits section (greeting, Overall Daily Goal progress card, Today's Habits list) stays untouched.

`ngOnInit` adds `plannedTaskService.loadToday().subscribe()`. `ngOnDestroy` clears the minute ticker.

New sections, inserted in order between the Overall Progress Card and Today's Habits:

1. **Now card** — rendered only when `nowTask()` is non-null. Shows color bar, title, `HH:mm – HH:mm`, goal (small text), and a primary "Complete" button → `plannedTaskService.complete(id)`.
2. **Unscheduled banner** — rendered only when `unscheduledToday().length > 0`. Closed state: yellow soft-fill row with `"<n> task(s) need a time slot today"` and a chevron. Expanded state: each task as a row with an inline popover containing two `type=time` inputs and Save → `plannedTaskService.scheduleForToday(id, start, end)`.
3. **Today's Plan section** — rendered when `upcomingToday().length > 0`. Section header `Today's Plan`, then each task: color dot, title, `HH:mm – HH:mm`, goal, "Complete" button.
4. **Done collapsible** — rendered when `completedToday().length > 0`. Header `Done (n)` toggles a list of strikethrough rows. Each row has an "Undo" → `plannedTaskService.uncomplete(id)`.

The FAB and bottom navigation are unchanged.

### Modified files

- `apps/frontend/src/app/features/dashboard/today-dashboard/today-dashboard.component.ts` — add 4 sections, inject service, minute ticker.
- `apps/frontend/src/app/features/new-task/new-task.component.ts` — rewrite `createTask()` only (see § 9). Template and signals unchanged.

## 8. Frontend ↔ backend interaction (happy path)

1. User navigates to `/dashboard`. `TodayDashboardComponent.ngOnInit` calls `plannedTaskService.loadToday()`.
2. Service issues `GET /api/planned-tasks?date=2026-06-05` with `Authorization: Bearer …`.
3. Spring Boot validates token → `UserPrincipal` set. `PlannedTaskController` calls `PlannedTaskService.findForUserOnDate(principal.id, date)`.
4. Service loads tasks for user, filters in-memory by cadence rule, batch-loads completion rows for that date, maps to `PlannedTaskResponse[]` with `completedToday` populated.
5. Response returns; frontend service stores in `_tasks` signal.
6. Dashboard computed signals fire; Now card / banner / list / done section render in one pass.
7. User clicks "Complete" on the Now card → `POST /api/planned-tasks/{id}/completions` (empty body, server defaults to today). Server inserts row, returns updated response with `completedToday=true`. Service replaces in `_tasks`. Computed signals re-fire: `nowTask` becomes null (or next match), task moves into `completedToday` list.

## 9. New Task page bridging

File: `apps/frontend/src/app/features/new-task/new-task.component.ts`. The template, the three task-type buttons, the count/time/frequency parameter cards, the schedule accordion, the notification toggles, and the preview card all stay as-is. Only `createTask()` and its imports change.

### Field mapping (form state → `PlannedTaskInput`)

| Form state | → | `PlannedTaskInput` field |
|---|---|---|
| `taskName().trim()` | → | `title` (required) |
| `selectedGoal()` | → | `goal` |
| (constant for Slice 2) | → | `color: '#451de3'` |
| Schedule accordion closed (`isScheduled() === false`) | → | `cadence: 'DAILY'`, no times, `needsTimeSlot: true` |
| `isScheduled() === true`, `scheduleConfig().frequency === 'daily'` | → | `cadence: 'DAILY'` |
| `isScheduled() === true`, `frequency === 'weekly'` | → | `cadence: 'WEEKLY'`, `weekdays` ← `scheduleConfig().weeklyDays` mapped to `MON..SUN` (uppercase). If empty, fall back to today's weekday. |
| `isScheduled() === true`, `frequency === 'monthly'` | → | `cadence: 'MONTHLY'`, `monthDays: [today.getDate()]` (form has no day-of-month picker yet) |
| `isScheduled() === true`, `frequency === 'yearly'` | → | unsupported in Slice 2; coerced to `cadence: 'DAILY'` |
| `scheduleConfig().startTime` | → | `startTime` (HH:mm) |
| `scheduleConfig().endTime` or computed from `targetMinutes` via existing `addMinutesToTime` | → | `endTime` |

### Fields the form collects but Slice 2 ignores (silently dropped)

- `taskType` (`'time' | 'count' | 'frequency'`).
- `targetCount`, `targetMinutes` (only `targetMinutes` is used to *compute* `endTime` when the schedule has a start but no end).
- `notifyAtStart`, `notifyAtEnd`, `nightReminder`.
- `scheduleConfig().interval`, `dailyOption`, `endsOnDate`, custom-day expressions other than `weeklyDays`.

These will be wired in Slice 3+ when the New Task UI is rebuilt around the three-card constraint model.

### Behavior change in `createTask()`

```ts
createTask(): void {
  const title = this.taskName().trim();
  if (!title) return;
  this.saving.set(true);
  this.error.set(null);
  this.plannedTaskService.create(this.toPlannedTaskInput()).subscribe({
    next: () => { this.saving.set(false); this.location.back(); },
    error: (err) => {
      this.saving.set(false);
      this.error.set(err?.error?.message || 'Could not save task. Please try again.');
    },
  });
}
```

- Removes the calls to `habitService.addTask`, `scheduleService.addEvent`, `scheduleService.addUnscheduledTask`.
- Adds `saving = signal(false)` and `error = signal<string | null>(null)`.
- A red error line is rendered above the bottom "Create Task" button when `error()` is non-null (mirroring the Slice 1 login/register pattern).
- The Save button in the header and the bottom Create Task button both go through `createTask()` (same as today).

## 10. Testing strategy

### Backend (JUnit 5 + Spring Boot Test + H2)

`PlannedTaskServiceTest` (`@DataJpaTest`-ish, in-memory):
- ONCE / DAILY / WEEKLY / MONTHLY validation: each invalid combo throws `IllegalArgumentException`.
- "applies on date" rule for each cadence (boundary cases: scheduled_date == today, weekday match, day-of-month match).
- `completeTask` inserts a row, second call throws `TaskAlreadyCompleteException`.
- `uncomplete` removes the row; idempotent removal returns 204 even if no row exists (tested in controller layer).

`PlannedTaskControllerTest` (`@SpringBootTest` + `MockMvc` + real JWT, `@ActiveProfiles("dev")`):

- `POST /api/planned-tasks` 201 with valid DAILY + needsTimeSlot+times → returns response with `id`, `cadence=DAILY`, times present.
- `POST` 400 with WEEKLY but no weekdays.
- `POST` 400 with `needsTimeSlot=false` and `startTime` set.
- `POST` 401 without token.
- `GET /api/planned-tasks?date=…` returns DAILY task always, WEEKLY only when weekday matches, MONTHLY only when day matches.
- `GET` filters by `principal.id` — second user's tasks are invisible.
- `POST /completions` 201 → `completedToday=true`. Second call 409.
- `DELETE /completions/{date}` 204; subsequent `GET` shows `completedToday=false`.
- `PATCH /{id}` 200 updates only provided fields; cross-validation runs on the merged result.
- `DELETE /{id}` 204; cascade removes completions.

### Frontend (Karma/Jasmine — kept minimal)

`PlannedTaskService` happy paths against `HttpTestingController`:
- `loadToday` issues `GET ?date=<today>` and stores response.
- `create` issues POST and prepends.
- `complete` issues POST `/completions` and replaces in-place.
- `scheduleForToday` PATCHes start/end and replaces.

Dashboard component test:
- With mocked `PlannedTaskService` returning fixtures: Now card shows for in-window task; banner counts unscheduled correctly; clicking complete invokes service.

### Playwright e2e (`apps/e2e/tests/planned-tasks.spec.ts`, new file)

Each test uses the dev `/api/test/reset` endpoint to clear users + tasks (the reset endpoint is extended in § 11 to also truncate planned tasks).

1. Create task via New Task page → returns to dashboard → task appears under "Today's Plan".
2. Create a DAILY task with start/end straddling current time → Now card renders with that task.
3. Click "Complete" on Now card → task moves to "Done (1)"; Now card disappears (or shows next match).
4. Create a task with `needsTimeSlot=true` and no time (close the schedule accordion) → Unscheduled banner shows count 1.
5. Open banner, fill times, Save → task moves into Today's Plan list; banner disappears.
6. Create a WEEKLY task with weekdays = [today's weekday] → shows on dashboard; verify it would not show if weekday changes (re-run with weekdays = [tomorrow's weekday], assert empty).
7. Reload dashboard while on it → state hydrates from server, completed tasks stay in Done.

### Not tested in Slice 2

- Concurrent completion races (one user, one device assumption).
- Timezone correctness (everything runs in the user's local TZ; server reads `LocalDate.now()` using server TZ — fine for dev, parked for later).
- Performance / pagination (small N expected through Slice 2).

## 11. Verification checklist (manual end-to-end at slice exit)

1. Backend `./mvnw test` — all green (existing 23 + new PlannedTask tests).
2. Frontend `ng build` — production build clean.
3. Playwright `npm run e2e` — Slice 1 suite + new Slice 2 suite green.
4. Manual on `:4200`: register a fresh user → onboard → dashboard is empty (no planned tasks). Open New Task, create a DAILY task with start 09:00 / end 10:00. Returns to dashboard. Verify section appears.
5. Set system time to 09:30 (or create the task with current-time-straddling start/end). Verify Now card.
6. Click Complete. Verify Done section shows count 1, Now card disappears.
7. Reload. State persists. Done section still shows the completed task.
8. Create a task with `needsTimeSlot=true` and no time. Verify Unscheduled banner. Expand, schedule, verify it joins Today's Plan.
9. Reset the DB via `curl -X POST :8080/api/test/reset`, log in fresh, verify all sections empty.

The dev `TestResetController.reset` is extended to also truncate `planned_task_completions` and `planned_tasks` (in that order). The e2e harness depends on this.

## 12. Future work (not Slice 2)

- Constraints model: time (min/max minutes), count (min/max), frequency (cadence + occurrences) — the three optional structs from PLAN.md.
- Notification config and reminders.
- Schedule day/week/month editor pages — drag/drop, conflict detection, frequency-rule validator.
- Calendar (read-only) view with conflict / unscheduled top banners.
- Bedtime Summary page.
- Insights/Analytics revamp (Discipline %, Adherence %, 7d/30d chart).
- Migrating remaining Express endpoints (habits, projects, tasks, events, meetings, reminders, insights) into Spring Boot — the legacy proxy goes away one route at a time.
- Goals as a first-class entity with their own CRUD.
- Recurrence boundaries: `startDate` / `endDate` on `PlannedTask` so a task can be active only in a window.
- Timezone awareness on the server (today's date computed per-user).
