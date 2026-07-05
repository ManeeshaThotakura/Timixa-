import { Component, OnInit, OnDestroy, inject, signal, computed, NgZone, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, of, switchMap } from 'rxjs';
import { PlannedTaskService } from '../../../core/services/planned-task.service';
import {
  FrequencyValidatorService,
  FrequencyWarning,
} from '../../../core/services/frequency-validator.service';
import { PlannedTask, Weekday } from '../../../core/models/planned-task.model';
import { ExceptionPopupComponent } from '../exception-popup.component';
import {
  ScheduleSlotPopupComponent,
  SlotPopupConfirm,
} from '../schedule-slot-popup.component';

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 00:00 – 23:00
const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// A bar in the week grid is either the task's template times (segmentId=null)
// or one of its per-date segment overrides.
interface WeekBar extends PlannedTask {
  _segmentId: string | null;
  _dateStr: string;
}

// Map JS day-of-week (0=Sun) to Weekday enum value
const JS_DAY_TO_WEEKDAY: Weekday[] = [
  'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY',
];

@Component({
  selector: 'app-schedule-week',
  standalone: true,
  imports: [CommonModule, FormsModule, ExceptionPopupComponent, ScheduleSlotPopupComponent],
  template: `
    <!-- Segmented Control -->
    <div class="px-margin-page mt-stack-md">
      <div class="bg-surface-container p-1 rounded-xl flex items-center">
        <button *ngFor="let v of views"
                (click)="router.navigate([v.route])"
                class="flex-1 py-2 text-label-sm font-semibold transition-all rounded-lg"
                [class]="v.label === 'Week'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'font-medium text-on-surface-variant hover:text-on-surface'">
          {{ v.label }}
        </button>
      </div>
    </div>

    <!-- Frequency-rule warnings -->
    <div *ngIf="frequencyWarnings().length > 0" class="px-margin-page mt-stack-md" data-testid="frequency-warnings">
      <div *ngFor="let w of frequencyWarnings()"
           class="rounded-2xl p-3 flex items-center gap-2.5 border mb-2"
           style="background:rgba(255,179,0,0.10); border-color:rgba(255,179,0,0.35);"
           [attr.data-testid]="'freq-warn-' + w.taskId">
        <span class="material-symbols-outlined text-[20px] flex-shrink-0" style="color:#b76d00;">schedule</span>
        <div class="min-w-0 flex-1">
          <p class="text-[13px] font-bold" style="color:#7a4900;">
            {{ w.title }} — {{ w.actual }} planned {{ w.period }}, target {{ w.expected }}
          </p>
          <p class="text-[11px] text-on-surface-variant leading-tight">
            You added {{ w.actual - w.expected }} extra session{{ w.actual - w.expected === 1 ? '' : 's' }} via exceptions
          </p>
        </div>
      </div>
    </div>

    <!-- Conflict warning -->
    <div *ngIf="weekConflictCount > 0" class="px-margin-page mt-stack-md">
      <div class="rounded-2xl p-3 flex items-center gap-2.5 border"
           style="background:rgba(186,26,26,0.08); border-color:rgba(186,26,26,0.25);">
        <span class="material-symbols-outlined text-[20px] flex-shrink-0" style="color:#ba1a1a;">warning</span>
        <div class="min-w-0 flex-1">
          <p class="text-[13px] font-bold" style="color:#ba1a1a;">
            {{ weekConflictCount }} time {{ weekConflictCount === 1 ? 'conflict' : 'conflicts' }} this week
          </p>
          <p class="text-[11px] text-on-surface-variant leading-tight">
            Overlapping tasks share their slot side-by-side
          </p>
        </div>
      </div>
    </div>

    <!-- Unplanned Tasks (collapsible, pinned to top while grid scrolls) -->
    <section class="px-margin-page mt-stack-md sticky top-0 z-30 pt-2 pb-2"
             style="backdrop-filter:saturate(140%) blur(8px); -webkit-backdrop-filter:saturate(140%) blur(8px); background-color: rgba(248, 250, 252, 0.92);">
      <!-- Collapsed header -->
      <div class="bg-surface-container-lowest rounded-xl p-4 flex items-center justify-between cursor-pointer border border-slate-50"
           style="box-shadow:0 8px 24px rgba(94,67,251,0.04);"
           (click)="unplannedOpen = !unplannedOpen">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center"
               style="background:rgba(194,232,255,0.4);">
            <span class="material-symbols-outlined text-secondary">pending_actions</span>
          </div>
          <div>
            <p class="font-semibold text-sm text-on-surface">Unscheduled</p>
            <p class="text-[10px] text-outline font-medium">{{ unscheduledTasks().length }} tasks waiting for slot</p>
          </div>
        </div>
        <span class="material-symbols-outlined text-outline transition-transform duration-200"
              [style.transform]="unplannedOpen ? 'rotate(180deg)' : 'rotate(0)'">
          keyboard_arrow_down
        </span>
      </div>

      <!-- Expanded cards -->
      <div *ngIf="unplannedOpen && unscheduledTasks().length > 0" class="mt-3">
        <p class="text-[11px] text-on-surface-variant mb-2 flex items-center gap-1">
          <span class="material-symbols-outlined text-[14px]">south</span>
          Hold &amp; drag a card onto any day and time slot
        </p>
        <div class="flex gap-3 overflow-x-auto pb-3" style="-ms-overflow-style:none;scrollbar-width:none;">
          <div *ngFor="let task of unscheduledTasks()"
               [attr.data-task-id]="task.id"
               draggable="true"
               (dragstart)="onDragStart($event, task)"
               (dragend)="onDragEnd()"
               (touchstart)="onTouchStart($event, task)"
               class="flex-shrink-0 w-40 bg-surface-container-lowest p-3 rounded-2xl border-l-4 border-error
                      cursor-grab active:cursor-grabbing select-none touch-none"
               style="box-shadow:0 8px 24px rgba(94,67,251,0.08);"
               [style.opacity]="draggingTask()?.id === task.id ? '0.35' : '1'">
            <div class="flex justify-between items-start mb-2">
              <span class="material-symbols-outlined text-error text-lg">{{ getTaskIcon(task) }}</span>
              <div class="w-2 h-2 rounded-full bg-error animate-pulse"></div>
            </div>
            <p class="font-semibold text-[13px] text-on-surface mb-1 truncate">{{ task.title }}</p>
            <p *ngIf="remainingMinutes(task) > 0"
               class="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
              {{ remainingMinutes(task) }} min remaining
            </p>
            <p class="text-[10px] text-on-surface-variant">{{ task.cadence }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Weekly tasks: pending days at a glance -->
    <section *ngIf="weeklyPendingRows().length > 0"
             class="px-margin-page mt-stack-md"
             data-testid="weekly-pending">
      <div class="bg-surface-container-lowest rounded-2xl border border-slate-50"
           style="box-shadow:0 8px 24px rgba(94,67,251,0.04);">
        <div class="px-4 pt-3 pb-2">
          <p class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Weekly tasks</p>
        </div>
        <div class="px-4 pb-3 flex flex-col gap-2">
          <div *ngFor="let row of weeklyPendingRows()"
               class="flex items-center gap-3"
               [attr.data-testid]="'weekly-row-' + row.taskId">
            <span class="w-2 h-2 rounded-full flex-shrink-0" [style.background]="row.color"></span>
            <p class="text-[12px] font-semibold text-on-surface flex-1 min-w-0 truncate">{{ row.title }}</p>
            <div class="flex items-center gap-1 flex-shrink-0">
              <div *ngFor="let d of row.days"
                   class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                   [attr.data-status]="d.status"
                   [style.background]="d.status === 'green'
                     ? 'rgba(46,125,50,0.18)'
                     : d.status === 'red'
                       ? 'rgba(186,26,26,0.18)'
                       : d.status === 'yellow'
                         ? 'rgba(255,179,0,0.22)'
                         : 'transparent'"
                   [style.color]="d.status === 'green'
                     ? '#2e7d32'
                     : d.status === 'red'
                       ? '#ba1a1a'
                       : d.status === 'yellow'
                         ? '#b76d00'
                         : 'rgba(120,117,136,0.45)'"
                   [style.outline]="d.isToday ? '1.5px solid #451de3' : 'none'"
                   [style.outlineOffset]="d.isToday ? '1px' : '0'">
                {{ d.label }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Week navigation + zoom -->
    <div class="px-margin-page mt-stack-md flex items-center gap-2">
      <button (click)="prevWeek()"
              class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform flex-shrink-0">
        <span class="material-symbols-outlined text-[18px]">chevron_left</span>
      </button>
      <span class="text-sm font-semibold text-on-surface flex-1 text-center truncate">{{ weekLabel }}</span>
      <button (click)="nextWeek()"
              class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform flex-shrink-0">
        <span class="material-symbols-outlined text-[18px]">chevron_right</span>
      </button>
      <div class="flex items-center gap-0.5 ml-1 pl-2 border-l border-slate-200 flex-shrink-0">
        <button (click)="zoomOut()" [disabled]="!canZoomOut"
                class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30">
          <span class="material-symbols-outlined text-[16px]">zoom_out</span>
        </button>
        <span class="text-[10px] font-bold text-on-surface-variant min-w-[30px] text-center">{{ zoomPct }}%</span>
        <button (click)="zoomIn()" [disabled]="!canZoomIn"
                class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30">
          <span class="material-symbols-outlined text-[16px]">zoom_in</span>
        </button>
      </div>
    </div>

    <!-- 7-day × 24h time grid (own scroll context so sticky header/column actually pin) -->
    <div #gridScroll class="mt-stack-md overflow-auto border-t border-b border-slate-100"
         (click)="onGridClick($event)"
         style="-ms-overflow-style:none;scrollbar-width:none; max-height:calc(100vh - 280px); min-height:380px; overscroll-behavior: contain;">
      <div [style.minWidth.px]="48 + weekDays.length * COL_W">

        <!-- Day header row -->
        <div class="flex sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-100">
          <div class="flex-shrink-0 border-r border-slate-100 sticky left-0 z-30 bg-white"
               [style.width.px]="48"></div>
          <div *ngFor="let day of weekDays; trackBy: trackByDateStr"
               class="flex-shrink-0 text-center py-2 border-r border-slate-100"
               [style.width.px]="COL_W"
               [style.background]="isToday(day.date) ? 'rgba(94,67,251,0.08)' : ''">
            <p class="text-[10px] font-bold uppercase tracking-widest"
               [style.color]="isToday(day.date) ? '#451de3' : '#787588'">
              {{ day.abbr }}
            </p>
            <p class="text-base font-bold mt-0.5"
               [style.color]="isToday(day.date) ? '#451de3' : '#1a1c1e'">
              {{ day.day }}
            </p>
          </div>
        </div>

        <!-- Hour rows -->
        <div *ngFor="let hour of hours; trackBy: trackByHour" class="flex" [style.height.px]="ROW_H">

          <!-- Hour label (sticky left) -->
          <div class="flex-shrink-0 border-r border-slate-100 text-[10px] text-slate-400 pt-1 px-1 font-medium bg-white"
               style="position: sticky; left: 0; z-index: 10;"
               [style.width.px]="48">
            {{ formatHour(hour) }}
          </div>

          <!-- Day cells -->
          <div *ngFor="let day of weekDays; trackBy: trackByDateStr"
               class="flex-shrink-0 border-t border-r border-slate-100 relative"
               [style.width.px]="COL_W"
               [style.height.px]="ROW_H"
               [attr.data-hour]="hour"
               [attr.data-date]="day.dateStr"
               (dragover)="onDragOver($event, hour, day.dateStr)"
               (dragleave)="onDragLeave($event)"
               (drop)="onDrop($event, hour, day.dateStr)"
               [style.background]="isToday(day.date) ? 'rgba(94,67,251,0.02)' : ''">

            <!-- Drop highlight -->
            <div *ngIf="dragOverHour() === hour && dragOverDate() === day.dateStr"
                 class="absolute inset-0.5 rounded-lg flex items-center justify-center pointer-events-none"
                 style="border:2px dashed #451de3; background:rgba(94,67,251,0.07); z-index:5;">
              <span class="text-[9px] font-bold text-primary">Drop</span>
            </div>

            <!-- Events in this cell: vertical stack — title above, time below. -->
            <!-- z-index keeps multi-hour events clickable beyond their parent cell — without it,
                 cells in the rows below cover the overflow region and steal pointer events. -->
            <div *ngFor="let evt of getEventsForCell(hour, day.dateStr); trackBy: trackByEventId"
                 [attr.data-event-id]="evt.id"
                 [attr.title]="evt.title + ' · ' + (evt.startTime || '') + '–' + (evt.endTime || '')"
                 class="absolute rounded-md px-1.5 py-0.5 flex flex-col justify-center gap-0.5 border-l-2 overflow-hidden cursor-pointer select-none transition-shadow"
                 [class.cursor-grab]="selectedEventId() === evt.id"
                 [class.active:cursor-grabbing]="selectedEventId() === evt.id"
                 style="touch-action: none;"
                 [style.zIndex]="movingEventId() === evt.id ? 8 : (selectedEventId() === evt.id ? 7 : 6)"
                 [style.boxShadow]="selectedEventId() === evt.id
                   ? '0 0 0 2px #5e43fb, 0 8px 20px rgba(94,67,251,0.25)'
                   : '0 1px 4px rgba(0,0,0,0.06)'"
                 [ngStyle]="getCellEventStyle(evt, day.dateStr)"
                 [style.opacity]="movingEventId() === evt.id ? '0.35' : '1'"
                 [style.background]="getEventBg()"
                 [style.borderLeftColor]="getEventBorder(evt.color)"
                 (mousedown)="onEventDown($event, evt)"
                 (touchstart)="onEventDown($event, evt)">
              <span class="text-[11px] font-bold truncate leading-tight text-on-surface pointer-events-none">
                {{ evt.title }}
              </span>
              <span *ngIf="(getDayLayout(day.dateStr).get(evt.id)?.count ?? 1) <= 1"
                    class="text-[9px] font-medium leading-tight truncate opacity-80 pointer-events-none"
                    [style.color]="getEventBorder(evt.color)">
                {{ resizingEventId() === evt.id ? resizingTimeLabel() : (evt.startTime || '') + '–' + (evt.endTime || '') }}
              </span>
              <!-- Resize handle: small centered pill so it doesn't steal taps on title/time text -->
              <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-2.5 flex items-center justify-center cursor-ns-resize hover:bg-primary/10 rounded-t-md transition-colors"
                   data-resize-handle
                   style="touch-action: none;"
                   (mousedown)="onResizeStart($event, evt)"
                   (touchstart)="onResizeStart($event, evt)">
                <div class="w-5 h-0.5 rounded-full bg-on-surface-variant/40"></div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Insights Bento -->
    <div class="px-margin-page mt-stack-lg grid grid-cols-2 gap-4 mb-8">
      <div class="rounded-2xl p-4 text-white col-span-1"
           style="background:#5e43fb; box-shadow:0 8px 24px rgba(94,67,251,0.3);">
        <span class="material-symbols-outlined mb-2 block" style="color:rgba(255,255,255,0.6)">bolt</span>
        <p class="font-bold text-xl">{{ weekVelocity }}%</p>
        <p class="text-[12px] mt-0.5" style="color:rgba(255,255,255,0.8)">Velocity</p>
      </div>
      <div class="bg-surface-container-lowest rounded-2xl p-4 border border-slate-100 col-span-1"
           style="box-shadow:0 4px 12px rgba(0,0,0,0.04);">
        <span class="material-symbols-outlined mb-2 block text-secondary-container">check_circle</span>
        <p class="font-bold text-xl text-on-surface">{{ weekEventsCount }}</p>
        <p class="text-[12px] text-outline mt-0.5">Scheduled</p>
      </div>
    </div>

    <!-- FAB -->
    <button type="button"
            (click)="openSlotPopup()"
            class="fixed bottom-24 right-6 w-14 h-14 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform z-50"
            style="background:linear-gradient(135deg,#5e43fb,#00c1fd); box-shadow:0 8px 24px rgba(94,67,251,0.3);"
            data-testid="schedule-fab">
      <span class="material-symbols-outlined text-2xl">add</span>
    </button>

    <!-- Schedule a slot popup -->
    <app-schedule-slot-popup
      *ngIf="slotPopupOpen()"
      [tasks]="allTasks()"
      [defaultDate]="defaultPopupDate()"
      [error]="slotPopupError()"
      [busy]="slotPopupBusy()"
      (close)="closeSlotPopup()"
      (confirm)="onSlotConfirm($event)"
      (newTask)="goToNewTask()">
    </app-schedule-slot-popup>

    <!-- Edit schedule modal (long-press) -->
    <div *ngIf="editingEvent()"
         class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
         (click)="closeEditModal()">
      <div class="absolute inset-0 bg-on-surface/30 backdrop-blur-sm"></div>
      <div class="relative bg-surface-container-lowest rounded-t-[28px] sm:rounded-[28px] w-full sm:max-w-md p-6 pb-8"
           (click)="$event.stopPropagation()">
        <div class="w-12 h-1 rounded-full bg-outline-variant mx-auto mb-5 sm:hidden"></div>
        <h3 class="font-bold text-[20px] text-on-surface mb-1 font-manrope">Edit schedule</h3>
        <p class="text-[13px] text-on-surface-variant mb-5 truncate">{{ editingEvent()?.title }}</p>

        <div class="mb-3 min-w-0">
          <label class="block text-[10px] font-bold text-outline uppercase ml-1 mb-1">Date</label>
          <div class="flex items-center gap-1.5 px-2.5 py-2.5 bg-surface-container-low rounded-xl min-w-0">
            <span class="material-symbols-outlined text-on-surface-variant text-[16px] flex-shrink-0">event</span>
            <input type="date" [(ngModel)]="editDate"
                   class="flex-1 min-w-0 w-full bg-transparent border-none focus:ring-0 text-[14px] p-0" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 mb-5">
          <div class="min-w-0">
            <label class="block text-[10px] font-bold text-outline uppercase ml-1 mb-1">Start</label>
            <div class="flex items-center gap-1.5 px-2.5 py-2.5 bg-surface-container-low rounded-xl min-w-0">
              <span class="material-symbols-outlined text-on-surface-variant text-[16px] flex-shrink-0">schedule</span>
              <input type="time" [(ngModel)]="editStart"
                     class="flex-1 min-w-0 w-full bg-transparent border-none focus:ring-0 text-[14px] p-0" />
            </div>
          </div>
          <div class="min-w-0">
            <label class="block text-[10px] font-bold text-outline uppercase ml-1 mb-1">End</label>
            <div class="flex items-center gap-1.5 px-2.5 py-2.5 bg-surface-container-low rounded-xl min-w-0">
              <span class="material-symbols-outlined text-on-surface-variant text-[16px] flex-shrink-0">schedule</span>
              <input type="time" [(ngModel)]="editEnd"
                     class="flex-1 min-w-0 w-full bg-transparent border-none focus:ring-0 text-[14px] p-0" />
            </div>
          </div>
        </div>

        <div class="flex gap-3">
          <button (click)="closeEditModal()"
                  class="flex-1 py-3 text-on-surface-variant font-semibold rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors">
            Cancel
          </button>
          <button (click)="saveEditModal()"
                  class="flex-1 py-3 text-white font-semibold rounded-xl active:scale-95 transition-all"
                  style="background:#5e43fb; box-shadow:0 4px 12px rgba(94,67,251,0.25);">
            Save
          </button>
        </div>
      </div>
    </div>

    <!-- Exception/cross-day popup -->
    <app-exception-popup
      *ngIf="popupVisible()"
      [title]="popupTitle()"
      [yesLabel]="popupYesLabel()"
      [noLabel]="popupNoLabel()"
      (yes)="onPopupYes()"
      (no)="onPopupNo()">
    </app-exception-popup>

    <!-- Delete bin -->
    <div *ngIf="movingEventId() !== null"
         class="fixed inset-x-0 bottom-28 z-50 flex justify-center pointer-events-none"
         data-testid="delete-bin-wrap">
      <div data-bin
           data-testid="delete-bin"
           class="pointer-events-auto rounded-full px-6 py-4 shadow-card flex items-center gap-2 transition-transform duration-150"
           [class.scale-110]="binArmed()"
           [style.background]="binArmed() ? '#ba1a1a' : 'rgba(186,26,26,0.85)'"
           [style.color]="'#fff'">
        <span class="material-symbols-outlined">delete</span>
        <span class="font-semibold text-[14px]">{{ binArmed() ? 'Release to delete' : 'Drop to delete' }}</span>
      </div>
    </div>
  `,
})
export class ScheduleWeekComponent implements OnInit, OnDestroy {
  router = inject(Router);
  private plannedTasks = inject(PlannedTaskService);
  private freqValidator = inject(FrequencyValidatorService);
  private zone = inject(NgZone);
  private doc = inject(DOCUMENT);

  // Zoom: 1.0 = 100% (COL_W=110, ROW_H=64). Range 0.6 — 2.0.
  private readonly BASE_COL_W = 128;
  private readonly BASE_ROW_H = 64;
  private zoomFactor = 1;
  get COL_W(): number { return Math.round(this.BASE_COL_W * this.zoomFactor); }
  get ROW_H(): number { return Math.round(this.BASE_ROW_H * this.zoomFactor); }
  get zoomPct(): number { return Math.round(this.zoomFactor * 100); }
  get canZoomIn(): boolean { return this.zoomFactor < 2; }
  get canZoomOut(): boolean { return this.zoomFactor > 0.6; }
  zoomIn(): void {
    if (!this.canZoomIn) return;
    this.zoomFactor = Math.min(2, +(this.zoomFactor * 1.25).toFixed(3));
  }
  zoomOut(): void {
    if (!this.canZoomOut) return;
    this.zoomFactor = Math.max(0.6, +(this.zoomFactor / 1.25).toFixed(3));
  }

  hours = HOURS;
  unplannedOpen = true;
  weekStart = this.getMonday(new Date());

  views = [
    { label: 'Day',   route: '/schedule' },
    { label: 'Week',  route: '/schedule/week' },
    { label: 'Month', route: '/schedule/month' },
  ];

  // Signal holding PlannedTask[] per date for the current week
  tasksByDay = signal<Map<string, PlannedTask[]>>(new Map());

  unscheduledTasks = computed(() => {
    const all: PlannedTask[] = [];
    this.tasksByDay().forEach(list => {
      for (const t of list) {
        if (t.cadence === 'DAILY') continue;
        if (!t.needsTimeSlot) continue;
        if (all.some(x => x.id === t.id)) continue;
        const scheduled = this.scheduledMinutesOnDate(t);
        if (scheduled === 0 || (t.minTimeMinutes ?? 0) > scheduled) {
          all.push(t);
        }
      }
    });
    return all;
  });

  frequencyWarnings = computed<FrequencyWarning[]>(() => {
    const dedup = new Map<string, PlannedTask>();
    this.tasksByDay().forEach(list => list.forEach(t => dedup.set(t.id, t)));
    const all = Array.from(dedup.values());
    return [
      ...this.freqValidator.validateForWeek(all, this.weekStart),
      ...this.freqValidator.validateForMonth(all, this.weekStart),
    ];
  });

  weeklyPendingRows = computed(() => {
    const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const weekdayNames: Weekday[] = [
      'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
    ];
    const todayIso = this.isoOf(new Date());
    const weekDates: { dateStr: string; label: string; weekday: Weekday; isToday: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(this.weekStart);
      d.setDate(this.weekStart.getDate() + i);
      const ds = this.isoOf(d);
      weekDates.push({
        dateStr: ds, label: labels[i], weekday: weekdayNames[i],
        isToday: ds === todayIso,
      });
    }
    const byTask = new Map<string, { task: PlannedTask; perDate: Map<string, PlannedTask> }>();
    this.tasksByDay().forEach((list, dateStr) => {
      for (const t of list) {
        if (t.cadence !== 'WEEKLY') continue;
        const entry = byTask.get(t.id) ?? { task: t, perDate: new Map<string, PlannedTask>() };
        entry.perDate.set(dateStr, t);
        byTask.set(t.id, entry);
      }
    });
    return Array.from(byTask.values()).map(({ task, perDate }) => ({
      taskId: task.id,
      title: task.title,
      color: task.color,
      days: weekDates.map(d => {
        const entry = perDate.get(d.dateStr);
        const applies = !!entry;
        const isPlanned = task.weekdays?.includes(d.weekday) ?? false;
        const hasSlot = !!entry && (!!entry.startTime || (entry.segmentsForDate?.length ?? 0) > 0);
        let status: 'green' | 'red' | 'yellow' | 'faded';
        if (isPlanned && hasSlot) status = 'green';
        else if (isPlanned && !hasSlot) status = 'red';
        else if (!isPlanned && applies && hasSlot) status = 'yellow';
        else status = 'faded';
        return { label: d.label, status, isToday: d.isToday };
      }),
    }));
  });

  private isoOf(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  scheduledMinutesOnDate(t: PlannedTask): number {
    const segs = t.segmentsForDate ?? [];
    if (segs.length > 0) {
      return segs.reduce((sum, s) => sum + this.diffMinutes(s.startTime, s.endTime), 0);
    }
    if (t.startTime && t.endTime) return this.diffMinutes(t.startTime, t.endTime);
    return 0;
  }

  remainingMinutes(t: PlannedTask): number {
    return Math.max(0, (t.minTimeMinutes ?? 0) - this.scheduledMinutesOnDate(t));
  }

  draggingTask  = signal<PlannedTask | null>(null);
  dragOverHour  = signal<number | null>(null);
  dragOverDate  = signal<string | null>(null);

  // Touch drag state
  private touchClone: HTMLElement | null = null;
  private touchDropHour: number | null = null;
  private touchDropDate: string | null = null;
  private readonly boundTouchMove = (e: TouchEvent) => this.onTouchMove(e);
  private readonly boundTouchEnd  = (e: TouchEvent) => this.onTouchEnd(e);

  // Pointer-drag (click-or-move) state
  private moveDrag: {
    evt: PlannedTask;
    fromDate: string;
    startX: number; startY: number;
    isDragging: boolean;
    hoverHour: number | null;
    hoverDate: string | null;
    ghost: HTMLElement | null;
  } | null = null;
  binArmed = signal(false);
  private moveOverBin = false;

  slotPopupOpen = signal(false);
  slotPopupError = signal<string | null>(null);
  slotPopupBusy = signal(false);
  allTasks = signal<PlannedTask[]>([]);
  movingEventId = signal<string | null>(null);
  selectedEventId = signal<string | null>(null);
  private readonly boundMoveTrack = (e: MouseEvent | TouchEvent) => this.onMoveTrack(e);
  private readonly boundMoveEnd = (e: MouseEvent | TouchEvent) => this.onMoveEnd(e);

  // Resize state
  resizingEventId = signal<string | null>(null);
  resizingHeight = signal<number>(0);
  private resizeStartY = 0;
  private resizeStartHeight = 0;
  private resizeEvent: PlannedTask | null = null;
  private readonly boundResizeMove = (e: MouseEvent | TouchEvent) => this.onResizeMove(e);
  private readonly boundResizeEnd = (e: MouseEvent | TouchEvent) => this.onResizeEnd(e);

  resizingTimeLabel = computed(() => {
    if (!this.resizeEvent || !this.resizeEvent.startTime) return '';
    const minutes = this.pixelsToMinutes(this.resizingHeight());
    const end = this.addMinutesToTime(this.resizeEvent.startTime, minutes);
    return `${this.resizeEvent.startTime}–${end}`;
  });

  // Grid lock + auto-pan during gestures
  @ViewChild('gridScroll') gridScrollRef?: ElementRef<HTMLElement>;
  private get gridScrollEl(): HTMLElement | null {
    return this.gridScrollRef?.nativeElement ?? null;
  }
  private currentDragXY: { x: number; y: number } | null = null;
  private autoPanRaf: number | null = null;
  private readonly wheelBlocker = (e: Event) => e.preventDefault();

  // Edit modal state
  editingEvent = signal<PlannedTask | null>(null);
  editDate = '';
  editStart = '';
  editEnd = '';

  // Exception popup state
  popupVisible = signal(false);
  popupTitle = signal('');
  popupYesLabel = signal('Yes, every week');
  popupNoLabel = signal('No, just this date');
  private popupOnYes: (() => void) | null = null;
  private popupOnNo: (() => void) | null = null;

  get weekDays() {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(this.weekStart);
      d.setDate(d.getDate() + i);
      return {
        abbr: DAY_ABBR[d.getDay()],
        day: d.getDate(),
        date: d,
        dateStr: this.isoOf(d),
      };
    });
  }

  get weekLabel(): string {
    const end = new Date(this.weekStart);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(this.weekStart)} – ${fmt(end)}`;
  }

  get weekEventsCount(): number {
    let n = 0;
    this.tasksByDay().forEach(list => {
      n += list.filter(t => !!t.startTime && !!t.endTime).length;
    });
    return n;
  }

  get weekVelocity(): number {
    const scheduled = this.weekEventsCount;
    const unscheduled = this.unscheduledTasks().length;
    const total = scheduled + unscheduled;
    return total === 0 ? 0 : Math.round((scheduled / total) * 100);
  }

  // Computed buckets for the grid — split by (dateStr, hour) key
  private allEventsByCell = computed(() => {
    const byCell = new Map<string, WeekBar[]>();
    this.tasksByDay().forEach((list, dateStr) => {
      for (const t of list) {
        const bars = this.barsForTaskOnDate(t, dateStr);
        for (const bar of bars) {
          const hour = parseInt(bar.startTime!.split(':')[0], 10);
          const key = `${dateStr}#${hour}`;
          let bucket = byCell.get(key);
          if (!bucket) { bucket = []; byCell.set(key, bucket); }
          bucket.push(bar);
        }
      }
    });
    return byCell;
  });

  private allLayouts = computed(() => {
    const layouts = new Map<string, Map<string, { col: number; count: number }>>();
    this.tasksByDay().forEach((list, dateStr) => {
      const bars: PlannedTask[] = [];
      for (const t of list) bars.push(...this.barsForTaskOnDate(t, dateStr));
      layouts.set(dateStr, this.computeLayout(bars));
    });
    return layouts;
  });

  private barsForTaskOnDate(t: PlannedTask, dateStr: string): WeekBar[] {
    const segs = t.segmentsForDate ?? [];
    if (segs.length > 0) {
      return segs.map(s => ({
        ...t, _segmentId: s.id, _dateStr: dateStr,
        startTime: s.startTime, endTime: s.endTime,
      }));
    }
    if (t.startTime && t.endTime) {
      return [{ ...t, _segmentId: null, _dateStr: dateStr }];
    }
    return [];
  }

  ngOnInit(): void { this.reload(); }

  ngOnDestroy(): void {
    this.cleanupTouch();
    this.cancelMoveDrag();
    this.stopAutoPan();
    this.unlockGrid();
    this.doc.removeEventListener('mousemove', this.boundResizeMove as EventListener);
    this.doc.removeEventListener('mouseup', this.boundResizeEnd as EventListener);
    this.doc.removeEventListener('touchmove', this.boundResizeMove as EventListener);
    this.doc.removeEventListener('touchend', this.boundResizeEnd as EventListener);
    this.doc.removeEventListener('touchcancel', this.boundResizeEnd as EventListener);
  }

  private weekStartIso(): string {
    return this.isoOf(this.weekStart);
  }

  private reload(): void {
    this.plannedTasks.loadForWeek(this.weekStartIso()).subscribe(map => this.tasksByDay.set(map));
  }

  isToday(date: Date): boolean {
    return date.toDateString() === new Date().toDateString();
  }

  formatHour(h: number): string {
    return `${h.toString().padStart(2, '0')}:00`;
  }

  getEventsForCell(hour: number, dateStr: string): WeekBar[] {
    return this.allEventsByCell().get(`${dateStr}#${hour}`) ?? [];
  }

  trackByEventId(_i: number, evt: WeekBar): string { return evt._segmentId ?? evt.id; }
  trackByDateStr(_i: number, day: { dateStr: string }): string { return day.dateStr; }
  trackByHour(_i: number, hour: number): number { return hour; }

  getCellEventHeight(startTime: string, endTime: string): number {
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    return Math.max(28, ((toMin(endTime) - toMin(startTime)) / 60) * this.ROW_H - 4);
  }

  // ── Overlap layout ──────────────────────────────────────────────────
  private toMin(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  private computeLayout(events: PlannedTask[]): Map<string, { col: number; count: number }> {
    const result = new Map<string, { col: number; count: number }>();
    if (events.length === 0) return result;
    const sorted = [...events].sort((a, b) => this.toMin(a.startTime!) - this.toMin(b.startTime!));
    let cluster: PlannedTask[] = [];
    let clusterEnd = -1;
    const flush = () => {
      if (!cluster.length) return;
      const cols: number[] = [];
      const assigns: number[] = [];
      for (const evt of cluster) {
        const start = this.toMin(evt.startTime!);
        let assigned = -1;
        for (let i = 0; i < cols.length; i++) {
          if (cols[i] <= start) { assigned = i; break; }
        }
        if (assigned === -1) { assigned = cols.length; cols.push(0); }
        cols[assigned] = this.toMin(evt.endTime!);
        assigns.push(assigned);
      }
      const count = cols.length;
      cluster.forEach((evt, i) => result.set(evt.id, { col: assigns[i], count }));
    };
    for (const evt of sorted) {
      const s = this.toMin(evt.startTime!);
      const e = this.toMin(evt.endTime!);
      if (s < clusterEnd) {
        cluster.push(evt);
        clusterEnd = Math.max(clusterEnd, e);
      } else {
        flush();
        cluster = [evt];
        clusterEnd = e;
      }
    }
    flush();
    return result;
  }

  getDayLayout(dateStr: string): Map<string, { col: number; count: number }> {
    return this.allLayouts().get(dateStr) ?? new Map();
  }

  get weekConflictCount(): number {
    let n = 0;
    for (const day of this.weekDays) {
      this.getDayLayout(day.dateStr).forEach(l => { if (l.count > 1) n++; });
    }
    return n;
  }

  getCellEventStyle(evt: PlannedTask, dateStr: string): Record<string, string> {
    const isResizing = this.resizingEventId() === evt.id;
    const height = isResizing
      ? this.resizingHeight()
      : this.getCellEventHeight(evt.startTime!, evt.endTime!);
    const layout = this.getDayLayout(dateStr).get(evt.id);
    const style: Record<string, string> = {
      top: '4px',
      height: `${height}px`,
    };
    if (!layout || layout.count <= 1) {
      style['left'] = '4px';
      style['right'] = '4px';
      style['width'] = 'auto';
      return style;
    }
    const widthPct = 100 / layout.count;
    style['left'] = `calc(2px + ${layout.col * widthPct}%)`;
    style['width'] = `calc(${widthPct}% - 4px)`;
    style['right'] = 'auto';
    return style;
  }

  // All planned tasks are "task" type — use task styling for all
  getEventBg(): string {
    return 'rgba(228,223,255,0.45)';
  }

  getEventBorder(color: string): string {
    return color || '#451de3';
  }

  getTaskIcon(task: PlannedTask): string {
    const t = task.title.toLowerCase();
    if (t.includes('study') || t.includes('interview') || t.includes('learn')) return 'menu_book';
    if (t.includes('workout') || t.includes('fitness') || t.includes('run')) return 'fitness_center';
    if (t.includes('api') || t.includes('schema') || t.includes('code')) return 'code';
    if (t.includes('wire') || t.includes('design') || t.includes('flow')) return 'draw';
    if (t.includes('meeting') || t.includes('sync')) return 'groups';
    return 'task_alt';
  }

  prevWeek(): void {
    const d = new Date(this.weekStart);
    d.setDate(d.getDate() - 7);
    this.weekStart = d;
    this.reload();
  }

  nextWeek(): void {
    const d = new Date(this.weekStart);
    d.setDate(d.getDate() + 7);
    this.weekStart = d;
    this.reload();
  }

  // ── Desktop drag ─────────────────────────────────────────────────────
  onDragStart(event: DragEvent, task: PlannedTask): void {
    this.draggingTask.set(task);
    if (event.dataTransfer) {
      event.dataTransfer.setData('taskId', task.id);
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragEnd(): void {
    this.draggingTask.set(null);
    this.dragOverHour.set(null);
    this.dragOverDate.set(null);
  }

  onDragOver(event: DragEvent, hour: number, dateStr: string): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (this.dragOverHour() !== hour)   this.dragOverHour.set(hour);
    if (this.dragOverDate() !== dateStr) this.dragOverDate.set(dateStr);
  }

  onDragLeave(event: DragEvent): void {
    const rel = event.relatedTarget as HTMLElement | null;
    if (!rel || !(event.currentTarget as HTMLElement).contains(rel)) {
      this.dragOverHour.set(null);
      this.dragOverDate.set(null);
    }
  }

  onDrop(event: DragEvent, hour: number, dateStr: string): void {
    event.preventDefault();
    const task = this.draggingTask();
    if (task) this.scheduleAt(task, hour, dateStr);
    this.draggingTask.set(null);
    this.dragOverHour.set(null);
    this.dragOverDate.set(null);
  }

  // ── Touch drag ───────────────────────────────────────────────────────
  onTouchStart(event: TouchEvent, task: PlannedTask): void {
    this.draggingTask.set(task);
    const src  = event.currentTarget as HTMLElement;
    const rect = src.getBoundingClientRect();
    const clone = src.cloneNode(true) as HTMLElement;
    clone.style.cssText = `
      position:fixed; left:${rect.left}px; top:${rect.top}px;
      width:${rect.width}px; z-index:9999; opacity:0.85;
      pointer-events:none; transform:scale(1.06) rotate(2deg);
      transform-origin:center; transition:none; border-radius:16px;
    `;
    this.doc.body.appendChild(clone);
    this.touchClone = clone;
    this.doc.addEventListener('touchmove', this.boundTouchMove, { passive: false } as AddEventListenerOptions);
    this.doc.addEventListener('touchend',  this.boundTouchEnd);
  }

  private onTouchMove(event: TouchEvent): void {
    event.preventDefault();
    const touch = event.touches[0];

    if (this.touchClone) {
      const w = this.touchClone.offsetWidth;
      this.touchClone.style.left = `${touch.clientX - w / 2}px`;
      this.touchClone.style.top  = `${touch.clientY - 50}px`;

      this.touchClone.style.visibility = 'hidden';
      const el = this.doc.elementFromPoint(touch.clientX, touch.clientY);
      this.touchClone.style.visibility = 'visible';

      const cell = el?.closest('[data-hour][data-date]');
      const hour = cell ? parseInt(cell.getAttribute('data-hour')!, 10) : null;
      const date = cell ? cell.getAttribute('data-date') : null;

      if (hour !== this.touchDropHour || date !== this.touchDropDate) {
        this.touchDropHour = hour;
        this.touchDropDate = date;
        this.zone.run(() => {
          this.dragOverHour.set(hour);
          this.dragOverDate.set(date);
        });
      }
    }
  }

  private onTouchEnd(_event: TouchEvent): void {
    this.cleanupTouch();
    const task = this.draggingTask();
    const hour = this.touchDropHour;
    const date = this.touchDropDate;

    if (this.touchClone) {
      this.doc.body.removeChild(this.touchClone);
      this.touchClone = null;
    }

    this.zone.run(() => {
      if (task && hour !== null && date) this.scheduleAt(task, hour, date);
      this.draggingTask.set(null);
      this.dragOverHour.set(null);
      this.dragOverDate.set(null);
    });
    this.touchDropHour = null;
    this.touchDropDate = null;
  }

  private cleanupTouch(): void {
    this.doc.removeEventListener('touchmove', this.boundTouchMove);
    this.doc.removeEventListener('touchend',  this.boundTouchEnd);
  }

  private scheduleAt(task: PlannedTask, hour: number, dateStr: string): void {
    const start = `${hour.toString().padStart(2, '0')}:00`;
    // Default duration: remainder if any, else minTimeMinutes, else 15 min.
    const remaining = this.remainingMinutes(task);
    const minutes = remaining > 0 ? remaining : (task.minTimeMinutes ?? 15);
    const total = hour * 60 + minutes;
    const eh = Math.min(23, Math.floor(total / 60));
    const em = total % 60;
    const end = `${eh.toString().padStart(2, '0')}:${em.toString().padStart(2, '0')}`;

    const droppedDate = new Date(dateStr + 'T00:00:00');
    const droppedWeekday = JS_DAY_TO_WEEKDAY[droppedDate.getDay()];
    const existingWeekdays = task.weekdays ?? [];
    const isCovered = task.cadence !== 'WEEKLY' || existingWeekdays.includes(droppedWeekday);

    const finishCoverage = () => {
      if (!isCovered && task.cadence === 'WEEKLY') {
        this.plannedTasks.addException(task.id, dateStr, 'ADD').subscribe(() => {
          this.reload();
          this.openPopup(
            `Add ${droppedWeekday} to every week's ${task.title}?`,
            'Yes, every week',
            'No, just this date',
            () => {
              this.plannedTasks.applyPermanently(task.id, dateStr, {
                weekdays: [...existingWeekdays, droppedWeekday],
              }).subscribe(() => this.reload());
            },
            () => this.reload(),
          );
        });
      } else {
        this.reload();
      }
    };

    const segs = task.segmentsForDate ?? [];
    if (segs.length === 0 && task.startTime && task.endTime) {
      // Lift template times into a segment so adding a new chunk doesn't replace the existing render.
      this.plannedTasks.createSegment(task.id, dateStr, task.startTime, task.endTime).subscribe({
        next: () => this.plannedTasks.createSegment(task.id, dateStr, start, end).subscribe(() => finishCoverage()),
        error: () => this.plannedTasks.createSegment(task.id, dateStr, start, end).subscribe(() => finishCoverage()),
      });
    } else if (segs.length === 0 && !task.startTime) {
      // First time scheduling — set template times.
      this.plannedTasks.update(task.id, { startTime: start, endTime: end, needsTimeSlot: true })
        .subscribe(() => finishCoverage());
    } else {
      this.plannedTasks.createSegment(task.id, dateStr, start, end)
        .subscribe(() => finishCoverage());
    }
  }

  // ── Pointer interaction: tap → edit, hold-and-drag → move ──────────
  onEventDown(event: MouseEvent | TouchEvent, evt: PlannedTask): void {
    const target = event.target as HTMLElement;
    if (target.closest('[data-resize-handle]')) return;
    if (this.moveDrag) this.cancelMoveDrag();

    event.stopPropagation();
    if ('touches' in event) event.preventDefault();
    this.zone.run(() => this.selectedEventId.set(evt.id));

    // Determine which column (date) this event is displayed in
    const el = event.target as HTMLElement;
    const cellEl = el.closest('[data-date]');
    const fromDate = cellEl?.getAttribute('data-date') ?? '';

    this.moveDrag = {
      evt,
      fromDate,
      startX: this.eventX(event),
      startY: this.eventY(event),
      isDragging: false,
      hoverHour: null,
      hoverDate: null,
      ghost: null,
    };

    this.lockGrid();

    // Registering outside the Angular zone keeps mousemove/touchmove from triggering
    // change detection on every event — only signal updates inside zone.run() do.
    this.zone.runOutsideAngular(() => {
      this.doc.addEventListener('mousemove', this.boundMoveTrack as EventListener);
      this.doc.addEventListener('mouseup', this.boundMoveEnd as EventListener);
      this.doc.addEventListener('touchmove', this.boundMoveTrack as EventListener, { passive: false } as AddEventListenerOptions);
      this.doc.addEventListener('touchend', this.boundMoveEnd as EventListener);
      this.doc.addEventListener('touchcancel', this.boundMoveEnd as EventListener);
    });
  }

  private onMoveTrack(event: MouseEvent | TouchEvent): void {
    if (!this.moveDrag) return;
    const x = this.eventX(event);
    const y = this.eventY(event);
    const dx = Math.abs(x - this.moveDrag.startX);
    const dy = Math.abs(y - this.moveDrag.startY);

    if (!this.moveDrag.isDragging) {
      if (dx < 6 && dy < 6) return;
      this.moveDrag.isDragging = true;
      this.zone.run(() => this.movingEventId.set(this.moveDrag!.evt.id));
      this.createMoveGhost(this.moveDrag.evt);
    }

    event.preventDefault?.();

    this.currentDragXY = { x, y };
    this.startAutoPan();

    if (this.moveDrag.ghost) {
      const w = this.moveDrag.ghost.offsetWidth;
      this.moveDrag.ghost.style.left = `${x - w / 2}px`;
      this.moveDrag.ghost.style.top = `${y - 16}px`;

      this.moveDrag.ghost.style.visibility = 'hidden';
      const el = this.doc.elementFromPoint(x, y);
      this.moveDrag.ghost.style.visibility = 'visible';

      const overBin = !!el?.closest('[data-bin]');
      if (overBin !== this.moveOverBin) {
        this.moveOverBin = overBin;
        this.zone.run(() => this.binArmed.set(overBin));
      }

      const cell = el?.closest('[data-hour][data-date]');
      const hour = cell ? parseInt(cell.getAttribute('data-hour')!, 10) : null;
      const date = cell ? cell.getAttribute('data-date') : null;
      if (hour !== this.moveDrag.hoverHour || date !== this.moveDrag.hoverDate) {
        this.moveDrag.hoverHour = hour;
        this.moveDrag.hoverDate = date;
        this.zone.run(() => {
          this.dragOverHour.set(hour);
          this.dragOverDate.set(date);
        });
      }
    }
  }

  private onMoveEnd(event: MouseEvent | TouchEvent): void {
    if (!this.moveDrag) return;
    const drag = this.moveDrag;

    this.doc.removeEventListener('mousemove', this.boundMoveTrack as EventListener);
    this.doc.removeEventListener('mouseup', this.boundMoveEnd as EventListener);
    this.doc.removeEventListener('touchmove', this.boundMoveTrack as EventListener);
    this.doc.removeEventListener('touchend', this.boundMoveEnd as EventListener);
    this.doc.removeEventListener('touchcancel', this.boundMoveEnd as EventListener);

    this.stopAutoPan();
    this.unlockGrid();

    if (drag.ghost) {
      drag.ghost.remove();
      drag.ghost = null;
    }

    const droppedOnBin = drag.isDragging && this.pointerOverBin(event);
    this.moveOverBin = false;

    this.zone.run(() => {
      if (droppedOnBin) {
        this.deleteBar(drag.evt as WeekBar, drag.fromDate);
      } else if (drag.isDragging) {
        if (drag.hoverHour !== null && drag.hoverDate && drag.evt.startTime && drag.evt.endTime) {
          const duration = this.diffMinutes(drag.evt.startTime, drag.evt.endTime);
          const newStart = `${drag.hoverHour.toString().padStart(2, '0')}:00`;
          const newEnd = this.addMinutesToTime(newStart, duration);
          const fromDate = drag.fromDate;
          const toDate = drag.hoverDate;

          if (fromDate && toDate && fromDate !== toDate) {
            const bar = drag.evt as WeekBar;
            if (bar._segmentId) {
              // Segment cross-day move: rebuild on toDate
              this.moveSegmentToDate(bar, fromDate, toDate, newStart, newEnd);
            } else {
              this.moveTemplateBarToDate(bar, fromDate, toDate);
            }
          } else {
            // Same-day move: segment-aware branching
            const bar = drag.evt as WeekBar;
            if (bar._segmentId) {
              this.plannedTasks.updateSegment(bar.id, bar._segmentId, { startTime: newStart, endTime: newEnd })
                .subscribe(() => this.reload());
            } else if (bar.cadence === 'ONCE') {
              this.plannedTasks.update(bar.id, { startTime: newStart, endTime: newEnd })
                .subscribe(() => this.reload());
            } else {
              this.askTimePopupFor(bar, drag.fromDate, newStart, newEnd);
            }
          }
        }
      } else {
        this.openEditModal(drag.evt, drag.fromDate);
      }
      this.movingEventId.set(null);
      this.dragOverHour.set(null);
      this.dragOverDate.set(null);
      this.binArmed.set(false);
    });

    this.moveDrag = null;
  }

  defaultPopupDate(): string {
    return this.isoOf(this.weekStart);
  }

  openSlotPopup(): void {
    this.slotPopupError.set(null);
    this.slotPopupBusy.set(false);
    this.plannedTasks.loadAll().subscribe(list => {
      this.allTasks.set(list);
      this.slotPopupOpen.set(true);
    });
  }

  closeSlotPopup(): void {
    this.slotPopupOpen.set(false);
    this.slotPopupError.set(null);
    this.slotPopupBusy.set(false);
  }

  goToNewTask(): void {
    this.closeSlotPopup();
    this.router.navigateByUrl('/new-task');
  }

  onSlotConfirm(e: SlotPopupConfirm): void {
    if (this.slotPopupBusy()) return;
    this.slotPopupError.set(null);
    this.slotPopupBusy.set(true);

    const task = this.allTasks().find(t => t.id === e.taskId);
    if (!task) {
      this.slotPopupBusy.set(false);
      this.slotPopupError.set('Task not found. Refresh and try again.');
      return;
    }

    const onError = (err: any, fallback: string) => {
      this.slotPopupBusy.set(false);
      this.slotPopupError.set(this.errorMessageFor(err, fallback));
    };

    const create = () => {
      this.plannedTasks.createSegment(e.taskId, e.date, e.startTime, e.endTime)
        .subscribe({
          next: () => {
            this.slotPopupBusy.set(false);
            this.closeSlotPopup();
            this.reload();
          },
          error: (err) => onError(err, 'Could not create the slot.'),
        });
    };

    this.prepareDateForSegment(task, e.date).subscribe({
      next: create,
      error: (err) => onError(err, 'Could not schedule on this date.'),
    });
  }

  private prepareDateForSegment(task: PlannedTask, date: string): Observable<unknown> {
    const ex = task.exceptions?.find(x => x.date === date);
    const covered = this.isApplicable({ ...task, exceptions: [] } as PlannedTask, date);

    if (covered) {
      if (ex?.type === 'SKIP') {
        return this.plannedTasks.removeException(task.id, date);
      }
      return of(null);
    }
    if (ex?.type === 'ADD') {
      return of(null);
    }
    if (ex?.type === 'SKIP') {
      return this.plannedTasks.removeException(task.id, date).pipe(
        switchMap(() => this.plannedTasks.addException(task.id, date, 'ADD')),
      );
    }
    return this.plannedTasks.addException(task.id, date, 'ADD');
  }

  private errorMessageFor(err: any, fallback: string): string {
    const code = err?.error?.code;
    if (code === 'SEGMENT_OVERLAP') return 'That time overlaps with another slot for this task.';
    if (code === 'EXCEPTION_ALREADY_EXISTS') return 'An exception already exists on that date.';
    return err?.error?.message || fallback;
  }

  private isExceptionConflict(err: any): boolean {
    return err?.status === 409 || err?.error?.code === 'EXCEPTION_ALREADY_EXISTS';
  }

  private isApplicable(task: PlannedTask, dateStr: string): boolean {
    if (task.cadence === 'DAILY') return true;
    if (task.cadence === 'ONCE') return dateStr === task.scheduledDate;
    const d = new Date(dateStr + 'T00:00:00');
    if (task.cadence === 'WEEKLY') {
      const names: Weekday[] = [
        'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY',
      ];
      return task.weekdays?.includes(names[d.getDay()]) ?? false;
    }
    if (task.cadence === 'MONTHLY') {
      return task.monthDays?.includes(d.getDate()) ?? false;
    }
    return false;
  }

  private moveSegmentToDate(bar: WeekBar, fromDate: string, toDate: string, newStart: string, newEnd: string): void {
    const taskId = bar.id;
    const segmentId = bar._segmentId!;
    const ops: (() => Observable<unknown>)[] = [];

    ops.push(() => this.plannedTasks.deleteSegment(taskId, segmentId));

    const fromEx = bar.exceptions?.find(e => e.date === fromDate);
    const fromOtherSegs = (bar.segmentsForDate ?? []).filter(s => s.id !== segmentId);
    if (fromEx?.type === 'ADD' && fromOtherSegs.length === 0) {
      ops.push(() => this.plannedTasks.removeException(taskId, fromDate));
    }

    const toCovered = this.isApplicable({ ...bar, exceptions: [] } as PlannedTask, toDate);
    const toEx = bar.exceptions?.find(e => e.date === toDate);
    if (!toCovered) {
      if (toEx?.type === 'SKIP') {
        ops.push(() => this.plannedTasks.removeException(taskId, toDate));
        ops.push(() => this.plannedTasks.addException(taskId, toDate, 'ADD'));
      } else if (!toEx) {
        ops.push(() => this.plannedTasks.addException(taskId, toDate, 'ADD'));
      }
    } else if (toEx?.type === 'SKIP') {
      ops.push(() => this.plannedTasks.removeException(taskId, toDate));
    }

    ops.push(() => this.plannedTasks.createSegment(taskId, toDate, newStart, newEnd));

    this.chainOps(ops, () => this.reload());
  }

  private moveTemplateBarToDate(bar: WeekBar, fromDate: string, toDate: string): void {
    const taskId = bar.id;
    const task = bar;
    const fromCovered = this.isApplicable({ ...bar, exceptions: [] } as PlannedTask, fromDate);
    const toCovered = this.isApplicable({ ...bar, exceptions: [] } as PlannedTask, toDate);
    const fromEx = bar.exceptions?.find(e => e.date === fromDate);
    const toEx = bar.exceptions?.find(e => e.date === toDate);
    const fromDateObj = new Date(fromDate + 'T00:00:00');
    const toDateObj = new Date(toDate + 'T00:00:00');
    const fromWeekday = JS_DAY_TO_WEEKDAY[fromDateObj.getDay()];
    const toWeekday = JS_DAY_TO_WEEKDAY[toDateObj.getDay()];

    const ops: (() => Observable<unknown>)[] = [];

    if (fromCovered && !fromEx) {
      ops.push(() => this.plannedTasks.addException(taskId, fromDate, 'SKIP'));
    } else if (!fromCovered && fromEx?.type === 'ADD') {
      ops.push(() => this.plannedTasks.removeException(taskId, fromDate));
    }

    if (toCovered && toEx?.type === 'SKIP') {
      ops.push(() => this.plannedTasks.removeException(taskId, toDate));
    } else if (!toCovered && !toEx) {
      ops.push(() => this.plannedTasks.addException(taskId, toDate, 'ADD'));
    } else if (!toCovered && toEx?.type === 'SKIP') {
      ops.push(() => this.plannedTasks.removeException(taskId, toDate));
      ops.push(() => this.plannedTasks.addException(taskId, toDate, 'ADD'));
    }

    const askPermanent =
      task.cadence === 'WEEKLY' &&
      fromCovered &&
      (task.weekdays?.includes(fromWeekday) ?? false);

    this.chainOps(ops, () => {
      this.reload();
      if (askPermanent) {
        this.openPopup(
          `Move ${task.title} from ${fromWeekday} to ${toWeekday} every week?`,
          'Yes, every week',
          'No, just this date',
          () => {
            const existingWeekdays = task.weekdays ?? [];
            const newWeekdays = existingWeekdays
              .filter(d => d !== fromWeekday)
              .concat(toWeekday);
            this.plannedTasks.removeException(taskId, toDate).subscribe({
              next: () => this.plannedTasks.applyPermanently(taskId, fromDate, { weekdays: newWeekdays })
                .subscribe(() => this.reload()),
              error: () => this.reload(),
            });
          },
          () => {},
        );
      }
    });
  }

  private chainOps(ops: (() => Observable<unknown>)[], done: () => void): void {
    if (ops.length === 0) { done(); return; }
    const head = ops.shift()!;
    head().subscribe({
      next: () => this.chainOps(ops, done),
      error: () => this.chainOps(ops, done),
    });
  }

  private deleteBar(bar: WeekBar, date: string): void {
    if (bar.cadence === 'ONCE') {
      this.plannedTasks.remove(bar.id).subscribe(() => this.reload());
      return;
    }
    this.removeOccurrenceForDate(bar, date);
  }

  private removeOccurrenceForDate(bar: WeekBar, date: string): void {
    const after = () => this.reload();
    const ex = bar.exceptions?.find(e => e.date === date);

    if (bar._segmentId) {
      const otherSegs = (bar.segmentsForDate ?? []).filter(s => s.id !== bar._segmentId);
      this.plannedTasks.deleteSegment(bar.id, bar._segmentId).subscribe({
        next: () => {
          if (otherSegs.length === 0 && ex?.type === 'ADD') {
            this.plannedTasks.removeException(bar.id, date)
              .subscribe({ next: after, error: after });
          } else {
            after();
          }
        },
        error: after,
      });
      return;
    }

    const covered = this.isApplicable({ ...bar, exceptions: [] } as PlannedTask, date);
    if (ex?.type === 'ADD') {
      this.plannedTasks.removeException(bar.id, date)
        .subscribe({ next: after, error: after });
    } else if (covered && !ex) {
      this.plannedTasks.addException(bar.id, date, 'SKIP')
        .subscribe({ next: after, error: after });
    } else {
      after();
    }
  }

  private askTimePopupFor(task: PlannedTask, date: string, start: string, newEnd: string): void {
    const unit = this.cadenceUnitLabel(task, date);
    this.openPopup(
      `Apply this time to every ${unit}?`,
      `Yes, every ${unit}`,
      'No, just this date',
      () => this.plannedTasks.update(task.id, { startTime: start, endTime: newEnd })
        .subscribe(() => this.reload()),
      () => this.plannedTasks.createSegment(task.id, date, start, newEnd)
        .subscribe(() => this.reload()),
    );
  }

  private cadenceUnitLabel(task: PlannedTask, dateIso: string): string {
    if (task.cadence === 'DAILY') return 'day';
    if (task.cadence === 'WEEKLY') {
      const wd = new Date(dateIso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' });
      return wd;
    }
    if (task.cadence === 'MONTHLY') {
      const day = new Date(dateIso + 'T00:00:00').getDate();
      return `day ${day} of the month`;
    }
    return 'occurrence';
  }

  // ── Selection: tap empty cell to deselect ───────────────────────────
  onGridClick(e: Event): void {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-event-id]')) return;
    if (this.selectedEventId() !== null) {
      this.selectedEventId.set(null);
    }
  }

  // ── Grid lock & edge auto-pan ───────────────────────────────────────
  private lockGrid(): void {
    const el = this.gridScrollEl;
    if (!el) return;
    el.style.touchAction = 'none';
    el.style.overscrollBehavior = 'contain';
    el.addEventListener('wheel', this.wheelBlocker, { passive: false } as AddEventListenerOptions);
  }

  private unlockGrid(): void {
    const el = this.gridScrollEl;
    if (!el) return;
    el.style.touchAction = '';
    el.style.overscrollBehavior = '';
    el.removeEventListener('wheel', this.wheelBlocker);
  }

  private autoPanTick = (): void => {
    if (!this.currentDragXY || !this.gridScrollEl) {
      this.autoPanRaf = null;
      return;
    }
    if (this.moveOverBin) {
      this.autoPanRaf = null;
      return;
    }
    const el = this.gridScrollEl;
    const rect = el.getBoundingClientRect();
    const EDGE = 60;
    const MAX_SPEED = 14;
    const { x, y } = this.currentDragXY;

    let dx = 0, dy = 0;
    if (x >= rect.left && x < rect.left + EDGE) {
      const t = Math.min(1, (rect.left + EDGE - x) / EDGE);
      dx = -Math.round(MAX_SPEED * t);
    } else if (x <= rect.right && x > rect.right - EDGE) {
      const t = Math.min(1, (x - (rect.right - EDGE)) / EDGE);
      dx = Math.round(MAX_SPEED * t);
    }
    if (y >= rect.top && y < rect.top + EDGE) {
      const t = Math.min(1, (rect.top + EDGE - y) / EDGE);
      dy = -Math.round(MAX_SPEED * t);
    } else if (y <= rect.bottom && y > rect.bottom - EDGE) {
      const t = Math.min(1, (y - (rect.bottom - EDGE)) / EDGE);
      dy = Math.round(MAX_SPEED * t);
    }

    if (dx === 0 && dy === 0) {
      this.autoPanRaf = null;
      return;
    }

    const maxX = el.scrollWidth - rect.width;
    const maxY = el.scrollHeight - rect.height;
    const beforeX = el.scrollLeft;
    const beforeY = el.scrollTop;
    if (dx !== 0) el.scrollLeft = Math.max(0, Math.min(maxX, beforeX + dx));
    if (dy !== 0) el.scrollTop = Math.max(0, Math.min(maxY, beforeY + dy));

    if (el.scrollLeft === beforeX && el.scrollTop === beforeY) {
      // Hit the scroll boundary — stop until next move event nudges us back.
      this.autoPanRaf = null;
      return;
    }

    this.autoPanRaf = requestAnimationFrame(this.autoPanTick);
  };

  private startAutoPan(): void {
    if (this.autoPanRaf !== null) return;
    this.autoPanRaf = requestAnimationFrame(this.autoPanTick);
  }

  private stopAutoPan(): void {
    if (this.autoPanRaf !== null) {
      cancelAnimationFrame(this.autoPanRaf);
      this.autoPanRaf = null;
    }
    this.currentDragXY = null;
  }

  private cancelMoveDrag(): void {
    if (!this.moveDrag) return;
    if (this.moveDrag.ghost) this.moveDrag.ghost.remove();
    this.doc.removeEventListener('mousemove', this.boundMoveTrack as EventListener);
    this.doc.removeEventListener('mouseup', this.boundMoveEnd as EventListener);
    this.doc.removeEventListener('touchmove', this.boundMoveTrack as EventListener);
    this.doc.removeEventListener('touchend', this.boundMoveEnd as EventListener);
    this.doc.removeEventListener('touchcancel', this.boundMoveEnd as EventListener);
    this.stopAutoPan();
    this.unlockGrid();
    this.movingEventId.set(null);
    this.dragOverHour.set(null);
    this.dragOverDate.set(null);
    this.binArmed.set(false);
    this.moveOverBin = false;
    this.moveDrag = null;
  }

  private pointerOverBin(event: MouseEvent | TouchEvent): boolean {
    let x: number, y: number;
    if ('changedTouches' in event && event.changedTouches.length > 0) {
      x = event.changedTouches[0].clientX;
      y = event.changedTouches[0].clientY;
    } else if ('touches' in event && event.touches.length > 0) {
      x = event.touches[0].clientX;
      y = event.touches[0].clientY;
    } else {
      x = (event as MouseEvent).clientX;
      y = (event as MouseEvent).clientY;
    }
    if (this.currentDragXY && (x === 0 && y === 0)) {
      x = this.currentDragXY.x;
      y = this.currentDragXY.y;
    }
    const el = this.doc.elementFromPoint(x, y);
    return !!el?.closest('[data-bin]');
  }

  private createMoveGhost(evt: PlannedTask): void {
    if (!this.moveDrag) return;
    const source = this.doc.querySelector(`[data-event-id="${evt.id}"]`) as HTMLElement | null;
    if (!source) return;
    const rect = source.getBoundingClientRect();
    const clone = source.cloneNode(true) as HTMLElement;
    clone.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      z-index: 10000;
      opacity: 0.92;
      pointer-events: none;
      transform: scale(1.06);
      transition: none;
      border-radius: 6px;
      box-shadow: 0 16px 32px rgba(94,67,251,0.3);
    `;
    this.doc.body.appendChild(clone);
    this.moveDrag.ghost = clone;
  }

  // ── Resize ──────────────────────────────────────────────────────────
  onResizeStart(event: MouseEvent | TouchEvent, evt: PlannedTask): void {
    event.stopPropagation();
    event.preventDefault();

    // Resize handle also requires the event to be selected first.
    if (this.selectedEventId() !== evt.id) {
      this.zone.run(() => this.selectedEventId.set(evt.id));
      return;
    }

    if (!evt.startTime || !evt.endTime) return;

    this.resizeEvent = evt;
    this.resizeStartY = this.eventY(event);
    this.resizeStartHeight = this.getCellEventHeight(evt.startTime, evt.endTime);
    this.resizingEventId.set(evt.id);
    this.resizingHeight.set(this.resizeStartHeight);
    this.lockGrid();
    this.zone.runOutsideAngular(() => {
      this.doc.addEventListener('mousemove', this.boundResizeMove as EventListener);
      this.doc.addEventListener('mouseup', this.boundResizeEnd as EventListener);
      this.doc.addEventListener('touchmove', this.boundResizeMove as EventListener, { passive: false } as AddEventListenerOptions);
      this.doc.addEventListener('touchend', this.boundResizeEnd as EventListener);
      this.doc.addEventListener('touchcancel', this.boundResizeEnd as EventListener);
    });
  }

  private onResizeMove(event: MouseEvent | TouchEvent): void {
    if (!this.resizeEvent) return;
    event.preventDefault?.();
    const dy = this.eventY(event) - this.resizeStartY;
    const next = Math.max(14, this.resizeStartHeight + dy);
    this.zone.run(() => this.resizingHeight.set(next));
  }

  private onResizeEnd(_event: MouseEvent | TouchEvent): void {
    this.doc.removeEventListener('mousemove', this.boundResizeMove as EventListener);
    this.doc.removeEventListener('mouseup', this.boundResizeEnd as EventListener);
    this.doc.removeEventListener('touchmove', this.boundResizeMove as EventListener);
    this.doc.removeEventListener('touchend', this.boundResizeEnd as EventListener);
    this.doc.removeEventListener('touchcancel', this.boundResizeEnd as EventListener);
    this.unlockGrid();

    this.zone.run(() => {
      if (this.resizeEvent && this.resizeEvent.startTime) {
        const minutes = this.pixelsToMinutes(this.resizingHeight());
        if (minutes > 0) {
          const newEnd = this.addMinutesToTime(this.resizeEvent.startTime, minutes);
          const bar = this.resizeEvent as WeekBar;
          if (bar._segmentId) {
            this.plannedTasks.updateSegment(bar.id, bar._segmentId, { endTime: newEnd })
              .subscribe(() => this.reload());
          } else if (bar.cadence === 'ONCE') {
            this.plannedTasks.update(bar.id, { endTime: newEnd })
              .subscribe(() => this.reload());
          } else {
            const date = bar._dateStr ?? '';
            this.askTimePopupFor(bar, date, bar.startTime!, newEnd);
          }
        }
      }
      this.resizingEventId.set(null);
      this.resizingHeight.set(0);
      this.resizeEvent = null;
    });
  }

  private pixelsToMinutes(px: number): number {
    const minutes = Math.round((px / this.ROW_H) * 60 / 15) * 15;
    return Math.max(15, minutes);
  }

  private diffMinutes(start: string, end: string): number {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return eh * 60 + em - (sh * 60 + sm);
  }

  private addMinutesToTime(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const nh = Math.min(23, Math.floor(total / 60));
    const nm = total % 60;
    return `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}`;
  }

  openEditModal(evt: PlannedTask, dateStr?: string): void {
    this.editingEvent.set(evt);
    this.editDate = dateStr ?? (evt.scheduledDate ?? '');
    this.editStart = evt.startTime ?? '';
    this.editEnd = evt.endTime ?? '';
  }

  closeEditModal(): void {
    this.editingEvent.set(null);
  }

  saveEditModal(): void {
    const evt = this.editingEvent();
    if (!evt) return;
    const [sh, sm] = this.editStart.split(':').map(Number);
    const [eh, em] = this.editEnd.split(':').map(Number);
    if ((eh * 60 + em) - (sh * 60 + sm) <= 0) return;
    const bar = evt as WeekBar;
    const date = bar._dateStr || this.editDate;
    this.editingEvent.set(null);

    if (bar._segmentId) {
      // Segment bars override template times — edit the segment itself.
      this.plannedTasks.updateSegment(bar.id, bar._segmentId, {
        startTime: this.editStart,
        endTime: this.editEnd,
      }).subscribe(() => this.reload());
    } else if (bar.cadence === 'ONCE') {
      this.plannedTasks.update(bar.id, {
        startTime: this.editStart,
        endTime: this.editEnd,
      }).subscribe(() => this.reload());
    } else {
      this.askTimePopupFor(bar, date, this.editStart, this.editEnd);
    }
  }

  // ── Exception popup handlers ─────────────────────────────────────────
  onPopupYes(): void {
    this.popupVisible.set(false);
    if (this.popupOnYes) this.popupOnYes();
    this.popupOnYes = null;
    this.popupOnNo = null;
  }

  onPopupNo(): void {
    this.popupVisible.set(false);
    if (this.popupOnNo) this.popupOnNo();
    this.popupOnYes = null;
    this.popupOnNo = null;
  }

  private openPopup(
    title: string,
    yesLabel: string,
    noLabel: string,
    onYes: () => void,
    onNo: () => void,
  ): void {
    this.popupTitle.set(title);
    this.popupYesLabel.set(yesLabel);
    this.popupNoLabel.set(noLabel);
    this.popupOnYes = onYes;
    this.popupOnNo = onNo;
    this.popupVisible.set(true);
  }

  private eventX(e: MouseEvent | TouchEvent): number {
    return 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
  }

  private eventY(e: MouseEvent | TouchEvent): number {
    return 'touches' in e ? e.touches[0]?.clientY ?? (e as TouchEvent).changedTouches[0]?.clientY ?? 0 : (e as MouseEvent).clientY;
  }

  private getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
