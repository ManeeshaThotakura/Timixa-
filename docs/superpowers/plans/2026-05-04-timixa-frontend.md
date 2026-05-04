# Timixa Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade Angular 17+ standalone-component frontend for the Timixa productivity/habit tracker, matched to 11 Figma screens, inside an npm-workspaces monorepo with an Express backend scaffold.

**Architecture:** Angular 17+ standalone components with lazy `loadComponent()` routing, Angular Signals + Services for state (no NgRx), Tailwind CSS with Serene Intelligence design tokens loaded from `tailwind.config.js`, all data from `assets/mock/*.json` via `HttpClient`.

**Tech Stack:** Angular 17+, Tailwind CSS 3, Angular CDK (DragDrop), Angular Animations, Material Symbols icons, Manrope + Inter fonts, npm workspaces, Express + Node.js (backend scaffold only).

---

## Coverage Status

| Task | Description | Status |
|---|---|---|
| 1 | Monorepo root + workspace setup | ✅ Done |
| 2 | Angular scaffold (angular.json, tsconfig*, postcss, tailwind) | ✅ Done |
| 3 | Styles + index.html (fonts, Material Symbols, Tailwind base) | ✅ Done |
| 4 | main.ts + app.config.ts + app.component.ts | ✅ Done |
| 5 | Core models (6 files) | ✅ Done |
| 6 | Mock JSON data (9 files) | ✅ Done |
| 7 | Signal-based services (6 files) | ✅ Done (gap: InsightService.getWeeklyStats missing) |
| 8 | Guards (AuthGuard, AdminGuard) | ✅ Done |
| 9 | App routes (app.routes.ts) | ✅ Done |
| 10 | Shared components (ProgressBar, StatCard, Banner, FAB, HabitCard, ProjectCard) | ✅ Done |
| 11 | TaskCardComponent (standalone shared) | ❌ Gap — inlined in Kanban |
| 12 | App shell layout (TopHeader, BottomNav, AppShell) | ✅ Done |
| 13 | Auth screens (Login, Register) | ✅ Done |
| 14 | Today Dashboard | ✅ Done |
| 15 | Projects Dashboard | ✅ Done |
| 16 | Kanban Board | ✅ Done (gap: click-to-move instead of CDK DragDrop) |
| 17 | Meeting Scheduler | ✅ Done |
| 18 | Calendar (month grid + unscheduled banner) | ✅ Done |
| 19 | Schedule Day view | ✅ Done |
| 20 | Schedule Week view | ✅ Done |
| 21 | Schedule Month view | ✅ Done |
| 22 | Insights Dashboard | ✅ Done |
| 23 | Smart Reminders | ✅ Done |
| 24 | Route Animations (Angular Animations API) | ❌ Gap — CSS only |
| 25 | Express backend scaffold | ✅ Done |

---

## Phase 1: Monorepo + Infrastructure

### Task 1: Monorepo Root Setup
**Files:**
- Create: `package.json` (root)
- Create: `apps/frontend/package.json`
- Create: `apps/backend/package.json`

- [x] Create root `package.json` with npm workspaces pointing to `apps/*`
- [x] Create `apps/frontend/package.json` with Angular 17 + Tailwind + CDK deps
- [x] Create `apps/backend/package.json` with Express + nodemon

**Verify:**
```bash
cd apps/frontend && npm install
# Expected: node_modules installed, no peer dep errors
```

---

### Task 2: Angular Scaffold
**Files:**
- Create: `apps/frontend/angular.json`
- Create: `apps/frontend/tsconfig.json`
- Create: `apps/frontend/tsconfig.app.json`
- Create: `apps/frontend/tsconfig.spec.json`
- Create: `apps/frontend/tailwind.config.js`
- Create: `apps/frontend/postcss.config.js`

- [x] Create `angular.json` — app builder points to `src/main.ts`, assets glob includes `src/assets/**`
- [x] Create `tsconfig.json` — strict mode, `moduleResolution: bundler`, `target: ES2022`
- [x] Create `tailwind.config.js` — all Serene Intelligence color tokens, fontFamily (manrope/inter), spacing, borderRadius, boxShadow
- [x] Create `postcss.config.js` — tailwindcss + autoprefixer plugins

**Key token values in tailwind.config.js:**
```js
colors: {
  primary: '#451de3',
  'primary-container': '#5e43fb',
  secondary: '#006688',
  'secondary-container': '#00c1fd',
  background: '#f9f9fc',
  'surface-container-lowest': '#ffffff',
  'on-surface': '#1a1c1e',
  'on-surface-variant': '#474556',
  error: '#ba1a1a',
}
```

---

### Task 3: Entry Files
**Files:**
- Create: `apps/frontend/src/index.html`
- Create: `apps/frontend/src/styles.scss`
- Create: `apps/frontend/src/main.ts`
- Create: `apps/frontend/src/app/app.config.ts`
- Create: `apps/frontend/src/app/app.component.ts`

- [x] `index.html` — loads Google Fonts (Manrope, Inter), Material Symbols Outlined, sets `<app-root>`
- [x] `styles.scss` — `@tailwind base/components/utilities`, `.glass-card`, `.glass-nav`, `.btn-primary`, `.btn-ghost`, `.input-ghost`, route animation keyframes, `.no-scrollbar`
- [x] `main.ts` — `bootstrapApplication(AppComponent, appConfig)`
- [x] `app.config.ts` — `provideRouter(routes, withViewTransitions())`, `provideHttpClient()`, `provideAnimations()`
- [x] `app.component.ts` — single `<router-outlet />`

---

## Phase 2: Core Layer

### Task 4: TypeScript Models
**Files:**
- Create: `src/app/core/models/user.model.ts`
- Create: `src/app/core/models/habit.model.ts`
- Create: `src/app/core/models/project.model.ts`
- Create: `src/app/core/models/schedule.model.ts`
- Create: `src/app/core/models/insight.model.ts`
- Create: `src/app/core/models/reminder.model.ts`

- [x] `user.model.ts` — `User { id, name, email, avatarUrl, role: 'admin'|'member' }`
- [x] `habit.model.ts` — `Habit { id, title, category, icon, targetCount, currentCount, unit, goalId, streak, color }` + `TodayProgress`
- [x] `project.model.ts` — `Project`, `Task { status: 'todo'|'in-progress'|'done' }`, `ProjectStats`
- [x] `schedule.model.ts` — `ScheduledEvent`, `Meeting { projectId }`, `UnscheduledTask`
- [x] `insight.model.ts` — `InsightSummary`, `GoalPerformance`, `DeepAnalysis`, `TimeBlock`
- [x] `reminder.model.ts` — `Reminder { dismissed, icon, iconColor }`

---

### Task 5: Mock JSON Data
**Files:** `src/assets/mock/*.json` (9 files)

- [x] `user.json` — single User object, role: 'admin'
- [x] `habits.json` — 6 habits (Study, Water, Run, Meditate, Read, Deep Work)
- [x] `projects.json` — 4 projects (Website Redesign, Mobile App MVP, API Integration, Analytics Dashboard)
- [x] `tasks.json` — 10 tasks across projects, mixed statuses
- [x] `events.json` — 10 scheduled events across multiple dates
- [x] `unscheduled-tasks.json` — 3 tasks without schedule slots
- [x] `meetings.json` — 2 meetings for project p1
- [x] `insights.json` — full InsightSummary with goals, deepAnalysis, timeDistribution
- [x] `reminders.json` — 5 reminders (3 smart, 2 manual)

---

### Task 6: Signal-Based Services
**Files:** `src/app/core/services/*.service.ts` (6 files)

- [x] `AuthService` — signals: `currentUser`, `isLoggedIn`; methods: `login()`, `register()`, `logout()`, `hasToken()`; stores to localStorage
- [x] `HabitService` — signals: `habits`, `todayProgress` (computed); methods: `load()`, `incrementHabit()`, `startHabit()`, `progressPercent()`
- [x] `ProjectService` — signals: `projects`, `tasks`, `stats` (computed); methods: `load()`, `getProjectById()`, `getKanbanByProject()`, `updateTaskStatus()`, `addTask()`
- [x] `ScheduleService` — signals: `events`, `meetings`, `unscheduledTasks`; methods: `load()`, `getByDate()`, `getByWeek()`, `getByMonth()`, `scheduleTask()`, `dismissUnscheduledBanner()`, `addMeeting()`, `getMeetingsByProject()`
- [x] `InsightService` — signal: `summary`; methods: `load()`
- [x] `ReminderService` — signals: `reminders`, `activeCount` (computed); methods: `load()`, `dismiss()`, `snooze()`

**Gap (Task 6a):** Add `getWeeklyStats()` to `InsightService` — see Task 26.

---

### Task 7: Guards
**Files:**
- Create: `src/app/core/guards/auth.guard.ts`
- Create: `src/app/core/guards/admin.guard.ts`

- [x] `authGuard` — functional `CanActivateFn`; checks `AuthService.hasToken()`; redirects to `/auth/login`
- [x] `adminGuard` — functional `CanActivateFn`; checks `currentUser().role === 'admin'`; redirects to `/projects/:id/board` using `route.paramMap.get('id')`

---

### Task 8: App Routes
**File:** `src/app/app.routes.ts`

- [x] Public routes: `/auth/login`, `/auth/register`
- [x] Protected shell route: `path: ''`, `component: AppShellComponent`, `canActivate: [authGuard]`
- [x] All 10 child routes with `loadComponent()` lazy loading
- [x] `schedule/calendar` listed BEFORE `schedule` to prevent premature matching
- [x] AdminGuard on `/projects/:id/meeting`
- [x] Wildcard `**` → `/auth/login`

---

## Phase 3: Shared Components

### Task 9: Atomic Shared Components
**Files:** `src/app/shared/components/`

- [x] `ProgressBarComponent` — input: `value: number`, `gradient: string`; renders thick rounded bar with inline gradient style
- [x] `StatCardComponent` — inputs: `icon`, `value`, `label`, `iconBg`, `iconColor`, `trend?`, `trendLabel?`
- [x] `BannerComponent` — inputs: `count: number`; outputs: `dismissed`, `action`; renders purple banner strip
- [x] `FabComponent` — output: `clicked`; gradient purple→blue circle 56×56px
- [x] `HabitCardComponent` — input: `habit: Habit`; outputs: `start`, `increment`; streak badge, progress bar, done state
- [x] `ProjectCardComponent` — input: `project: Project`; output: `clicked`; priority badge, progress bar, tags, due date

### Task 10: TaskCardComponent (GAP — not yet done)
**File:** `src/app/shared/components/task-card/task-card.component.ts`

- [ ] Create standalone `TaskCardComponent` with `@Input() task: Task` and `@Input() done = false`
- [ ] Show drag indicator icon, title (strikethrough if done), priority pill, due date
- [ ] Used in `ProjectKanbanComponent` — replace inline `ng-template` with `<app-task-card>`

See **Task 26** for implementation.

---

### Task 11: App Shell Layout
**Files:** `src/app/shared/layout/`

- [x] `TopHeaderComponent` — sticky frosted glass header; avatar placeholder, title, notification bell with badge count from `ReminderService.activeCount()`; bell click → `/reminders`
- [x] `BottomNavComponent` — fixed frosted glass bottom bar; 4 tabs (Home/Projects/Calendar/Insights); active state via `router.url.startsWith(route)`, active dot indicator
- [x] `AppShellComponent` — wraps `<router-outlet>` between header and bottom nav; calls `load()` on all 5 services in `ngOnInit`

---

## Phase 4: Auth Screens

### Task 12: Login + Register
**Files:**
- Create: `src/app/features/auth/login/login.component.ts`
- Create: `src/app/features/auth/register/register.component.ts`

- [x] `LoginComponent` — centered layout; logo gradient circle + app name; email + password ghost inputs; Sign In button calls `AuthService.login()` with 600ms mock delay; link to register
- [x] `RegisterComponent` — same layout; name + email + password; Get Started button calls `AuthService.register()`; link to login

---

## Phase 5: Feature Screens

### Task 13: Today Dashboard
**File:** `src/app/features/dashboard/today-dashboard/today-dashboard.component.ts`

- [x] Greeting section — time-based (morning/afternoon/evening) + user name from `AuthService.currentUser()`
- [x] Overall progress card — percentage, habits done/total, 3-stat grid (completed/remaining/best streak)
- [x] Habit cards grid using `HabitCardComponent`
- [x] FAB → inline modal overlay with quick-add input
- [x] `FormsModule` imported for `[(ngModel)]` in modal

---

### Task 14: Projects Dashboard
**File:** `src/app/features/projects/projects-dashboard/projects-dashboard.component.ts`

- [x] 3 stat cards (Active/Velocity/Due Soon) using `StatCardComponent`
- [x] List/Grid view toggle — local `viewMode` signal, switches grid class
- [x] Project cards using `ProjectCardComponent`, click → navigate to `/projects/:id/board`
- [x] FAB → inline New Project modal

---

### Task 15: Kanban Board
**File:** `src/app/features/projects/project-kanban/project-kanban.component.ts`

- [x] Back button → `/projects`
- [x] Project title + description from `ProjectService.getProjectById(id)`
- [x] Progress bar for project overall progress
- [x] 3 columns (Todo / In Progress / Done) from `ProjectService.getKanbanByProject(id)`
- [x] "Schedule Meeting" button — conditional on `currentUser().role === 'admin'`
- [x] Add task per column — inline modal
- [x] **GAP:** Tasks move on click (not CDK drag-and-drop) — see Task 27

---

### Task 16: Meeting Scheduler
**File:** `src/app/features/projects/meeting-scheduler/meeting-scheduler.component.ts`

- [x] Admin-only (protected by AdminGuard in routes)
- [x] Form: title, date, start time, end time, location, participant multi-select (5 mock users as toggle chips)
- [x] On submit: calls `ScheduleService.addMeeting()`, shows success state, navigates back after 1.5s
- [x] Existing meetings list from `ScheduleService.getMeetingsByProject(projectId)`

---

### Task 17: Calendar
**File:** `src/app/features/schedule/calendar/calendar.component.ts`

- [x] Unscheduled tasks banner using `BannerComponent` — count from `ScheduleService.unscheduledTasks()`
- [x] Banner dismiss → `dismissUnscheduledBanner()`, hides banner
- [x] Banner "Schedule Now" → navigate to `/schedule`
- [x] Month grid — prev/next navigation, day cells with event dots
- [x] Click day → show events for that day below grid
- [x] View switcher (Day/Week/Month) → routes

---

### Task 18: Schedule Day View
**File:** `src/app/features/schedule/schedule-day/schedule-day.component.ts`

- [x] Day navigation (prev/next) with date label
- [x] View switcher tabs
- [x] Time grid — hours 7AM to 8PM, events positioned by start hour from `ScheduleService.getByDate()`

---

### Task 19: Schedule Week View
**File:** `src/app/features/schedule/schedule-week/schedule-week.component.ts`

- [x] Week navigation (prev/next week), week range label
- [x] 7 day buttons with day name + number, event dot indicators
- [x] Click day → show events for that day

---

### Task 20: Schedule Month View
**File:** `src/app/features/schedule/schedule-month/schedule-month.component.ts`

- [x] Month navigation, month/year label
- [x] Calendar grid with event dots
- [x] Click day → show events summary below grid

---

### Task 21: Insights Dashboard
**File:** `src/app/features/insights/insights-dashboard/insights-dashboard.component.ts`

- [x] Summary stats: overall score, total habits, streak
- [x] Focus hours bar (logged vs 20hr target)
- [x] Goal performance cards — progress bar + trend icon (up/down/flat)
- [x] Deep analysis cards — verified/warning/info icon + insight text
- [x] Time distribution — one progress bar per category
- [x] Collaboration sync — individual vs team percentage cards

---

### Task 22: Smart Reminders
**File:** `src/app/features/reminders/smart-reminders/smart-reminders.component.ts`

- [x] Back button → `/dashboard`
- [x] Smart reminders section (type: 'smart') — dismiss + snooze buttons
- [x] Manual/scheduled reminders section (type: 'manual') — dismiss button
- [x] Empty state when all dismissed
- [x] Active count shown in header

---

## Phase 6: Gaps — To Be Fixed

### Task 23: Extract TaskCardComponent ← NOT YET DONE
**File:** `src/app/shared/components/task-card/task-card.component.ts`

- [ ] Create `TaskCardComponent` with `@Input() task: Task`, `@Input() done = false`
- [ ] Template: drag indicator icon, title (strikethrough when done), priority pill, due date chip
- [ ] Modify `project-kanban.component.ts` — import `TaskCardComponent`, replace `ng-template` with `<app-task-card [task]="task" [done]="..." />`

---

### Task 24: Angular CDK DragDrop on Kanban ← NOT YET DONE
**File:** `src/app/features/projects/project-kanban/project-kanban.component.ts`

- [ ] Add `@angular/cdk` to `apps/frontend/package.json` (already present)
- [ ] Import `DragDropModule` from `@angular/cdk/drag-drop`
- [ ] Add `cdkDropListGroup` on the columns container div
- [ ] Add `cdkDropList [cdkDropListData]="kanban.todo"` on each column, `[cdkDropListConnectedTo]` referencing the other two
- [ ] Add `cdkDrag` on each task card div
- [ ] Handle `(cdkDropListDropped)` → call `moveItemInArray` or `transferArrayItem` then `ProjectService.updateTaskStatus()`

---

### Task 25: Route Animations via Angular Animations API ← NOT YET DONE
**Files:**
- Modify: `src/app/app.config.ts`
- Create: `src/app/shared/animations/route.animations.ts`
- Modify: `src/app/shared/layout/app-shell/app-shell.component.ts`

- [ ] Create `src/app/shared/animations/route.animations.ts`:
```typescript
import { trigger, transition, style, animate, query, group } from '@angular/animations';

export const slideAnimation = trigger('routeAnimations', [
  transition('* => *', [
    query(':enter', [style({ transform: 'translateX(100%)', opacity: 0 })], { optional: true }),
    group([
      query(':leave', [animate('200ms ease-in', style({ transform: 'translateX(-100%)', opacity: 0 }))], { optional: true }),
      query(':enter', [animate('250ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))], { optional: true }),
    ]),
  ]),
]);
```

- [ ] In `AppShellComponent` — add `@HostBinding('@routeAnimations')` or wrap `<router-outlet>` with animated container; import `slideAnimation`; add `animations: [slideAnimation]` to component decorator
- [ ] Verify no FOUC on first load

---

### Task 26: InsightService.getWeeklyStats() ← NOT YET DONE
**File:** `src/app/core/services/insight.service.ts`

- [ ] Add `getWeeklyStats()` method:
```typescript
getWeeklyStats(): { label: string; value: number }[] {
  const s = this._summary();
  if (!s) return [];
  return s.goals.map(g => ({ label: g.goalName, value: g.completionRate }));
}
```

---

## Phase 7: Backend Scaffold

### Task 27: Express Backend
**Files:**
- Create: `apps/backend/package.json`
- Create: `apps/backend/src/index.js`

- [x] `package.json` — express + cors deps, nodemon devDep, `dev` + `start` scripts
- [x] `src/index.js` — express app, CORS, JSON middleware, `/health` endpoint, listen on PORT 3000

**Run:**
```bash
cd apps/backend && npm install && npm run dev
# Expected: "Timixa backend running on http://localhost:3000"
curl http://localhost:3000/health
# Expected: {"status":"ok","message":"Timixa API is running"}
```

---

## How to Install & Run

```bash
# From monorepo root
cd apps/frontend
npm install

# Start Angular dev server
npm start
# → http://localhost:4200
# Login with any email + password (mock auth always succeeds)

# Backend (optional)
cd apps/backend
npm install
npm run dev
# → http://localhost:3000
```

## Gaps Summary

| # | Gap | Priority |
|---|---|---|
| Task 23 | Extract `TaskCardComponent` as standalone shared component | Medium |
| Task 24 | CDK DragDrop on Kanban board | Medium |
| Task 25 | Angular route animations wired up | Low |
| Task 26 | `InsightService.getWeeklyStats()` method | Low |
