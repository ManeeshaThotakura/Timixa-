# Calendar Week View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only Day | Week tab switcher to `/schedule/calendar` so users can see their full week at a glance without entering the editable schedule.

**Architecture:** All changes live in a single file (`calendar.component.ts`). A `view` signal switches between day and week rendering. Week data loads via the existing `PlannedTaskService.loadForWeek()`. Bar-building logic is extracted into a shared private method used by both modes.

**Tech Stack:** Angular 17 standalone components, signals, computed, CommonModule, Angular Router

## Global Constraints

- Read-only: no drag, no resize, no edit modal in either mode
- No new files, no new routes, no backend changes
- Bar pixel math: `top = (h*60+m) * 0.8 px`, `height = max(20, durationMinutes * 0.8) px`
- Column min-width: `80px`; grid scrolls horizontally on mobile
- `?view=day|week` and `?date=YYYY-MM-DD` query params persist across navigation
- "Edit schedule" button: day mode → `/schedule?date=<viewDate>`, week mode → `/schedule/week?date=<weekStart>`

---

### Task 1: Add view toggle + URL persistence

**Files:**
- Modify: `apps/frontend/src/app/features/schedule/calendar/calendar.component.ts`

**Interfaces:**
- Produces: `view = signal<'day'|'week'>('day')` readable by template and later tasks

- [ ] **Step 1: Add `view` signal and Router import**

Replace the existing imports block and class opening so it reads:

```typescript
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PlannedTaskService } from '../../../core/services/planned-task.service';
import { PlannedTask } from '../../../core/models/planned-task.model';
```

Inside the class, add after `viewDate = signal<string>(todayIso());`:

```typescript
view = signal<'day' | 'week'>('day');
```

- [ ] **Step 2: Read `?view` param in `ngOnInit`**

Replace the existing `ngOnInit` body:

```typescript
ngOnInit(): void {
  const dateParam = this.route.snapshot.queryParamMap.get('date');
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    this.viewDate.set(dateParam);
  }
  const viewParam = this.route.snapshot.queryParamMap.get('view');
  if (viewParam === 'week') this.view.set('week');
  this.reload();
}
```

- [ ] **Step 3: Add `setView` method that writes query param**

Add this method to the class:

```typescript
setView(v: 'day' | 'week'): void {
  this.view.set(v);
  this.router.navigate([], {
    relativeTo: this.route,
    queryParams: { view: v, date: this.viewDate() },
    queryParamsHandling: 'merge',
    replaceUrl: true,
  });
  this.reload();
}
```

- [ ] **Step 4: Add tab toggle to template**

Add this block immediately inside `<div class="px-margin-page ...">`, before the existing `<header>`:

```html
<!-- Day | Week toggle -->
<div class="flex bg-surface-container rounded-full p-1 mb-stack-md">
  <button (click)="setView('day')"
          class="flex-1 py-1.5 rounded-full text-[13px] font-semibold transition-all"
          [class.bg-surface-container-lowest]="view() === 'day'"
          [class.shadow-sm]="view() === 'day'"
          [class.text-on-surface]="view() === 'day'"
          [class.text-on-surface-variant]="view() !== 'day'"
          data-testid="cal-tab-day">Day</button>
  <button (click)="setView('week')"
          class="flex-1 py-1.5 rounded-full text-[13px] font-semibold transition-all"
          [class.bg-surface-container-lowest]="view() === 'week'"
          [class.shadow-sm]="view() === 'week'"
          [class.text-on-surface]="view() === 'week'"
          [class.text-on-surface-variant]="view() !== 'week'"
          data-testid="cal-tab-week">Week</button>
</div>
```

- [ ] **Step 5: Gate existing day content behind `*ngIf="view() === 'day'"`**

Wrap the existing `<header>`, conflict/unscheduled/anytime banners, and time grid `<section>` in:

```html
<ng-container *ngIf="view() === 'day'">
  <!-- existing day content here -->
</ng-container>
```

- [ ] **Step 6: Build and verify toggle renders without errors**

```bash
cd apps/frontend && npx ng build 2>&1 | tail -5
```

Expected: `Application bundle generation complete.`

---

### Task 2: Week data loading + computed helpers

**Files:**
- Modify: `apps/frontend/src/app/features/schedule/calendar/calendar.component.ts`

**Interfaces:**
- Consumes: `PlannedTaskService.loadForWeek(weekStart: string): Observable<Map<string, PlannedTask[]>>`
- Produces:
  - `tasksByWeek = signal<Map<string, PlannedTask[]>>(new Map())`
  - `weekStart = computed<string>()` — ISO Monday of `viewDate()`
  - `weekDays = computed<{dateStr:string; label:string; isToday:boolean}[]>()`
  - `weekLabel = computed<string>()`
  - `private buildBars(tasks: PlannedTask[]): CalBar[]` — shared bar builder

- [ ] **Step 1: Add `tasksByWeek` signal**

```typescript
tasksByWeek = signal<Map<string, PlannedTask[]>>(new Map());
```

- [ ] **Step 2: Add `weekStart` computed (Monday of `viewDate`)**

```typescript
readonly weekStart = computed<string>(() => {
  const d = new Date(this.viewDate() + 'T00:00:00');
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
});
```

- [ ] **Step 3: Add `weekDays` computed (7 day descriptors)**

```typescript
readonly weekDays = computed<{dateStr:string; label:string; shortDay:string; isToday:boolean}[]>(() => {
  const todayStr = todayIso();
  const start = new Date(this.weekStart() + 'T00:00:00');
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const shortDay = d.toLocaleDateString(undefined, { weekday: 'short' });
    const label = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
    return { dateStr, label, shortDay, isToday: dateStr === todayStr };
  });
});
```

- [ ] **Step 4: Add `weekLabel` computed**

```typescript
readonly weekLabel = computed<string>(() => {
  const days = this.weekDays();
  const first = new Date(days[0].dateStr + 'T00:00:00');
  const last  = new Date(days[6].dateStr + 'T00:00:00');
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(first)} – ${fmt(last)}`;
});
```

- [ ] **Step 5: Extract shared `buildBars` method**

Add this private method (replaces the inline logic currently inside `bars` computed):

```typescript
private buildBars(tasks: PlannedTask[]): CalBar[] {
  const out: CalBar[] = [];
  for (const t of tasks) {
    const segs = t.segmentsForDate ?? [];
    const pattern = t.patternForDate ?? [];
    if (segs.length > 0) {
      for (const s of segs) {
        out.push({ key: s.id, taskId: t.id, title: t.title, color: t.color,
                   startTime: s.startTime, endTime: s.endTime });
      }
    } else if (pattern.length > 0) {
      for (const p of pattern) {
        out.push({ key: `${t.id}-${p.startTime}`, taskId: t.id, title: t.title, color: t.color,
                   startTime: p.startTime, endTime: p.endTime });
      }
    } else if (t.startTime && t.endTime) {
      out.push({ key: t.id, taskId: t.id, title: t.title, color: t.color,
                 startTime: t.startTime, endTime: t.endTime });
    }
  }
  return out.sort((a, b) => (a.startTime < b.startTime ? -1 : 1));
}
```

- [ ] **Step 6: Update existing `bars` computed to use `buildBars`**

```typescript
readonly bars = computed<CalBar[]>(() => this.buildBars(this.tasksForDay()));
```

- [ ] **Step 7: Add `weekBarsFor` and `weekAnytimeFor` helpers**

```typescript
weekBarsFor(dateStr: string): CalBar[] {
  return this.buildBars(this.tasksByWeek().get(dateStr) ?? []);
}

weekAnytimeFor(dateStr: string): PlannedTask[] {
  return (this.tasksByWeek().get(dateStr) ?? []).filter(
    t => !t.needsTimeSlot
      && (t.segmentsForDate?.length ?? 0) === 0
      && (t.patternForDate?.length ?? 0) === 0
      && !t.startTime,
  );
}
```

- [ ] **Step 8: Update `reload()` to load week data when in week mode**

```typescript
private reload(): void {
  if (this.view() === 'week') {
    this.plannedTasks.loadForWeek(this.weekStart()).subscribe({
      next: map => this.tasksByWeek.set(map),
    });
  } else {
    this.plannedTasks.loadForDate(this.viewDate()).subscribe({
      next: list => this.tasksForDay.set(list),
    });
  }
}
```

- [ ] **Step 9: Build and verify**

```bash
cd apps/frontend && npx ng build 2>&1 | tail -5
```

Expected: `Application bundle generation complete.`

---

### Task 3: Week mode navigation (prev/next + Edit button)

**Files:**
- Modify: `apps/frontend/src/app/features/schedule/calendar/calendar.component.ts`

**Interfaces:**
- Consumes: `weekStart` computed, `view` signal
- Produces: updated `prev()`, `next()`, `goSchedule()` methods; updated `label()` computed

- [ ] **Step 1: Update `prev()` and `next()` to shift 7 days in week mode**

```typescript
prev(): void {
  this.view() === 'week' ? this.shiftWeek(-1) : this.shift(-1);
}

next(): void {
  this.view() === 'week' ? this.shiftWeek(+1) : this.shift(+1);
}

private shiftWeek(deltaWeeks: number): void {
  const d = new Date(this.weekStart() + 'T00:00:00');
  d.setDate(d.getDate() + deltaWeeks * 7);
  this.viewDate.set(
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
  );
  this.reload();
}
```

- [ ] **Step 2: Update `label()` computed to show week range in week mode**

```typescript
readonly label = computed(() =>
  this.view() === 'week'
    ? this.weekLabel()
    : new Date(this.viewDate() + 'T00:00:00')
        .toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
);
```

- [ ] **Step 3: Update `goSchedule()` to be mode-aware**

```typescript
goSchedule(): void {
  if (this.view() === 'week') {
    this.router.navigate(['/schedule/week'], { queryParams: { date: this.weekStart() } });
  } else {
    this.router.navigate(['/schedule'], { queryParams: { date: this.viewDate() } });
  }
}
```

- [ ] **Step 4: Build and verify**

```bash
cd apps/frontend && npx ng build 2>&1 | tail -5
```

Expected: `Application bundle generation complete.`

---

### Task 4: Week mode template (grid + anytime strip)

**Files:**
- Modify: `apps/frontend/src/app/features/schedule/calendar/calendar.component.ts`

**Interfaces:**
- Consumes: `weekDays`, `weekBarsFor()`, `weekAnytimeFor()`, `topPx()`, `heightPx()`, `hours`, `pad()`

- [ ] **Step 1: Add week view block to template, after the `</ng-container>` that closes the day content**

Add this block:

```html
<!-- ── Week read-only view ─────────────────────────────── -->
<ng-container *ngIf="view() === 'week'">

  <!-- Any-time chips row (one column per day) -->
  <div class="flex gap-1 mb-3 overflow-x-auto pb-1" style="scrollbar-width:none;">
    <div class="w-10 flex-shrink-0"></div><!-- gutter spacer -->
    <div *ngFor="let day of weekDays()"
         class="flex-shrink-0 flex flex-col gap-1"
         [style.min-width.px]="80">
      <div *ngFor="let t of weekAnytimeFor(day.dateStr)"
           class="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold truncate"
           [style.borderColor]="t.color + '55'"
           [style.background]="t.color + '18'">
        <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" [style.background]="t.color"></span>
        <span class="truncate text-on-surface">{{ t.title }}</span>
      </div>
    </div>
  </div>

  <!-- 7-column time grid -->
  <section class="relative bg-surface-container-lowest rounded-[20px] overflow-hidden shadow-card">
    <!-- Day header row -->
    <div class="flex border-b border-outline-variant/10">
      <div class="w-10 flex-shrink-0"></div><!-- hour gutter -->
      <div *ngFor="let day of weekDays()"
           class="flex-1 min-w-[80px] text-center py-2 border-l border-outline-variant/10"
           [style.background]="day.isToday ? 'rgba(94,67,251,0.06)' : ''"
           [attr.data-testid]="'cal-week-col-' + day.dateStr">
        <p class="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
          {{ day.shortDay }}
        </p>
        <p class="text-[13px] font-bold"
           [class.text-primary]="day.isToday"
           [class.text-on-surface]="!day.isToday">
          {{ day.dateStr.slice(8) }}
        </p>
      </div>
    </div>

    <!-- Scrollable grid body -->
    <div class="overflow-x-auto" style="scrollbar-width:none;">
      <div class="flex" style="min-width: calc(40px + 7 * 80px);">

        <!-- Hour labels gutter -->
        <div class="w-10 flex-shrink-0">
          <div *ngFor="let h of hours" class="relative h-12 border-t border-outline-variant/10">
            <span class="absolute left-1 top-0.5 text-[9px] text-outline leading-none">{{ pad(h) }}</span>
          </div>
        </div>

        <!-- Day columns -->
        <div *ngFor="let day of weekDays()"
             class="flex-1 min-w-[80px] relative"
             [style.background]="day.isToday ? 'rgba(94,67,251,0.03)' : ''">
          <!-- Hour rows (grid lines) -->
          <div *ngFor="let h of hours" class="h-12 border-t border-l border-outline-variant/10"></div>

          <!-- Bars -->
          <div *ngFor="let b of weekBarsFor(day.dateStr)"
               class="absolute left-0.5 right-0.5 rounded-[8px] px-1.5 py-0.5 overflow-hidden border-l-2 flex flex-col justify-center gap-0.5"
               style="background:rgba(228,223,255,0.45);"
               [style.borderLeftColor]="b.color"
               [style.top.px]="topPx(b)"
               [style.height.px]="heightPx(b)"
               [attr.title]="b.title + ' · ' + b.startTime + '–' + b.endTime"
               [attr.data-testid]="'cal-week-bar-' + b.taskId">
            <span class="text-[10px] font-bold truncate leading-tight text-on-surface">{{ b.title }}</span>
            <span class="text-[8px] leading-tight truncate opacity-70" [style.color]="b.color">
              {{ b.startTime }}–{{ b.endTime }}
            </span>
          </div>
        </div>

      </div>
    </div>
  </section>

</ng-container>
```

- [ ] **Step 2: Build and verify**

```bash
cd apps/frontend && npx ng build 2>&1 | tail -5
```

Expected: `Application bundle generation complete.`

- [ ] **Step 3: Smoke-test in browser**

Open `http://localhost:4200/schedule/calendar`. Verify:
- `Day | Week` toggle appears at the top
- Clicking **Week** shows the 7-column grid with day headers (Mon–Sun)
- Today's column has a faint purple tint
- Tasks with time slots appear as bars in the correct column at the correct vertical position
- Any-time tasks appear as chips above the grid
- `‹` / `›` navigate by 1 week at a time
- "Edit schedule" button navigates to `/schedule/week`
- Clicking **Day** returns to the single-day view with all original behaviour intact
- URL shows `?view=week` when in week mode and `?view=day` when in day mode

- [ ] **Step 4: Verify URL persistence**

Navigate to `/schedule/calendar?view=week` directly — should open in week mode.
Navigate to `/schedule/calendar?view=week&date=2026-07-14` — should open week view anchored to the week containing Jul 14.

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Day\|Week pill toggle | Task 1 step 4 |
| `?view` param persistence | Task 1 steps 2–3 |
| `loadForWeek` for week data | Task 2 step 8 |
| `weekStart` computed (Monday anchor) | Task 2 step 2 |
| `weekDays` 7-descriptor array | Task 2 step 3 |
| Shared `buildBars` method | Task 2 steps 5–6 |
| `weekBarsFor` / `weekAnytimeFor` | Task 2 step 7 |
| Prev/next shift 7 days in week mode | Task 3 step 1 |
| Header shows week range | Task 3 step 2 |
| Edit button → `/schedule/week` in week mode | Task 3 step 3 |
| Any-time chip strip above grid | Task 4 step 1 |
| 7-column time grid with hour labels | Task 4 step 1 |
| Today column tint | Task 4 step 1 |
| Bars: colored left border, title, time | Task 4 step 1 |
| No drag/resize handles | Task 4 step 1 (no handlers added) |
| Native tooltip on hover | Task 4 step 1 (`[attr.title]`) |
| Column min-width 80px | Task 4 step 1 |
| Horizontal scroll on mobile | Task 4 step 1 |
| No conflict banner in week mode | Not added (correct — spec says omit) |

**Placeholder scan:** No TBDs, no "similar to Task N", all code blocks complete.

**Type consistency:** `CalBar` interface used identically throughout. `weekBarsFor` returns `CalBar[]`, consumed directly in `*ngFor`. `weekAnytimeFor` returns `PlannedTask[]`, accessed via `t.color` / `t.title` / `t.needsTimeSlot` — all valid fields on `PlannedTask`.
