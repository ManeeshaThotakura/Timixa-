# Plan: Requirements Audit Fixes + Spring Boot Backend Rebuild

## Context

You outlined a full feature spec covering auth → onboarding → dashboard → new task → schedule → calendar → bedtime summary → analytics. After auditing the existing Angular code at `apps/frontend/src/app`, the UI is roughly 50% complete against that spec:

- **100% mocked** — every service loads static JSON from `assets/mock/*.json`; no real HTTP calls
- **Backend** is a 17-line Express stub at `apps/backend/src/index.js` with only `/health`
- **Missing entirely**: Onboarding page, Bedtime Summary page, bedtime-trigger popup, frequency-rule warnings, slot-required vs notify-only toggle, Adherence metric, 7d/30d bar chart, current-moment task pinning on dashboard
- **Partial**: New Task page treats time/count/frequency as mutually exclusive (you want composable); Insights missing Discipline + Adherence split; calendar.component.ts is editable when spec wants it read-only

This plan covers (a) closing those gaps in the frontend and (b) replacing the Express stub with a Spring Boot 3 backend that serves the frontend over real HTTP.

---

## Decisions locked (from your answers)

| Decision | Choice |
|---|---|
| Data model | **Habit** (count-only) and **PlannedTask** (new, composable) coexist as separate entities |
| Backend | Spring Boot 3 + Java 21 + Maven + Postgres (H2 in dev) + JWT |
| New Task UI | Three optional constraint sections with enable-toggles |
| Projects/Kanban | UI stays; not backed by Spring Boot in this round (continues to load mock JSON) |

## Defaults I'm assuming (flag if any are wrong)

1. **Bedtime detection**: store `bedtime` (HH:mm) + `wakeTime` (HH:mm) on User; dashboard checks `now ∈ [bedtime − 30 min, bedtime + 8h]` to fire the summary popup
2. **Frequency-rule violation**: warn if user *over-plans* (e.g., 4 sessions when frequency is 3×/week) or *under-plans* on the last day of the period. Same-week, same-month, same-day windows depending on cadence
3. **Calendar vs Schedule mapping**: existing `schedule-day/week/month` stay editable; existing `calendar.component.ts` is rewritten to be read-only with Edit button + two popups
4. **Bedtime Summary "tasks"**: includes uncompleted Habits AND uncompleted PlannedTasks scheduled for today
5. **Dashboard "current task on top"**: shows the PlannedTask whose `startTime ≤ now ≤ endTime`; if multiple, the one with earliest start; if none, fall back to next upcoming
6. **Onboarding**: blocks via `onboardingGuard`; if `user.onboardingComplete === false`, redirect to `/onboarding`

---

## Implementation phases

### Phase 1 — Core data models (frontend)

**New file** `apps/frontend/src/app/core/models/planned-task.model.ts`:
```ts
export type Cadence = 'daily' | 'weekly' | 'monthly';

export interface TimeConstraint { minMinutes?: number; maxMinutes?: number; }
export interface CountConstraint { minCount?: number; maxCount?: number; }
export interface FrequencyConstraint { cadence: Cadence; occurrences: number; }
export interface NotificationConfig {
  atStart: boolean; atEnd: boolean;
  customOffsetsMinutes: number[]; // e.g., [-15, -5]
}

export interface PlannedTask {
  id: string;
  userId: string;
  title: string;
  goalId?: string;
  cadence: Cadence;
  needsTimeSlot: boolean;          // true → goes into Unscheduled queue; false → all-day notify
  timeConstraint?: TimeConstraint;
  countConstraint?: CountConstraint;
  frequencyConstraint?: FrequencyConstraint;
  notification: NotificationConfig;
  color: string;
  createdAt: string;
}
```

**Extend** `apps/frontend/src/app/core/models/user.model.ts`:
```ts
export interface User {
  id: string; name: string; email: string; avatarUrl: string;
  role: 'admin' | 'member';
  age?: number;
  occupation?: string;
  bedtime?: string;        // "22:30"
  wakeTime?: string;       // "06:30"
  onboardingComplete: boolean;
}
```

Add `assets/mock/planned-tasks.json` while backend is in progress.

### Phase 2 — Onboarding flow

- **New component** `apps/frontend/src/app/features/auth/onboarding/onboarding.component.ts` (route `/onboarding`)
  - Form fields: `age` (number), `occupation` (text), `bedtime` (time), `wakeTime` (time)
  - Submit → `authService.completeOnboarding(profile)` → navigate to `/dashboard`
- **Update** `register.component.ts`: after successful registration, navigate to `/onboarding` (not `/dashboard`)
- **New guard** `onboardingGuard` in `core/guards/`: redirects to `/onboarding` if `!user.onboardingComplete`
- **Wire** the guard on all child routes of app-shell

### Phase 3 — Rebuild New Task page (`apps/frontend/src/app/features/new-task/new-task.component.ts`)

- Three collapsible cards: **Time**, **Count**, **Frequency**, each with an enable toggle
- Top section: title, goal picker, cadence (daily/weekly/monthly)
- **"Needs time slot" toggle**: if off, task is all-day notification only (doesn't appear in unscheduled queue)
- Notification card: at-start / at-end checkboxes + chip list of custom offsets (-15, -5, etc.)
- `createTask()` → POST to `/api/planned-tasks` (mock until backend lands) → navigate to `/schedule/{cadenceView}?highlightTask={id}` where `cadenceView ∈ {day, week, month}`

### Phase 4 — Dashboard enhancements (`features/dashboard/today-dashboard`)

- Inject `PlannedTaskService` alongside `HabitService`
- Compute `todayList = sortByStartTime(habits + plannedTasksForToday)`
- **Pinned "Now" card**: derive `currentItem` = item where `startTime ≤ now ≤ endTime`, render first with Start/+ button
- **Unscheduled popup**: if any planned task with `needsTimeSlot && no slot today`, show banner → "Schedule now"
- **Bedtime popup**: on `ngOnInit`, compare current time to `user.bedtime`; if within window, show "Summarize your day" modal → `/bedtime-summary`
- FAB → `/new-task` (already exists)

### Phase 5 — Schedule view enhancements (`features/schedule/schedule-day, schedule-week, schedule-month`)

- Read `highlightTask` query param; visually highlight that task (e.g., ring outline) for 3s after mount
- Default to the cadence-matching view when arriving from new-task (handled by routing in Phase 3)
- **Frequency-rule validator** (`core/services/frequency-validator.service.ts`):
  - On every drop/resize, check the relevant period (day/week/month) for the dragged task's constraint
  - If over-planned or under-planned at period end, render a yellow warning banner above the time grid
- Unscheduled queue at top filtered to `needsTimeSlot === true`

### Phase 6 — Calendar (read-only) view (`features/schedule/calendar`)

- Strip drag/drop handlers and editable affordances from `calendar.component.ts`
- Reuse the same visual time grid as schedule-day for UI parity
- Two popups (top banners):
  1. **Conflict detected** → button "Resolve now" → `/schedule/{currentCadence}`
  2. **Unscheduled tasks** → button "Schedule now" → `/schedule/{currentCadence}`
- Footer **Edit** button → `/schedule/{currentCadence}`

### Phase 7 — Bedtime Summary page (NEW)

- **New route** `/bedtime-summary` + component at `apps/frontend/src/app/features/bedtime/bedtime-summary.component.ts`
- Sections:
  1. **Pending today** — list of uncompleted habits + planned tasks
     - Time-based → slider (min → max from constraint), "Save"
     - Count-based → slider (0 → maxCount), "Save"
     - Boolean → checkbox
  2. **Top streak** + **Top missed streak** (computed from history)
  3. **Prepare for tomorrow** — count of conflicts + unscheduled; CTA → `/schedule/day?date=tomorrow`

### Phase 8 — Analytics revamp (`features/insights/insights-dashboard`)

- Replace "Velocity" with two distinct metrics: **Discipline %** (planned tasks completed today/week) and **Adherence %** (executed at scheduled time)
- Replace the hard-coded `weekBars` array with a real chart, toggled 7d/30d
- Donut for time distribution (already exists — keep)
- Streak counter (already exists — keep)
- Goal Performance section (already exists — keep)

### Phase 9 — Spring Boot backend

**Location**: new directory `apps/backend-java/` (Maven project). Existing `apps/backend/` Express stub gets deleted at the end of this phase.

**Stack**:
- Spring Boot 3.3.x
- Java 21
- Maven (pom.xml at `apps/backend-java/`)
- Spring Web, Spring Security, Spring Data JPA, Spring Validation
- Postgres driver (production), H2 (`spring.profiles.active=dev`)
- `io.jsonwebtoken:jjwt` for JWT
- BCrypt for password hashing

**Entities & repositories** (`com.timixa.backend.entity` / `.repository`):

| Entity | Key fields |
|---|---|
| `User` | id, email (unique), passwordHash, name, role, age, occupation, bedtime, wakeTime, onboardingComplete |
| `Habit` | id, userId, title, category, icon, targetCount, currentCount, unit, goalId, streak, color |
| `PlannedTask` | id, userId, title, cadence, needsTimeSlot, timeMinMinutes, timeMaxMinutes, countMin, countMax, frequencyCadence, frequencyOccurrences, notificationAtStart, notificationAtEnd, customOffsets (json), color |
| `ScheduledEvent` | id, userId, sourceType (habit/plannedTask/meeting), sourceId, title, date, startTime, endTime, color |
| `Goal` | id, userId, name, color |
| `Reminder` | id, userId, title, time, type, relatedTaskId, dismissed |

**Controllers / endpoints** (`/api/...`):

- `POST /api/auth/register` → `{ token, user }`
- `POST /api/auth/login` → `{ token, user }`
- `GET  /api/auth/me`
- `PATCH /api/users/me/onboarding` — saves onboarding profile
- `GET/POST /api/habits`, `PATCH /api/habits/{id}`, `POST /api/habits/{id}/increment`
- `GET/POST /api/planned-tasks`, `PATCH /api/planned-tasks/{id}`, `DELETE /api/planned-tasks/{id}`
- `GET/POST /api/schedule/events`, `PATCH /api/schedule/events/{id}` (move/resize), `DELETE /api/schedule/events/{id}`
- `GET /api/schedule/unscheduled` — derives from `PlannedTask` where `needsTimeSlot && no event today`
- `GET/POST /api/goals`
- `GET /api/insights` — server-computed Discipline, Adherence, streaks, time distribution

**Security**:
- `SecurityFilterChain` permits `/api/auth/**` + `/api/health`; all else requires JWT
- `JwtAuthenticationFilter` parses `Authorization: Bearer …`

**Persistence**:
- `application-dev.yml`: H2 in-memory, `ddl-auto: create-drop`, sample data loader
- `application-prod.yml`: Postgres, `ddl-auto: validate`, Flyway migrations under `db/migration/V1__init.sql`

**Delete** `apps/backend/` (Express stub) once Spring Boot is verified end-to-end.

### Phase 10 — Frontend ↔ backend wiring

- New `core/config/environment.ts` exposes `API_BASE = '/api'`
- `core/interceptors/auth.interceptor.ts` adds `Authorization: Bearer ${token}` to every request, except `/auth/login` and `/auth/register`
- Rewrite each service to hit real endpoints instead of `assets/mock/*.json`:
  - `AuthService`, `HabitService`, `PlannedTaskService` (new), `ScheduleService`, `ReminderService`, `InsightService`
  - **`ProjectService` is NOT rewritten** — stays on mock JSON per your scope decision
- Once verified, delete the mock files except `projects.json`, `tasks.json` (still used by ProjectService)

---

## Critical files

### Frontend — new
- `core/models/planned-task.model.ts`
- `core/services/planned-task.service.ts`
- `core/services/frequency-validator.service.ts`
- `core/guards/onboarding.guard.ts`
- `core/interceptors/auth.interceptor.ts`
- `core/config/environment.ts`
- `features/auth/onboarding/onboarding.component.ts`
- `features/bedtime/bedtime-summary.component.ts`

### Frontend — modify
- `core/models/user.model.ts` — add profile + bedtime fields
- `app.routes.ts` — add `/onboarding`, `/bedtime-summary`; wire onboarding guard
- `features/auth/register/register.component.ts` — redirect to `/onboarding`
- `features/new-task/new-task.component.ts` — full rebuild (toggle sections, needs-slot, notification offsets)
- `features/dashboard/today-dashboard/today-dashboard.component.ts` — current-task pin, unscheduled banner, bedtime trigger
- `features/schedule/schedule-day|week|month/*.ts` — highlight from query param, frequency validator, slot filter
- `features/schedule/calendar/calendar.component.ts` — make read-only, add two popups + Edit button
- `features/insights/insights-dashboard/insights-dashboard.component.ts` — Discipline + Adherence + 7d/30d toggle
- All services in `core/services/` (except ProjectService) — swap mock JSON for `/api/*`

### Backend — new (`apps/backend-java/`)
- `pom.xml`
- `src/main/java/com/timixa/backend/TimixaApplication.java`
- `entity/` — User, Habit, PlannedTask, ScheduledEvent, Goal, Reminder
- `repository/` — Spring Data interfaces
- `controller/` — Auth, User, Habit, PlannedTask, Schedule, Goal, Insights, Reminder
- `service/` — business logic; especially `InsightsService` (Discipline + Adherence computation) and `FrequencyValidator`
- `security/` — `JwtAuthenticationFilter`, `SecurityConfig`, `JwtUtil`
- `dto/` — request/response shapes
- `src/main/resources/application.yml`, `application-dev.yml`, `application-prod.yml`
- `src/main/resources/db/migration/V1__init.sql`

### Backend — delete
- `apps/backend/` (entire Express directory, once Spring Boot is verified)

---

## Verification

1. **Boot order**:
   ```
   cd apps/backend-java && ./mvnw spring-boot:run    # :8080
   cd apps/frontend     && npx ng serve              # :4200
   ```
2. **Register flow**: create account → lands on `/onboarding` → enter age/occupation/bedtime/wake → `/dashboard`
3. **New Task**: tap +, enable Time (30 min) + Frequency (3×/week), save → redirected to `/schedule/week` with the new task highlighted in the unscheduled rail
4. **Drag & frequency warning**: drag a 3×/week task to a 4th slot in the same week → yellow warning banner
5. **Calendar (read-only)**: navigate from bottom nav → no drag handles; conflict + unscheduled banners present; Edit button → schedule view
6. **Bedtime trigger**: set system time to (user.bedtime − 20 min) → open dashboard → "Summarize your day" popup → opens `/bedtime-summary`
7. **Bedtime Summary**: complete a time-based task via slider → reflected in tomorrow's "Top streak"
8. **Analytics**: insights page shows Discipline + Adherence; toggle 7d ↔ 30d on the bar chart
9. **Projects**: still loads — confirms we didn't break the mock JSON path
10. **Logout/login**: JWT persists across reload, expires correctly

---

## Out of scope (explicit)

- Real-time collaboration / multi-user sync
- Push notifications (web/native) — notifications stay UI-only popups
- Project + Kanban backend (you said skip for now)
- Mobile native shell — stays as web SPA
- File uploads (avatars stay as URLs)