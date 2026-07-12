# Calendar Week View — Design Spec
Date: 2026-07-12

## Goal
Add a read-only **Week** tab to the existing Calendar page (`/schedule/calendar`) so users can see their full week at a glance without entering the editable schedule. The day view remains unchanged.

## Scope
- Single file change: `apps/frontend/src/app/features/schedule/calendar/calendar.component.ts`
- No new routes, no new files, no backend changes.

## URL & Navigation
- A `?view=day` / `?view=week` query param persists the active tab.
- On load, the component reads this param (defaults to `day`).
- Switching tabs writes the param to the URL via Angular Router (`replaceUrl: true`).
- `?date=YYYY-MM-DD` continues to work as today; in week mode it snaps to the Monday of that date's week.

## Day | Week Toggle
- Pill-style tab switcher at the top of the page, matching the `Day / Week / Month` tabs on `/schedule`.
- Sits above the date header in both modes.
- Two buttons: **Day** and **Week**.

## Day Mode
Unchanged from the current implementation.

## Week Mode

### Header
`‹  Jul 7 – 13  ›`  
Prev/Next shift by exactly 7 days (Monday-anchored week). Today's date column is highlighted with a subtle purple tint (`rgba(94,67,251,0.06)`).

### Data Loading
Uses existing `PlannedTaskService.loadForWeek(weekStartIso)` which fires 7 parallel `loadForDate` calls and returns a `Map<string, PlannedTask[]>`. Called on init and on week navigation.

### Any-time Strip
A horizontal chip row above the time grid, one section per day column. Each chip shows a colored dot + task title (truncated). Only tasks with `!needsTimeSlot` and no segment/pattern/startTime appear here. Chips are read-only (no tap action).

### Time Grid
- Left gutter: hour labels `00:00 … 23:00` (48 px wide), 1 row per hour at `h-12` (48 px).
- 7 day columns side-by-side, horizontally scrollable on mobile.
- Each column shows bars for that day's scheduled tasks.
- Bar rendering (mirrors day view, no interactive handles):
  - Soft colored background (`rgba(228,223,255,0.45)`)
  - 2 px colored left border (`task.color`)
  - Title line: `text-[11px] font-bold truncate text-on-surface`
  - Time line: `text-[9px] opacity-70 truncate` in the task color
  - `border-radius: 8px`, `overflow: hidden`
  - `title` attribute: `"<title> · HH:mm–HH:mm"` for desktop hover tooltip
- Bar position: `top = (startHour*60 + startMin) * 0.8 px`, `height = max(20, durationMinutes * 0.8) px`
- Bars are absolutely positioned within each column (column is `position: relative`).
- No drag handles, no resize handles, no tap-to-edit modal.

### Conflict Banner
Not shown in the read-only week view. Conflicts are surfaced in the editable `/schedule/week`.

### Unscheduled Banner
Not shown. Unscheduled tasks are surfaced in the editable schedule.

### "Edit schedule" Button
Fixed floating button at the bottom (same style as day mode):
- Day mode → `/schedule?date=<viewDate>`
- Week mode → `/schedule/week?date=<weekStart>`

## State & Signals
| Signal | Type | Purpose |
|--------|------|---------|
| `view` | `signal<'day'\|'week'>` | Active tab |
| `viewDate` | `signal<string>` | ISO date (day mode anchor / week mode Monday) |
| `tasksForDay` | `signal<PlannedTask[]>` | Day mode data (existing) |
| `tasksByWeek` | `signal<Map<string, PlannedTask[]>>` | Week mode data (new) |
| `weekDays` | `computed` | Array of 7 `{ dateStr, label, isToday }` objects derived from `viewDate` |

## Computed Values (week mode)
| Computed | Purpose |
|----------|---------|
| `weekBars(dateStr)` | Returns `CalBar[]` for one day column (same bar-building logic as day mode) |
| `weekAnytime(dateStr)` | Returns tasks with no time slot for one day column |
| `weekLabel` | `"Jul 7 – 13"` formatted string |

## Implementation Notes
- `weekBars` reuses the existing `CalBar` interface and bar-building logic (extract to a private method shared by both modes to avoid duplication).
- `loadForWeek` is already implemented in `PlannedTaskService` — no service changes needed.
- The horizontal scroll container on mobile uses `overflow-x: auto` with `scrollbar-width: none`.
- Column min-width: `80px` so bars remain readable; total grid scrolls if viewport is narrow.

## What is NOT in scope
- Tap-to-edit on week bars (use "Edit schedule" button instead)
- Conflict/overlap indicators in week read-only view
- Month view tab (already exists at `/schedule/month` on the schedule page, not on calendar)
- Any backend changes
