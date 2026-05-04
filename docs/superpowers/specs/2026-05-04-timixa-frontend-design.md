# Timixa Frontend Design Spec
**Date:** 2026-05-04  
**Project:** Timixa — Productivity & Habit Tracker  
**Design System:** Serene Intelligence  
**Status:** Approved

---

## 1. Overview

Timixa is a productivity and habit-tracking app. The frontend is an Angular 17+ standalone-component SPA matched to 11 Figma screens exported in `stitch_unified_habit_project_flow.zip`. It lives in a monorepo alongside an Express + Node.js backend.

**Core features from Figma screens:**
- Daily habit tracking with progress (Today Dashboard)
- Project management with Kanban board
- Calendar (month grid) with unscheduled-tasks banner
- Day / Week / Month schedule views
- Meeting scheduler (admin-only, per project)
- Analytics & Insights dashboard
- Smart Reminders (via notification bell)

---

## 2. Monorepo Structure

```
timixa/
├── package.json              ← npm workspaces: ["apps/*"]
├── apps/
│   ├── frontend/             ← Angular 17+ standalone app
│   └── backend/              ← Express + Node.js (scaffolded, not built yet)
```

**Frontend internal layout:**
```
apps/frontend/src/app/
├── core/
│   ├── models/               ← TypeScript interfaces
│   ├── services/             ← Signal-based mock services
│   └── guards/               ← AuthGuard, AdminGuard
├── features/
│   ├── auth/                 ← login, register
│   ├── dashboard/            ← today dashboard
│   ├── projects/             ← projects list, kanban, create-task modal, meeting scheduler
│   ├── schedule/             ← day, week, month, calendar views
│   ├── insights/             ← analytics dashboard
│   └── reminders/            ← smart reminders
├── shared/
│   ├── components/           ← reusable UI components
│   └── layout/               ← AppShellComponent
└── app.routes.ts
```

**Assets:**
```
apps/frontend/src/assets/mock/
├── habits.json
├── projects.json
├── tasks.json
├── events.json
├── meetings.json
├── insights.json
├── reminders.json
└── user.json
```

---

## 3. Tech Stack

| Concern | Choice |
|---|---|
| Framework | Angular 17+ (standalone components, no NgModules) |
| Styling | Tailwind CSS with Serene Intelligence design tokens |
| State | Angular Signals + Services |
| Icons | Material Symbols (Google Fonts) |
| Fonts | Manrope (headings), Inter (body) |
| Routing | `loadComponent()` lazy routes |
| Mock data | JSON files in `assets/mock/`, loaded via `HttpClient` |
| Auth | Mock token stored in `localStorage` |
| Monorepo | npm workspaces |
| Backend | Express + Node.js (scaffolded only) |

---

## 4. Design Tokens (Serene Intelligence)

```
Primary:           #451de3 / #5e43fb
Secondary:         #006688 / #00c1fd
Background:        #f9f9fc
Surface:           #ffffff
On-surface:        #1a1c1e
On-surface-variant:#474556
Error:             #ba1a1a
Border radius:     sm=4px, md=12px, lg=16px, xl=24px, full=9999px
Spacing unit:      4px base grid
Page margin:       24px horizontal
```

**Elevation:** Soft ambient shadow `0px 8px 24px rgba(94,67,251,0.04)` on cards.  
**Glassmorphism:** `backdrop-blur-xl` + `bg-white/80` on sticky headers and bottom nav.

---

## 5. Data Models

```typescript
// user.model.ts
interface User { id: string; name: string; email: string; avatarUrl: string; role: 'admin' | 'member' }

// habit.model.ts
interface Habit { id: string; title: string; category: string; icon: string; targetCount: number; currentCount: number; unit: string; goalId: string; streak: number }

// project.model.ts
interface Project { id: string; title: string; description: string; priority: 'high'|'medium'|'low'; status: 'active'|'completed'|'paused'; progress: number; dueDate: string; tags: string[] }
interface Task    { id: string; projectId: string; title: string; status: 'todo'|'in-progress'|'done'; dueDate: string; assignees: string[] }

// schedule.model.ts
interface ScheduledEvent { id: string; title: string; type: 'task'|'habit'|'meeting'; date: string; startTime: string; endTime: string; color: string }
interface Meeting        { id: string; projectId: string; title: string; participants: string[]; date: string; startTime: string; endTime: string; location: string }

// insight.model.ts
interface GoalPerformance { goalName: string; category: string; completionRate: number; trend: 'up'|'down'|'flat' }
interface InsightSummary  { overallScore: number; streak: number; focusHours: number; goals: GoalPerformance[] }

// reminder.model.ts
interface Reminder { id: string; title: string; time: string; type: 'smart'|'manual'; relatedHabitId?: string; relatedTaskId?: string }
```

---

## 6. Services (Signal-based)

| Service | Signals | Key methods |
|---|---|---|
| `AuthService` | `currentUser`, `isLoggedIn` | `login()`, `register()`, `logout()` |
| `HabitService` | `habits`, `todayProgress` | `incrementHabit()`, `startHabit()` |
| `ProjectService` | `projects`, `tasks` | `getKanbanByProject()`, `updateTaskStatus()` |
| `ScheduleService` | `events`, `unscheduledTasks` | `getByDate()`, `getByWeek()`, `scheduleTask()` |
| `InsightService` | `summary`, `goalPerformance` | `getWeeklyStats()` |
| `ReminderService` | `reminders` | `dismiss()`, `snooze()` |

All services load initial data from the `assets/mock/*.json` files via `HttpClient`. Mutations update the signal in-memory only (no persistence needed for mock phase).

---

## 7. Routing

```typescript
// app.routes.ts
{ path: 'auth/login',    loadComponent: () => LoginComponent }
{ path: 'auth/register', loadComponent: () => RegisterComponent }

// AppShell wraps all authenticated routes
{
  path: '',
  component: AppShellComponent,
  canActivate: [AuthGuard],
  children: [
    { path: 'dashboard',              loadComponent: () => TodayDashboardComponent }
    { path: 'projects',               loadComponent: () => ProjectsDashboardComponent }
    { path: 'projects/:id/board',     loadComponent: () => ProjectKanbanComponent }
    { path: 'projects/:id/meeting',   loadComponent: () => MeetingSchedulerComponent, canActivate: [AdminGuard] }
    { path: 'schedule/calendar',      loadComponent: () => CalendarComponent }
    { path: 'schedule',               loadComponent: () => ScheduleDayComponent }
    { path: 'schedule/week',          loadComponent: () => ScheduleWeekComponent }
    { path: 'schedule/month',         loadComponent: () => ScheduleMonthComponent }
    { path: 'insights',               loadComponent: () => InsightsDashboardComponent }
    { path: 'reminders',              loadComponent: () => SmartRemindersComponent }
    { path: '',                       redirectTo: 'dashboard', pathMatch: 'full' }
  ]
}
{ path: '**', redirectTo: 'auth/login' }
```

---

## 8. Bottom Navigation (4 tabs)

| Tab | Icon | Route |
|---|---|---|
| Home | `home` | `/dashboard` |
| Projects | `rocket_launch` | `/projects` |
| Calendar | `calendar_today` | `/schedule/calendar` |
| Insights | `insights` | `/insights` |

Smart Reminders is accessible via the **notification bell** in `TopHeaderComponent` → navigates to `/reminders`.

---

## 9. Key Screen Behaviors

### Today Dashboard (`/dashboard`)
- Greeting with user name from `AuthService.currentUser()`
- Overall daily progress card (% complete, habits done count) from `HabitService.todayProgress()`
- Scrollable habit cards — each shows icon, title, progress bar, start/increment button
- FAB opens `CreateTaskModalComponent` as an overlay

### Projects Dashboard (`/projects`)
- Stat cards: active projects count, velocity %, due-soon count from `ProjectService`
- List/grid toggle (display-only state, no persistence needed)
- Project cards with priority badge, progress bar, due date
- FAB opens `CreateTaskModalComponent`

### Kanban Board (`/projects/:id/board`)
- Three columns: Todo, In Progress, Done — tasks from `ProjectService.getKanbanByProject(id)`
- Drag-and-drop task cards (Angular CDK DragDrop)
- **"Schedule Meeting" button** visible only when `currentUser().role === 'admin'` → navigates to `/projects/:id/meeting`
- AdminGuard protects the `/projects/:id/meeting` route (redirects non-admins back to board)

### Calendar (`/schedule/calendar`)
- Month grid view
- **Unscheduled tasks banner** appears at top when `ScheduleService.unscheduledTasks().length > 0`
- Banner shows count + "Schedule Now" CTA → navigates to `/schedule` (day view)
- Banner is dismissible per session (signal flag, not persisted)

### Schedule Day/Week/Month (`/schedule`, `/schedule/week`, `/schedule/month`)
- View switcher tabs at top (Day / Week / Month)
- Events rendered from `ScheduleService` for the selected date range

### Meeting Scheduler (`/projects/:id/meeting`)
- Admin-only screen (guarded)
- Form: title, date, time range, participants (multi-select from mock user list), location
- On submit: adds to `ScheduleService` events in-memory

### Insights (`/insights`)
- Summary stats: overall score, streak, focus hours
- Goal performance list with trend indicators
- Deep analysis section (Morning Routine, Late Night Deep Work etc.)
- Discipline analysis with hours logged vs target
- Time distribution visualization

### Smart Reminders (`/reminders`)
- List of smart + manual reminders from `ReminderService`
- Dismiss and snooze actions update signal in-memory

---

## 10. Shared Components

| Component | Inputs | Notes |
|---|---|---|
| `BottomNavComponent` | — | Fixed bottom, frosted glass, 4 tabs |
| `TopHeaderComponent` | `title: string` | Sticky, frosted glass, avatar + bell |
| `HabitCardComponent` | `habit: Habit` | Progress bar, start/increment button |
| `ProjectCardComponent` | `project: Project` | Priority badge, progress bar |
| `TaskCardComponent` | `task: Task` | Kanban card, drag handle |
| `ProgressBarComponent` | `value: number, color?: string` | Thick rounded gradient bar |
| `FabButtonComponent` | `(clicked)` | Gradient purple→blue circle |
| `BannerComponent` | `count: number, (dismissed), (action)` | Dismissible alert strip |
| `StatCardComponent` | `icon, value, label, trend?` | Metric summary tile |
| `AppShellComponent` | — | Layout wrapper: header + outlet + bottom nav |

---

## 11. Auth

- `AuthService` stores `{ token: 'mock-token', user: User }` in `localStorage` on login
- `AuthGuard`: checks `localStorage` for token — redirects to `/auth/login` if missing
- `AdminGuard`: checks `currentUser().role === 'admin'` — redirects to `/projects/:id/board` if not admin
- Login accepts any email/password → always resolves with mock admin user
- Register accepts any form data → stores and auto-logs in

---

## 12. Route Animations

- Forward navigation (going deeper): slide in from right
- Back navigation (going up): slide out to right
- Bottom nav tab switch: crossfade
- Modal overlay (CreateTask): scale-up from center + backdrop fade

---

## Out of Scope (this phase)

- Real API integration (backend is scaffolded only)
- Persistent storage beyond `localStorage` for auth token
- Push notifications
- Dark mode (design tokens support it but not wired up)
- User settings / profile editing
