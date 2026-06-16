# Timixa Slice 3 — Schedule Pages + Exceptions + Constraints Design

**Status:** approved (brainstorming complete, ready for plan).
**Date:** 2026-06-07.
**Builds on:** Slice 1 (`docs/superpowers/specs/2026-06-03-timixa-slice1-auth-onboarding-design.md`), Slice 2 (`docs/superpowers/specs/2026-06-05-timixa-slice2-planned-tasks-dashboard-design.md`).

## 1. Overview

Slice 3 wires the day and week schedule pages to `PlannedTaskService` with drag-and-drop, introduces a per-date exception model so users can adjust a recurring schedule for *just this week* or promote a change to be permanent via a confirmation popup, and adds two optional constraint fields (Time min/max minutes, Count min/max) to the PlannedTask model and the New Task form. Month view and the calendar view become read-only renderings of planned tasks. The Frequency constraint from the original PLAN.md is dropped.

### Context

Slice 2 ended with planned tasks visible on the dashboard but with no way to assign or change their time slots through the UI — scheduling required calls to the API. The dashboard's Unscheduled banner correctly stopped trying to schedule inline (Slice 2.5) and instead routes to `/schedule`, but that page still renders mock `ScheduleService` data. Slice 3 closes the loop: drag-and-drop on the schedule pages mutates real `PlannedTask` rows. The exception model also lets users handle the realistic case where a recurring routine needs a one-off adjustment, without forcing them to choose between "edit the template forever" and "manually undo next week".

## 2. Scope

### In scope

- Backend `PlannedTaskException` entity + table.
- Backend constraint columns on `PlannedTask` (`min_time_minutes`, `max_time_minutes`, `min_count`, `max_count`).
- Flyway migration V3 for the four constraint columns and the exceptions table.
- Cross-field validation rules covering both the constraints and the exception type/cadence combinations.
- `GET /api/planned-tasks` responses now include an `exceptions` array per task; the "applies on date" rule honors exceptions.
- New endpoints `POST /api/planned-tasks/{id}/exceptions` and `DELETE /api/planned-tasks/{id}/exceptions/{date}`.
- `PlannedTaskService` (Angular) gains `addException`, `removeException`, `applyPermanently`, and `loadForWeek` methods.
- Schedule day view rewritten to read/write planned tasks: drag from queue, drag/resize bars, skip with optional permanent-promotion popup.
- Schedule week view rewritten similarly, with the additional cross-day drag flow that writes a SKIP+ADD pair and offers permanent-promotion.
- Schedule month view + calendar view become read-only renderings of planned tasks (no editing, no drag-drop).
- A shared `<exception-popup>` component.
- New Task page constraint UI: two optional cards (Time, Count), each with independently optional `min`/`max` inputs and a `<= 0` / `max < min` validation.
- Backend and Playwright tests covering all of the above.

### Out of scope

- Per-occurrence **time** overrides ("just this Tuesday at 8 instead of 7"). The exception row stores SKIP/ADD only, not a time override. Future slice.
- Drag-and-drop on the month view. Month is read-only this slice.
- Constraint enforcement / soft warnings ("you're scheduled 5×/week but max-count says 3"). Stored only. Future slice — the data going in is forward-compatible with adding warnings later.
- The Frequency constraint from PLAN.md. Dropped entirely after user feedback.
- Notification settings (atStart/atEnd/customOffsets). Future slice.
- Habit migration to Spring Boot. Continues to be mock-backed.
- Date-range bulk endpoint (`?from=...&to=...`). Week view issues 7 parallel date-scoped GETs.
- Goals as a first-class entity.

## 3. Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| Slice 3 scope | Schedule pages (day + week) wired + constraints stored + form UI (scope B with Frequency dropped) |
| Drag-drop semantics on WEEKLY | Default is exception (this-week-only); popup offers promotion to permanent template change |
| DAILY drag in week view | Updates `startTime`/`endTime` only — drop column ignored |
| Time changes (resize / drag bar in same day column) | Always template-level, no popup — no per-occurrence time overrides this slice |
| Cross-day drag | SKIP on original date + ADD on new date + popup |
| DAILY skip flow | No popup — there is no sensible "permanent" option (= delete the task), so SKIP applies only to that date |
| Exception type validation | ADD on covered date / SKIP on uncovered date rejected as 400 `EXCEPTION_NOT_ALLOWED` |
| Month / calendar | Read-only this slice |
| Constraint cards | Two cards (Time, Count) — default off; `min` and `max` both independently optional within each card; Frequency dropped |
| Constraint enforcement | None this slice — store only |
| Loading shape for week view | 7 parallel date-scoped GETs, no new range endpoint |
| Backend default profile | `prod` (CockroachDB), unchanged from Slice 2.5 |
| Tests | H2 for backend, e2e for the schedule and form flows |

## 4. Domain model

### `PlannedTask` — new columns

| Column | Type | Notes |
|---|---|---|
| `min_time_minutes` | INT4 nullable | TimeConstraint.min; must be `> 0` if set |
| `max_time_minutes` | INT4 nullable | TimeConstraint.max; must be `> 0` if set; `>= min_time_minutes` if both set |
| `min_count` | INT4 nullable | CountConstraint.min; must be `> 0` if set |
| `max_count` | INT4 nullable | CountConstraint.max; must be `> 0` if set; `>= min_count` if both set |

Each "card" is considered enabled by the frontend iff at least one of its two fields is non-null. The backend doesn't have a separate "enabled" flag — it only knows the four nullable values.

### `PlannedTaskException` — new entity (`planned_task_exceptions`)

| Column | Type | Notes |
|---|---|---|
| `task_id` | UUID, FK → `planned_tasks.id` ON DELETE CASCADE | |
| `exception_date` | DATE | The local calendar date the exception applies to |
| `exception_type` | VARCHAR(8) | `"SKIP"` or `"ADD"` |
| `created_at` | TIMESTAMPTZ NOT NULL | Audit only |

Composite primary key `(task_id, exception_date)` — at most one exception per `(task, date)`.

### `ExceptionType` enum (Java)

```java
public enum ExceptionType { SKIP, ADD }
```

### "Applies on date" rule (updated)

Given a target `date d`:
- `ONCE` → `scheduledDate == d` (unchanged).
- `DAILY` → applies UNLESS there is a `SKIP` exception for `d`.
- `WEEKLY` → `(d.dayOfWeek ∈ weekdays AND no SKIP exception for d)` OR `(d.dayOfWeek ∉ weekdays AND there is an ADD exception for d)`.
- `MONTHLY` → same as WEEKLY but `d.dayOfMonth` against `monthDays`.

### Exception validation

Enforced in `PlannedTaskExceptionService` (throws `ExceptionNotAllowedException` → 400 `EXCEPTION_NOT_ALLOWED`):

- `cadence == ONCE` → any exception rejected.
- `cadence == DAILY` and `type == ADD` → rejected.
- `type == ADD` on a date already covered by the cadence (no-op) → rejected.
- `type == SKIP` on a date NOT covered by the cadence (no-op) → rejected.

`ExceptionAlreadyExistsException` → 409 `EXCEPTION_ALREADY_EXISTS` when `(taskId, date)` already has a row. The frontend handles this by retrying the desired action (e.g. write a DELETE then re-POST).

### DTOs (Java records — additive only)

```java
public record PlannedTaskExceptionRequest(
    @NotNull LocalDate date,
    @NotNull ExceptionType type
) {}

public record PlannedTaskExceptionResponse(
    LocalDate date,
    ExceptionType type
) {}
```

`PlannedTaskRequest` / `PlannedTaskUpdateRequest` gain four optional fields:

```java
@Min(1) Integer minTimeMinutes,
@Min(1) Integer maxTimeMinutes,
@Min(1) Integer minCount,
@Min(1) Integer maxCount
```

`PlannedTaskResponse` gains:

```java
Integer minTimeMinutes,
Integer maxTimeMinutes,
Integer minCount,
Integer maxCount,
List<PlannedTaskExceptionResponse> exceptions   // always present, possibly empty
```

### Flyway V3 — `V3__planned_task_constraints_and_exceptions.sql`

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

## 5. REST API

### New endpoints

**`POST /api/planned-tasks/{id}/exceptions`**

Body: `{ "date": "YYYY-MM-DD", "type": "SKIP" | "ADD" }`

`201` response: full `PlannedTaskResponse` with the new exception included in its `exceptions` array.

Errors:
- `401` no token
- `404` task not found / not owned
- `400` `EXCEPTION_NOT_ALLOWED` — see § 4 validation rules
- `409` `EXCEPTION_ALREADY_EXISTS` — `(taskId, date)` already has a row

**`DELETE /api/planned-tasks/{id}/exceptions/{date}`**

`{date}` is path-segment `YYYY-MM-DD`. `204` on success.

Errors:
- `401` no token
- `404` task or exception not found

### Modified endpoints

`POST /api/planned-tasks` and `PATCH /api/planned-tasks/{id}` accept the four new optional constraint fields. Backend rejects `400 VALIDATION_ERROR` (reusing the existing `IllegalArgumentException` handler) when:
- A non-null value is `<= 0`.
- Both `minTimeMinutes` and `maxTimeMinutes` are set and `max < min`.
- Both `minCount` and `maxCount` are set and `max < min`.

`GET /api/planned-tasks` (with or without `date`) — every task in the response now includes:
- The four constraint fields (nullable).
- An `exceptions` array (always present, possibly empty).

The date-scoped filter respects exceptions per § 4.

### Error envelope additions

| Exception | Status | `code` |
|---|---|---|
| `ExceptionNotAllowedException` | 400 | `EXCEPTION_NOT_ALLOWED` |
| `ExceptionAlreadyExistsException` | 409 | `EXCEPTION_ALREADY_EXISTS` |

### No "apply permanently" endpoint

The popup flow is implemented client-side as two sequential calls when the user clicks "Yes":

1. `DELETE /api/planned-tasks/{id}/exceptions/{date}` removes the freshly-written exception.
2. `PATCH /api/planned-tasks/{id}` with the new `weekdays` (or `monthDays`) mutates the template.

If either call fails, the frontend keeps the exception in place and surfaces the error.

## 6. Spring Boot package layout (delta from Slice 2)

```
apps/backend-java/src/main/java/com/timixa/backend/
├── task/
│   ├── PlannedTask.java                          edited: four new fields + setters/getters
│   ├── PlannedTaskException.java                 NEW entity
│   ├── PlannedTaskExceptionId.java               NEW composite PK
│   ├── ExceptionType.java                        NEW enum
│   ├── PlannedTaskExceptionRepository.java       NEW
│   ├── PlannedTaskService.java                   edited: validate constraints, applies-on-date now reads exceptions
│   ├── PlannedTaskExceptionService.java          NEW
│   ├── PlannedTaskController.java                edited: read constraint fields in DTOs
│   ├── PlannedTaskExceptionController.java       NEW (the two endpoints)
│   └── dto/
│       ├── PlannedTaskRequest.java               edited: four new optional fields
│       ├── PlannedTaskUpdateRequest.java         edited: four new optional fields
│       ├── PlannedTaskResponse.java              edited: exceptions list + four constraints
│       ├── PlannedTaskExceptionRequest.java      NEW
│       └── PlannedTaskExceptionResponse.java     NEW
└── common/
    ├── ExceptionNotAllowedException.java         NEW
    ├── ExceptionAlreadyExistsException.java      NEW
    └── GlobalExceptionHandler.java               edited: two new handlers

src/main/resources/db/migration/V3__planned_task_constraints_and_exceptions.sql   NEW
```

## 7. Frontend wiring

### `PlannedTask` model — new fields

`apps/frontend/src/app/core/models/planned-task.model.ts`:

```ts
export interface PlannedTaskException {
  date: string;            // YYYY-MM-DD
  type: 'SKIP' | 'ADD';
}

export interface PlannedTask {
  // ... existing fields ...
  minTimeMinutes?: number;
  maxTimeMinutes?: number;
  minCount?: number;
  maxCount?: number;
  exceptions: PlannedTaskException[];
}

export interface PlannedTaskInput {
  // ... existing ...
  minTimeMinutes?: number | null;
  maxTimeMinutes?: number | null;
  minCount?: number | null;
  maxCount?: number | null;
}

export type PlannedTaskUpdate = Partial<PlannedTaskInput>;
```

### `PlannedTaskService` — new methods

```ts
loadForDate(date: string): Observable<PlannedTask[]>     // generalization of loadToday()
loadForWeek(weekStart: string): Observable<Map<string, PlannedTask[]>>

addException(id: string, date: string, type: 'SKIP'|'ADD'): Observable<PlannedTask>
removeException(id: string, date: string): Observable<PlannedTask>
applyPermanently(
  id: string,
  date: string,
  template: { weekdays?: Weekday[]; monthDays?: number[] },
): Observable<PlannedTask>
```

`applyPermanently` chains `removeException(id, date)` then `update(id, template)`, returning the final task. The local `_tasks` signal is updated by each underlying call's `tap` so consumers stay in sync.

`loadForWeek(weekStart)` issues 7 parallel `loadForDate` calls and resolves into a `Map<dateIso, PlannedTask[]>`. The schedule-week component subscribes once per `weekStart` change.

`loadToday()` is implemented as `loadForDate(todayIso())` and is kept as an alias so the dashboard does not have to change.

### `<exception-popup>` shared component

`apps/frontend/src/app/features/schedule/exception-popup.component.ts`:

```ts
@Component({
  selector: 'app-exception-popup',
  standalone: true,
  ...
})
export class ExceptionPopupComponent {
  @Input() title!: string;          // e.g. "Add Tuesday to every week's Gym?"
  @Input() yesLabel: string = 'Yes, every week';
  @Input() noLabel: string  = 'No, just this date';
  @Output() yes = new EventEmitter<void>();
  @Output() no  = new EventEmitter<void>();
}
```

A modal overlay (inline, no router). The host component decides what each emit does.

### `schedule-day.component.ts` — rewritten

Layout:
- Header: previous-day / today / next-day controls + the current date.
- Unscheduled queue (top): cards for tasks where `needsTimeSlot && !startTime`. Drag handle on each card.
- 24-row hour grid. Tasks rendered as absolutely-positioned bars from `startTime` to `endTime`.

Interactions (also documented in § 4 of the brainstorm):

- **Drag queue card → hour slot.** `update(id, { startTime: HH:00, endTime: HH+1:00 })`. If the task's cadence rule already covers `viewDate` (the usual case), no popup. Edge case: covered=false (e.g., a WEEKLY task without the dropped day in `weekdays` somehow returned by the queue) → also `addException(viewDate, 'ADD')` and show the popup; "Yes" promotes via `applyPermanently`.
- **Drag bar within the grid (time change).** `update(id, { startTime, endTime })`. No popup.
- **Resize bar from bottom.** `update(id, { endTime })`. No popup.
- **Click "skip" on bar.**
  - DAILY: `addException(viewDate, 'SKIP')`. Bar fades to skipped state with inline Undo button (`removeException`). **No popup.**
  - WEEKLY: `addException(viewDate, 'SKIP')`. Popup *"Skip every {weekday}'s {title}?"* → Yes: `applyPermanently(id, viewDate, { weekdays: existing.filter(d => d !== thisWeekday) })`. No: keep the SKIP.
  - MONTHLY: same as WEEKLY but `monthDays`.
  - ONCE: confirm + `service.remove(id)`. No exception.

State:
- `tasksForDay = signal<PlannedTask[]>([])`.
- `viewDate = signal<string>(todayIso())`.
- `unscheduled = computed(() => tasksForDay().filter(t => t.needsTimeSlot && !t.startTime))`.
- `scheduled   = computed(() => tasksForDay().filter(t => t.startTime))`.

### `schedule-week.component.ts` — rewritten

Layout:
- Header: previous-week / this-week / next-week + date range.
- Unscheduled queue (top): the union of all 7 days' unscheduled tasks (deduplicated by id).
- 7 day columns × 24 hour grid.

Interactions:

- **Drag queue card → (day, hour).** `update(id, { startTime, endTime })`. If the dropped day is not covered by the cadence, also `addException(droppedDate, 'ADD')` and show popup. Yes: `applyPermanently(id, droppedDate, { weekdays: existing + droppedWeekday })`. No: keep exception.
- **Drag bar within the same day column (time change).** `update(id, { startTime, endTime })`. No popup.
- **Drag bar to a different day column (cross-day).**
  - Write `SKIP` exception on the original date (this week).
  - Write `ADD` exception on the new date.
  - Popup *"Move {title} from {OldWeekday} to {NewWeekday} every week?"* → Yes: in sequence, `removeException(oldDate)`, `removeException(newDate)`, `update(id, { weekdays: existing.filter(d => d !== oldWeekday).concat(newWeekday) })`. No: keep both exceptions.
- **Resize bar from bottom.** `update(id, { endTime })`. No popup.
- **Click "skip" on bar.** Same as day view.

State:
- `tasksByDay = signal<Map<string, PlannedTask[]>>(new Map())`.
- `weekStart = signal<string>(mondayOfThisWeekIso())`.
- `unscheduled = computed(() => uniqueById(flatten(tasksByDay()).filter(t => t.needsTimeSlot && !t.startTime)))`.

### `schedule-month.component.ts` — read-only

Rewritten to render a month grid. Each day cell calls `loadForDate(cellDate)` on mount (or all 28–31 in a single forkJoin on `monthStart` change). Cells show a colored dot per task that applies. Tapping a day cell opens an inline list of that day's tasks. No drag-drop, no editing.

### `calendar.component.ts` — read-only

Strip the existing drag-drop and editing affordances. Render planned tasks for the current day in a time grid (reuse `schedule-day`'s visual styling but without handlers). Two banners stay (conflict / unscheduled), each with a button that routes to the relevant editable view (`/schedule` or `/schedule/week`).

### New Task page — constraints UI

`apps/frontend/src/app/features/new-task/new-task.component.ts`:

**Removed:** the "Task Type" three-button section, the dynamic parameters card (count spinner / time spinner / frequency chips), the `taskType` / `targetCount` / `targetMinutes` / `selectedFrequency` signals and their methods.

**Added** state:
```ts
timeConstraintEnabled  = signal(false);
minTimeMinutes         = signal<number | null>(null);
maxTimeMinutes         = signal<number | null>(null);

countConstraintEnabled = signal(false);
minCount               = signal<number | null>(null);
maxCount               = signal<number | null>(null);

constraintError        = signal<string | null>(null);
```

**Added UI** — inserted above the "Needs a time slot" toggle, replacing the removed sections:

A "Constraints (optional)" section containing two collapsible cards (Time, Count). Each card's header has a toggle. When ON, the card's body shows two `<input type="number" min="1">` fields side by side ("Min minutes" / "Max minutes" for the Time card, "Min count" / "Max count" for the Count card). Empty input → null. A small helper line below the inputs: *"Either, both, or neither is fine."*

**Submit-time validation:**
```ts
if (timeConstraintEnabled() && minTimeMinutes() != null && maxTimeMinutes() != null
    && maxTimeMinutes()! < minTimeMinutes()!) {
  this.constraintError.set('Max minutes must be ≥ Min minutes'); return;
}
// same for count
```
A red error line under the constraints section if validation fails.

**Field mapping** in `toPlannedTaskInput`:
```ts
const minTimeMinutes = this.timeConstraintEnabled() ? (this.minTimeMinutes() ?? null) : null;
const maxTimeMinutes = this.timeConstraintEnabled() ? (this.maxTimeMinutes() ?? null) : null;
const minCount       = this.countConstraintEnabled() ? (this.minCount() ?? null) : null;
const maxCount       = this.countConstraintEnabled() ? (this.maxCount() ?? null) : null;
return { ...existing, minTimeMinutes, maxTimeMinutes, minCount, maxCount };
```

**Preview card** at the bottom now shows a constraint summary line: e.g. `⏱ 30–60 min · 🔢 5–10 ×`. Each segment is rendered only if its card is enabled and at least one of its two fields is non-null. If neither card is enabled, the line is omitted.

## 8. Frontend ↔ backend interaction (happy paths)

### Drag a WEEKLY bar from Wed → Thu (cross-day move)

1. User releases the drag on Thursday 09:00.
2. `schedule-week.component` calls `service.addException(id, thisWedDate, 'SKIP')`.
3. `service.addException(id, thisThuDate, 'ADD')`.
4. Local `_tasks` updates twice via `tap`; the rendered bars update.
5. `<exception-popup>` renders with *"Move Gym from Wednesday to Thursday every week?"*.
6. User clicks **Yes** → `service.applyPermanently(id, thisWedDate, { weekdays: existing.filter(d => d !== 'WEDNESDAY').concat('THURSDAY') })` which chains `removeException(thisWedDate)` → `removeException(thisThuDate)` (extra call vs. the simple "apply permanently" — see Note) → `update(id, { weekdays: ... })`.
7. Or user clicks **No** → no further calls; the two exceptions stay.

Note: `applyPermanently` as described in § 7 removes a single exception (the one offered for promotion). For cross-day move, the host calls `removeException` on the *second* exception separately and then calls `applyPermanently` (which removes the first and patches the template). The plan task spells out the exact call sequence.

### Drag from queue → day in week view (uncovered day)

1. Drop on Sunday 14:00 for a `[MON, WED, FRI]` WEEKLY task.
2. `update(id, { startTime: '14:00', endTime: '15:00' })`.
3. `addException(id, thisSunDate, 'ADD')`.
4. Popup *"Add Sunday to every week's Gym?"*.
5. Yes → `applyPermanently(id, thisSunDate, { weekdays: existing + 'SUNDAY' })`.
6. No → ADD exception stays for this Sunday only.

### Skip a DAILY bar

1. Click skip on a DAILY bar in day view for date `d`.
2. `addException(id, d, 'SKIP')`.
3. Bar fades, undo affordance appears.
4. Click undo → `removeException(id, d)`.

## 9. Testing strategy

### Backend (JUnit 5 + Spring Boot Test + H2 dev profile)

`PlannedTaskServiceTest` — extended:
- `create` accepts all four constraint fields; nulls accepted everywhere.
- `create` rejects `minTimeMinutes > maxTimeMinutes` with `IllegalArgumentException` containing `"time"`.
- `create` rejects `minCount > maxCount` similarly.
- `create` rejects any constraint value `<= 0`.
- `update` patches a single constraint without disturbing the others.

`PlannedTaskExceptionServiceTest` (new):
- `addException` succeeds for WEEKLY task on a covered date (SKIP) and an uncovered date (ADD).
- `addException` 400 for `cadence == ONCE`, `cadence == DAILY` with `ADD`, `ADD` on covered date, `SKIP` on uncovered date.
- `addException` 409 when `(taskId, date)` already exists.
- `removeException` succeeds and is idempotent at the controller layer (404 only for missing task).
- The "applies on date" rule respects exceptions across DAILY+SKIP, WEEKLY+ADD, WEEKLY+SKIP, MONTHLY+ADD, MONTHLY+SKIP.

`PlannedTaskControllerTest` — extended:
- `POST /planned-tasks` 201 with constraint fields and a `GET` round-trip returns the same values.
- `POST /planned-tasks/{id}/exceptions` 201 / 409 / 400 (each rejected combination).
- `DELETE /planned-tasks/{id}/exceptions/{date}` 204; subsequent `GET ?date=…` no longer treats that date as excepted.
- `GET /planned-tasks?date=…` returns the `exceptions` array on each task.

### Frontend (Karma / Jasmine — kept minimal)

`PlannedTaskService` happy paths against `HttpTestingController`:
- `addException(id, date, type)` POSTs to `/exceptions` with the right body and replaces the task in `_tasks`.
- `removeException` DELETEs and updates.
- `applyPermanently(id, date, { weekdays })` issues `DELETE /exceptions/{date}` then `PATCH /{id}` and returns the final task.

### Playwright e2e

Three new spec files under `apps/e2e/tests/`.

`schedule-day.spec.ts`:
- Seed a DAILY task via API (no time set) → open `/schedule` → drag from queue onto 10:00 slot → assert task bar renders at 10:00–11:00 → reload → still there.
- Drag the existing bar to 14:00 → assert template `startTime` is `14:00` (verify via API call).
- Click skip on the bar (DAILY) → bar shows skipped state, undo button appears → click undo → bar back.

`schedule-week.spec.ts`:
- Seed a WEEKLY task `[MON, WED, FRI]` via API → open `/schedule/week` → 3 bars on those days.
- Drag from queue onto Tuesday 09:00 → popup appears → click "No, just this Tuesday" → assert ADD exception for this Tuesday (verify via API for this week and next week).
- Drag the Wednesday bar onto Thursday → popup → click "Yes, every week" → assert `weekdays` is `[MON, THU, FRI]` (verify via API).
- Click skip on the Wednesday bar (WEEKLY popup) → click "No, just this Wednesday" → assert SKIP exception added.

`new-task-constraints.spec.ts`:
- Open `/new-task` → both Time and Count cards default OFF.
- Toggle Time ON → fill only Max minutes (60) → save → POST body has `minTimeMinutes: null, maxTimeMinutes: 60`.
- Toggle Count ON → fill Min count (5) and Max count (10) → save → body has both.
- Toggle Time ON → set Max < Min → save attempts → red error line, no submit.

### Drag-drop testing notes

Playwright `dragTo` works for HTML5 drag-drop with `draggable="true"`. If timing is flaky, fall back to dispatching `pointerdown` / `pointermove` / `pointerup` events directly. As a last resort, expose the service on `window` under a dev-only conditional and invoke it via `page.evaluate`. The plan task documents the chosen fallback.

### Not tested in Slice 3

- Per-occurrence time overrides — feature not implemented.
- Month / calendar drag-drop — feature not implemented.
- Concurrent edits across multiple tabs / clients.
- Performance with many planned tasks.
- Constraint enforcement / over-plan warnings.

## 10. Verification checklist (manual end-to-end at slice exit)

1. Backend `./mvnw test` — all green (Slice 1 + Slice 2 + Slice 3 tests).
2. Frontend `ng build` — production build clean.
3. Playwright `npm run e2e` — Slice 1, 2, and 3 suites green.
4. Manual on `:4200`, fresh user:
   - Create a WEEKLY task `[MON, WED, FRI]` via the New Task form.
   - Open `/schedule/week` — 3 bars on those days.
   - Drag from queue onto a new day → popup appears → "No" keeps it as a one-week exception.
   - Drag a bar to a different day → popup → "Yes" → reload → assert the template weekdays changed.
   - Open New Task — toggle Time card on, fill only Min minutes (15), leave Max empty → save → reload from API → only `minTimeMinutes` is set.
   - Toggle Count card on, set Max < Min → expect a red error and no submit.
5. Reset DB via psql or MCP → all schedule pages empty → no errors.

## 11. Future work (not Slice 3)

- Per-occurrence **time** overrides (allow exceptions to also override `startTime` / `endTime`).
- Drag-and-drop on month view and full editing on the calendar view.
- Constraint enforcement: yellow warning banners on schedule pages when over-planned or under-planned at the end of the cadence period.
- Notification settings (atStart / atEnd / customOffsetsMinutes) — both backend and the New Task UI.
- A "skipped tasks" sidebar so the user can rediscover and undo skips beyond the local undo affordance.
- Date-range bulk endpoint `?from=…&to=…` to replace the 7-call week-view loader.
- Habit migration to Spring Boot.
- Goals as a first-class entity.
- Timezone-aware "today" computed per-user instead of from server local date.
