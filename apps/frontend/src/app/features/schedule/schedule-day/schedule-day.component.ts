import { Component, OnInit, OnDestroy, inject, signal, computed, NgZone } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
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

const WEEKDAY_BY_JS_DAY: Weekday[] = [
  'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY',
];

// A rendered bar on the grid. Either the task's template times (segmentId=null)
// or one of its per-date segments.
interface DayBar extends PlannedTask {
  _segmentId: string | null;
}

@Component({
  selector: 'app-schedule-day',
  standalone: true,
  imports: [CommonModule, FormsModule, ExceptionPopupComponent, ScheduleSlotPopupComponent],
  template: `
    <!-- Segmented Control -->
    <div class="px-margin-page mt-stack-md">
      <div class="bg-surface-container p-1 rounded-xl flex items-center">
        <button *ngFor="let v of views"
                (click)="router.navigate([v.route])"
                class="flex-1 py-2 text-label-sm font-semibold transition-all rounded-lg"
                [class]="v.label === 'Day'
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
    <div *ngIf="conflictCount > 0" class="px-margin-page mt-stack-md">
      <div class="rounded-2xl p-3 flex items-center gap-2.5 border"
           style="background:rgba(186,26,26,0.08); border-color:rgba(186,26,26,0.25);">
        <span class="material-symbols-outlined text-[20px] flex-shrink-0" style="color:#ba1a1a;">warning</span>
        <div class="min-w-0 flex-1">
          <p class="text-[13px] font-bold" style="color:#ba1a1a;">
            {{ conflictCount }} time {{ conflictCount === 1 ? 'conflict' : 'conflicts' }} today
          </p>
          <p class="text-[11px] text-on-surface-variant leading-tight">
            Overlapping tasks share their slot side-by-side
          </p>
        </div>
      </div>
    </div>

    <!-- Unplanned Tasks (stays at top because the time grid below has its own scroll context) -->
    <section class="mt-stack-md pt-2 pb-2"
             *ngIf="unscheduledTasks.length > 0">
      <div class="px-margin-page flex justify-between items-end mb-1">
        <h3 class="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-widest">Unplanned</h3>
        <span class="text-label-sm text-primary font-semibold">{{ unscheduledTasks.length }} Remaining</span>
      </div>
      <p class="px-margin-page text-[11px] text-on-surface-variant mb-3 flex items-center gap-1">
        <span class="material-symbols-outlined text-[14px]">south</span>
        Hold &amp; drag a card onto a time slot below
      </p>

      <div class="flex gap-4 overflow-x-auto px-margin-page pb-4" style="-ms-overflow-style:none;scrollbar-width:none;">
        <div *ngFor="let task of unscheduledTasks"
             [attr.data-task-id]="task.id"
             draggable="true"
             (dragstart)="onDragStart($event, task)"
             (dragend)="onDragEnd()"
             (touchstart)="onTouchStart($event, task)"
             class="flex-shrink-0 w-44 p-4 rounded-2xl border-l-4 cursor-grab active:cursor-grabbing select-none touch-none transition-opacity"
             [style.opacity]="draggingTask()?.id === task.id ? '0.35' : '1'"
             [style.borderLeftColor]="highlightedTaskId() === task.id ? '#451de3' : '#ba1a1a'"
             [style.background]="highlightedTaskId() === task.id ? 'rgba(94,67,251,0.06)' : '#ffffff'"
             [style.boxShadow]="highlightedTaskId() === task.id
               ? '0 0 0 2px #451de3, 0 8px 24px rgba(94,67,251,0.18)'
               : '0 8px 24px rgba(94,67,251,0.08)'">

          <!-- Highlighted badge -->
          <div *ngIf="highlightedTaskId() === task.id"
               class="flex items-center gap-1 mb-2">
            <span class="material-symbols-outlined text-primary text-[14px] animate-bounce">arrow_downward</span>
            <span class="text-[10px] font-bold text-primary uppercase tracking-wider">Schedule this</span>
          </div>

          <div class="flex justify-between items-start mb-2">
            <span class="material-symbols-outlined text-xl"
                  [style.color]="highlightedTaskId() === task.id ? '#451de3' : '#ba1a1a'">
              {{ getTaskIcon(task) }}
            </span>
            <div class="w-2 h-2 rounded-full animate-pulse"
                 [style.background]="highlightedTaskId() === task.id ? '#451de3' : '#ba1a1a'">
            </div>
          </div>
          <p class="font-semibold text-[15px] text-on-surface mb-1 truncate">{{ task.title }}</p>
          <div *ngIf="remainingMinutes(task) > 0"
               class="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
            {{ remainingMinutes(task) }} min remaining
          </div>
          <div class="flex items-center justify-between text-[11px] text-on-surface-variant">
            <span class="text-outline">{{ task.cadence }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Remembered pattern preference -->
    <div *ngIf="timePrefChoice() as pref" class="px-margin-page mt-2 flex justify-end">
      <button type="button"
              (click)="clearTimePref()"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
              style="background:rgba(94,67,251,0.10); color:#5e43fb;"
              data-testid="clear-time-pref">
        {{ pref === 'yes' ? 'Auto: apply to every weekday' : 'Auto: just this date' }}
        <span class="material-symbols-outlined text-[14px]">close</span>
      </button>
    </div>

    <!-- Any-time tasks (no time slot required — doable whenever today) -->
    <section *ngIf="anytimeTasks.length > 0" class="px-margin-page mt-stack-md" data-testid="anytime-strip">
      <p class="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-widest mb-2">Any time today</p>
      <div class="flex gap-2 overflow-x-auto pb-1" style="-ms-overflow-style:none;scrollbar-width:none;">
        <div *ngFor="let t of anytimeTasks"
             class="flex-shrink-0 flex items-center gap-2 pl-3 pr-2 py-2 rounded-full border"
             [style.background]="t.completedToday ? 'rgba(46,125,50,0.08)' : '#ffffff'"
             [style.borderColor]="t.completedToday ? 'rgba(46,125,50,0.35)' : 'rgba(120,117,136,0.25)'"
             [attr.data-testid]="'anytime-' + t.id">
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" [style.background]="t.color"></span>
          <span class="text-[13px] font-semibold text-on-surface whitespace-nowrap"
                [class.line-through]="t.completedToday">{{ t.title }}</span>
          <span *ngIf="targetCountOf(t) > 1"
                class="text-[11px] font-bold" style="color:#5e43fb;">
            {{ t.currentCount }}/{{ targetCountOf(t) }}
          </span>
          <button *ngIf="!t.completedToday"
                  type="button"
                  (click)="incrementAnytime(t.id)"
                  class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style="background:rgba(94,67,251,0.12); color:#5e43fb;"
                  [attr.data-testid]="'anytime-done-' + t.id">
            <span class="material-symbols-outlined text-[15px]">{{ targetCountOf(t) > 1 ? 'add' : 'check' }}</span>
          </button>
          <span *ngIf="t.completedToday" class="material-symbols-outlined text-[16px]" style="color:#2e7d32;">check_circle</span>
        </div>
      </div>
    </section>

    <!-- Time Grid (own scroll context so the unplanned queue above stays visible) -->
    <section class="px-margin-page mt-stack-md relative">
      <div class="overflow-y-auto"
           style="-ms-overflow-style:none;scrollbar-width:none; max-height:calc(100vh - 360px); min-height:380px; overscroll-behavior: contain;"
           (click)="onGridClick($event)">
        <div *ngFor="let hour of hours"
             [attr.data-hour]="hour"
             class="flex border-t border-slate-100 relative"
             style="height:80px;"
             (dragover)="onDragOver($event, hour)"
             (dragleave)="onDragLeave($event)"
             (drop)="onDrop($event, hour)">

          <!-- Hour label -->
          <span class="w-12 flex-shrink-0 text-[10px] font-medium text-slate-400 pt-1">
            {{ formatHour(hour) }}
          </span>

          <!-- Slot area -->
          <div class="flex-1 relative">

            <!-- Drop highlight -->
            <div *ngIf="dragOverHour() === hour"
                 class="absolute inset-1 rounded-xl flex items-center justify-center gap-2 pointer-events-none"
                 style="border:2px dashed #451de3; background:rgba(94,67,251,0.07); z-index:5;">
              <span class="material-symbols-outlined text-primary text-base">add_circle</span>
              <span class="text-xs font-bold text-primary">Drop here</span>
            </div>

            <!-- Scheduled events -->
            <div *ngFor="let evt of getEventsForHour(hour); trackBy: trackEvent"
                 [attr.data-event-id]="evt.id"
                 class="absolute rounded-lg border-l-4 select-none cursor-pointer overflow-hidden"
                 style="touch-action: none;"
                 [style.opacity]="movingEventId() === evt.id ? '0.35' : '1'"
                 [style.zIndex]="selectedEventId() === evt.id ? 25 : 10"
                 [ngStyle]="getEventBoxStyle(evt)"
                 [style.background]="getEventBg()"
                 [style.borderLeftColor]="getEventBorder(evt.color)"
                 [style.boxShadow]="selectedEventId() === evt.id
                   ? '0 0 0 2px ' + getEventBorder(evt.color) + ', 0 8px 24px rgba(94,67,251,0.18)'
                   : '0 2px 8px rgba(0,0,0,0.06)'"
                 (mousedown)="onEventDown($event, evt)"
                 (touchstart)="onEventDown($event, evt)">

              <!-- Content row (icons, title, time) — pb-4 reserves space for the always-visible handle -->
              <div class="flex items-center gap-2 px-3 h-full pb-4">
                <span class="material-symbols-outlined text-[16px] flex-shrink-0 opacity-70 -ml-1.5 relative z-10"
                      [style.color]="getEventBorder(evt.color)"
                      [style.cursor]="selectedEventId() === evt.id ? 'grab' : 'pointer'"
                      style="touch-action: none;">
                  drag_indicator
                </span>
                <span class="material-symbols-outlined text-sm flex-shrink-0"
                      [style.color]="getEventBorder(evt.color)">
                  task_alt
                </span>
                <span class="text-sm font-semibold truncate flex-1"
                      [style.color]="getEventBorder(evt.color)">
                  {{ evt.title }}
                </span>
                <button type="button"
                        class="text-[10px] font-medium flex-shrink-0 rounded-md border-0 px-2 py-1 transition-colors"
                        data-time-label
                        [style.color]="getEventBorder(evt.color)"
                        [style.background]="selectedEventId() === evt.id ? 'rgba(94,67,251,0.22)' : 'rgba(94,67,251,0.08)'"
                        style="cursor: pointer;"
                        (mousedown)="onTimeLabelDown($event, evt)"
                        (touchstart)="onTimeLabelDown($event, evt)"
                        (click)="onTimeLabelClick($event, evt)">
                  {{ (evt.startTime || '') + '–' + (evt.endTime || '') }}
                </button>
              </div>

              <!-- Resize handle row — always visible; tap auto-selects the card & starts the drag -->
              <div class="absolute left-0 right-0 bottom-0 h-4 flex items-center justify-center cursor-ns-resize"
                   data-resize-handle
                   [style.background]="selectedEventId() === evt.id ? 'rgba(94,67,251,0.28)' : 'rgba(94,67,251,0.10)'"
                   style="touch-action: none;"
                   (pointerdown)="onResizeStart($event, evt)">
                <div class="h-1 rounded-full pointer-events-none transition-all"
                     [style.width.px]="selectedEventId() === evt.id ? 64 : 40"
                     [style.background]="getEventBorder(evt.color)"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Progress Indicator -->
      <div class="fixed right-4 top-1/2 -translate-y-1/2 z-20">
        <div class="bg-white/90 backdrop-blur-md p-3 rounded-2xl flex flex-col items-center gap-1"
             style="box-shadow:0 8px 32px rgba(0,0,0,0.1); border:1px solid #f1f5f9;">
          <div class="w-12 h-12 rounded-full flex items-center justify-center relative"
               style="border:4px solid #f1f5f9;">
            <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" fill="none" r="20"
                      stroke="#5E43FB"
                      stroke-dasharray="125"
                      [attr.stroke-dashoffset]="strokeOffset"
                      stroke-linecap="round" stroke-width="4">
              </circle>
            </svg>
            <span class="text-[10px] font-bold text-primary">{{ progressPercent }}%</span>
          </div>
          <span class="text-[9px] font-bold text-on-surface-variant uppercase tracking-wide">Planned</span>
        </div>
      </div>
    </section>

    <!-- FAB -->
    <button type="button"
            (click)="openSlotPopup()"
            class="fixed bottom-28 right-6 w-14 h-14 rounded-full flex items-center justify-center text-white active:scale-95 transition-all z-40"
            style="background:linear-gradient(135deg,#451de3,#00c1fd); box-shadow:0 8px 32px rgba(69,29,227,0.3);"
            data-testid="schedule-fab">
      <span class="material-symbols-outlined text-2xl">add</span>
    </button>

    <!-- Schedule a slot popup -->
    <app-schedule-slot-popup
      *ngIf="slotPopupOpen()"
      [tasks]="allTasks()"
      [defaultDate]="dateStr"
      [error]="slotPopupError()"
      [busy]="slotPopupBusy()"
      (close)="closeSlotPopup()"
      (confirm)="onSlotConfirm($event)"
      (newTask)="goToNewTask()">
    </app-schedule-slot-popup>

    <!-- Edit time modal (long-press) -->
    <div *ngIf="editingEvent()"
         class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
         (click)="closeEditModal()">
      <div class="absolute inset-0 bg-on-surface/30 backdrop-blur-sm"></div>
      <div class="relative bg-surface-container-lowest rounded-t-[28px] sm:rounded-[28px] w-full sm:max-w-md p-6 pb-8"
           (click)="$event.stopPropagation()">
        <div class="w-12 h-1 rounded-full bg-outline-variant mx-auto mb-5 sm:hidden"></div>
        <h3 class="font-bold text-[20px] text-on-surface mb-1 font-manrope">Edit schedule</h3>
        <p class="text-[13px] text-on-surface-variant mb-5 truncate">{{ editingEvent()?.title }}</p>

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

        <p *ngIf="editDeltaLabel()" class="text-[12px] text-primary mb-4 flex items-center gap-1">
          <span class="material-symbols-outlined text-[14px]">auto_awesome</span>
          {{ editDeltaLabel() }}
        </p>

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

    <!-- Skip / exception popup -->
    <app-exception-popup
      *ngIf="popupVisible()"
      [title]="popupTitle()"
      [yesLabel]="popupYesLabel()"
      [noLabel]="popupNoLabel()"
      [showRemember]="popupShowRemember()"
      (yes)="onPopupYes($event)"
      (no)="onPopupNo($event)">
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
export class ScheduleDayComponent implements OnInit, OnDestroy {
  router = inject(Router);
  private route = inject(ActivatedRoute);
  private plannedTasks = inject(PlannedTaskService);
  private freqValidator = inject(FrequencyValidatorService);
  private zone = inject(NgZone);
  private doc = inject(DOCUMENT);

  currentDate = new Date();
  hours = HOURS;
  draggingTask = signal<PlannedTask | null>(null);
  dragOverHour = signal<number | null>(null);

  // Local signal holding tasks for the displayed day
  tasksForDay = signal<PlannedTask[]>([]);

  // Resize state — cancel fn is set while a pointer-based resize is in flight
  private _cancelResize: (() => void) | null = null;

  // Pointer-drag (click-or-move) state
  private moveDrag: {
    evt: PlannedTask;
    startX: number; startY: number;
    isDragging: boolean;
    hoverHour: number | null;
    ghost: HTMLElement | null;
  } | null = null;
  movingEventId = signal<string | null>(null);
  selectedEventId = signal<string | null>(null);
  binArmed = signal(false);
  private moveOverBin = false;

  slotPopupOpen = signal(false);
  slotPopupError = signal<string | null>(null);
  slotPopupBusy = signal(false);
  allTasks = signal<PlannedTask[]>([]);
  private readonly boundMoveTrack = (e: MouseEvent | TouchEvent) => this.onMoveTrack(e);
  private readonly boundMoveEnd = (e: MouseEvent | TouchEvent) => this.onMoveEnd(e);

  // Edit modal state
  editingEvent = signal<PlannedTask | null>(null);
  editStart = '';
  editEnd = '';

  // Exception/skip popup state
  popupVisible = signal(false);
  popupTitle = signal('');
  popupYesLabel = signal('Yes, every week');
  popupNoLabel = signal('No, just this date');
  popupShowRemember = signal(false);
  private popupOnYes: ((remember: boolean) => void) | null = null;
  private popupOnNo: ((remember: boolean) => void) | null = null;
  // 'yes' = always save as weekly pattern, 'no' = always just this date. Reset on leaving the page.
  timePrefChoice = signal<'yes' | 'no' | null>(null);

  frequencyWarnings = computed<FrequencyWarning[]>(() => {
    const list = this.tasksForDay();
    return [
      ...this.freqValidator.validateForWeek(list, this.currentDate),
      ...this.freqValidator.validateForMonth(list, this.currentDate),
    ];
  });

  editDeltaLabel = computed(() => {
    const evt = this.editingEvent();
    if (!evt || !evt.startTime || !evt.endTime) return '';
    const oldDur = this.diffMinutes(evt.startTime, evt.endTime);
    const newDur = this.diffMinutes(this.editStart, this.editEnd);
    if (newDur === oldDur || newDur <= 0) return '';
    const delta = oldDur - newDur;
    return delta > 0
      ? `${delta}m freed up`
      : `${-delta}m added`;
  });

  views = [
    { label: 'Day', route: '/schedule' },
    { label: 'Week', route: '/schedule/week' },
    { label: 'Month', route: '/schedule/month' },
  ];

  highlightedTaskId = signal<string | null>(null);

  // Touch drag state
  private touchClone: HTMLElement | null = null;
  private touchDragOverHour: number | null = null;
  private readonly boundTouchMove = (e: TouchEvent) => this.onTouchMove(e);
  private readonly boundTouchEnd  = (e: TouchEvent) => this.onTouchEnd(e);

  get dateStr(): string {
    const d = this.currentDate;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  get unscheduledTasks(): PlannedTask[] {
    const id = this.highlightedTaskId();
    const all = this.tasksForDay().filter(t => {
      if (!t.needsTimeSlot) return false;
      const scheduled = this.scheduledMinutesOnDate(t);
      if (scheduled === 0) return true;
      return (t.minTimeMinutes ?? 0) > scheduled;
    });
    if (!id) return all;
    return [...all.filter(t => t.id === id), ...all.filter(t => t.id !== id)];
  }

  get anytimeTasks(): PlannedTask[] {
    return this.tasksForDay().filter(
      t => !t.needsTimeSlot && (t.segmentsForDate?.length ?? 0) === 0 && (t.patternForDate?.length ?? 0) === 0,
    );
  }

  targetCountOf(t: PlannedTask): number {
    return Math.max(1, t.minCount ?? 1);
  }

  incrementAnytime(id: string): void {
    this.plannedTasks.increment(id, 1, this.dateStr).subscribe(() => this.reload());
  }

  get todayEvents(): DayBar[] {
    const out: DayBar[] = [];
    for (const t of this.tasksForDay()) {
      const segs = t.segmentsForDate ?? [];
      const pattern = t.patternForDate ?? [];
      if (segs.length > 0) {
        for (const s of segs) {
          out.push({ ...t, _segmentId: s.id, startTime: s.startTime, endTime: s.endTime });
        }
      } else if (pattern.length > 0) {
        for (const p of pattern) {
          out.push({ ...t, _segmentId: null, startTime: p.startTime, endTime: p.endTime });
        }
      } else if (t.startTime && t.endTime) {
        out.push({ ...t, _segmentId: null });
      }
    }
    return out;
  }

  scheduledMinutesOnDate(t: PlannedTask): number {
    const segs = t.segmentsForDate ?? [];
    if (segs.length > 0) {
      return segs.reduce((sum, s) => sum + this.diffMinutes(s.startTime, s.endTime), 0);
    }
    const pat = t.patternForDate ?? [];
    if (pat.length > 0) {
      return pat.reduce((sum, p) => sum + this.diffMinutes(p.startTime, p.endTime), 0);
    }
    if (t.startTime && t.endTime) return this.diffMinutes(t.startTime, t.endTime);
    return 0;
  }

  remainingMinutes(t: PlannedTask): number {
    return Math.max(0, (t.minTimeMinutes ?? 0) - this.scheduledMinutesOnDate(t));
  }

  get progressPercent(): number {
    const total = this.todayEvents.length + this.unscheduledTasks.length;
    return total === 0 ? 0 : Math.round((this.todayEvents.length / total) * 100);
  }

  get strokeOffset(): number {
    return 2 * Math.PI * 20 * (1 - this.progressPercent / 100);
  }

  ngOnInit(): void {
    const snap = this.route.snapshot.queryParamMap;

    const dateParam = snap.get('date');
    if (dateParam) {
      const parsed = new Date(dateParam + 'T00:00:00');
      if (!isNaN(parsed.getTime())) this.currentDate = parsed;
    }

    const taskId = snap.get('taskId');
    if (taskId) this.highlightedTaskId.set(taskId);

    this.reload();
  }

  ngOnDestroy(): void {
    this.cleanupTouchListeners();
    this.cancelMoveDrag();
    this._cancelResize?.();
  }

  private reload(): void {
    this.plannedTasks.loadForDate(this.dateStr).subscribe(list => this.tasksForDay.set(list));
  }

  formatHour(h: number): string {
    return `${h.toString().padStart(2, '0')}:00`;
  }

  getEventsForHour(hour: number): PlannedTask[] {
    return this.todayEvents.filter(e => e.startTime && parseInt(e.startTime.split(':')[0], 10) === hour);
  }

  // Stable identity per bar: segment ID if this is a segment, else task ID.
  // Without this, *ngFor recreates DOM nodes on every CD cycle (no object identity),
  // which makes any closure reference to the card element go stale immediately.
  trackEvent(_: number, evt: PlannedTask): string {
    return (evt as DayBar)._segmentId ?? evt.id;
  }

  // ── Overlap layout ──────────────────────────────────────────────────
  private toMin(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  // Unique key per bar: segment ID when it is a segment, task ID for template-times bars.
  // Using task ID alone would let two segments of the same task collide in the layout Map,
  // causing one segment's column/count to overwrite the other's.
  private barKey(evt: PlannedTask): string {
    return (evt as DayBar)._segmentId ?? evt.id;
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
      cluster.forEach((evt, i) => result.set(this.barKey(evt), { col: assigns[i], count }));
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

  get dayLayout(): Map<string, { col: number; count: number }> {
    return this.computeLayout(this.todayEvents);
  }

  get conflictCount(): number {
    let n = 0;
    this.dayLayout.forEach(l => { if (l.count > 1) n++; });
    return n;
  }

  getEventBoxStyle(evt: PlannedTask): Record<string, string> {
    const layout = this.dayLayout.get(this.barKey(evt));
    // Position within the hour row based on the minute offset (e.g. 14:30 → top 40px).
    const startMin = parseInt(evt.startTime!.split(':')[1], 10);
    const topPx = (startMin / 60) * 80 + 1;
    const style: Record<string, string> = {
      top: `${topPx}px`,
      height: `${this.getEventHeight(evt.startTime!, evt.endTime!)}px`,
    };
    if (!layout || layout.count <= 1) {
      style['left'] = '0';
      style['right'] = '8px';
      style['width'] = 'auto';
      return style;
    }
    const widthPct = 100 / layout.count;
    style['left'] = `${layout.col * widthPct}%`;
    style['width'] = `calc(${widthPct}% - 4px)`;
    style['right'] = 'auto';
    return style;
  }

  getEventHeight(startTime: string, endTime: string): number {
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    // -2 instead of -4: 1px gap at top (from topPx +1) + 1px gap at bottom.
    // A 60-min card is now 78px in an 80px row, visually filling the slot.
    return Math.max(32, ((toMin(endTime) - toMin(startTime)) / 60) * 80 - 2);
  }

  // All planned tasks are "task" type — use task styling for all
  getEventBg(): string {
    return 'rgba(228,223,255,0.4)';
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

  // ── Desktop HTML5 drag ──────────────────────────────────────────────
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
  }

  onDragOver(event: DragEvent, hour: number): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (this.dragOverHour() !== hour) this.dragOverHour.set(hour);
  }

  onDragLeave(event: DragEvent): void {
    const rel = event.relatedTarget as HTMLElement | null;
    if (!rel || !(event.currentTarget as HTMLElement).contains(rel)) {
      this.dragOverHour.set(null);
    }
  }

  onDrop(event: DragEvent, hour: number): void {
    event.preventDefault();
    const task = this.draggingTask();
    if (task) this.scheduleAt(task, hour);
    this.draggingTask.set(null);
    this.dragOverHour.set(null);
  }

  // ── Mobile touch drag ───────────────────────────────────────────────
  onTouchStart(event: TouchEvent, task: PlannedTask): void {
    this.draggingTask.set(task);

    const src = event.currentTarget as HTMLElement;
    const rect = src.getBoundingClientRect();
    const clone = src.cloneNode(true) as HTMLElement;

    clone.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      z-index: 9999;
      opacity: 0.85;
      pointer-events: none;
      transform: scale(1.06) rotate(2deg);
      transform-origin: center;
      transition: none;
      border-radius: 16px;
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

      // find element under finger
      this.touchClone.style.visibility = 'hidden';
      const el = this.doc.elementFromPoint(touch.clientX, touch.clientY);
      this.touchClone.style.visibility = 'visible';

      const slot = el?.closest('[data-hour]');
      const hour = slot ? parseInt(slot.getAttribute('data-hour')!, 10) : null;

      if (hour !== this.touchDragOverHour) {
        this.touchDragOverHour = hour;
        this.zone.run(() => this.dragOverHour.set(hour));
      }
    }
  }

  private onTouchEnd(_event: TouchEvent): void {
    this.cleanupTouchListeners();

    const task = this.draggingTask();
    const hour = this.touchDragOverHour;

    if (this.touchClone) {
      this.doc.body.removeChild(this.touchClone);
      this.touchClone = null;
    }

    this.zone.run(() => {
      if (task && hour !== null) this.scheduleAt(task, hour);
      this.draggingTask.set(null);
      this.dragOverHour.set(null);
    });
    this.touchDragOverHour = null;
  }

  private cleanupTouchListeners(): void {
    this.doc.removeEventListener('touchmove', this.boundTouchMove);
    this.doc.removeEventListener('touchend',  this.boundTouchEnd);
  }

  // ── Shared schedule logic ────────────────────────────────────────────
  private scheduleAt(task: PlannedTask, hour: number): void {
    const date = this.dateStr;
    const start = `${hour.toString().padStart(2, '0')}:00`;
    // Duration default: remainder if it's set, else minTimeMinutes if set, else 15 min.
    const remaining = this.remainingMinutes(task);
    const dur = remaining > 0 ? remaining : (task.minTimeMinutes ?? 15);
    const end = this.addMinutesToTime(start, dur);

    // Day-independent scheduling: only THIS date changes. Windows the date inherits
    // (weekday pattern or template times) are materialized as segments first.
    const segs = task.segmentsForDate ?? [];
    const inherited = segs.length > 0 ? [] : this.windowsOf(task);
    const ops: (() => Observable<unknown>)[] = inherited.map(w =>
      () => this.plannedTasks.createSegment(task.id, date, w.startTime, w.endTime));
    ops.push(() => this.plannedTasks.createSegment(task.id, date, start, end));
    this.chainOps(ops, () => {
      this.reload();
      this.afterLayoutChange(task.id, date);
    });
  }

  // ── Weekly pattern: day-independent edits + "apply to every X" ───────
  private chainOps(ops: (() => Observable<unknown>)[], done: () => void): void {
    if (ops.length === 0) { done(); return; }
    const head = ops.shift()!;
    head().subscribe({
      next: () => this.chainOps(ops, done),
      error: () => this.chainOps(ops, done),
    });
  }

  private windowsOf(entry: PlannedTask): { startTime: string; endTime: string }[] {
    const segs = entry.segmentsForDate ?? [];
    if (segs.length) return segs.map(s => ({ startTime: s.startTime, endTime: s.endTime }));
    const pat = entry.patternForDate ?? [];
    if (pat.length) return pat.map(p => ({ startTime: p.startTime, endTime: p.endTime }));
    if (entry.startTime && entry.endTime) return [{ startTime: entry.startTime, endTime: entry.endTime }];
    return [];
  }

  private weekdayNameOf(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  }

  private afterLayoutChange(taskId: string, dateStr: string): void {
    if (this.timePrefChoice() === 'no') return;
    if (this.timePrefChoice() === 'yes') { this.savePattern(taskId, dateStr); return; }
    const day = this.weekdayNameOf(dateStr);
    this.openPopup(
      `Apply ${day}'s slots to every ${day}?`,
      `Yes, every ${day}`,
      'No, just this date',
      remember => {
        if (remember) this.timePrefChoice.set('yes');
        this.savePattern(taskId, dateStr);
      },
      remember => {
        if (remember) this.timePrefChoice.set('no');
      },
      true,
    );
  }

  private savePattern(taskId: string, dateStr: string): void {
    this.plannedTasks.loadForDate(dateStr).subscribe(list => {
      const t = list.find(x => x.id === taskId);
      if (!t) return;
      const slots = (t.segmentsForDate ?? [])
        .map(s => ({ startTime: s.startTime, endTime: s.endTime }))
        .sort((a, b) => (a.startTime < b.startTime ? -1 : 1));
      const weekday = WEEKDAY_BY_JS_DAY[new Date(dateStr + 'T00:00:00').getDay()];
      this.plannedTasks.setWeekPattern(taskId, weekday, slots, dateStr)
        .subscribe(() => this.reload());
    });
  }

  clearTimePref(): void {
    this.timePrefChoice.set(null);
  }

  private applyEditToNullBar(bar: DayBar, dateStr: string,
                             originalStart: string, newStart: string, newEnd: string): void {
    const others = this.windowsOf(bar).filter(w => w.startTime !== originalStart);
    const ops: (() => Observable<unknown>)[] = others.map(w =>
      () => this.plannedTasks.createSegment(bar.id, dateStr, w.startTime, w.endTime));
    ops.push(() => this.plannedTasks.createSegment(bar.id, dateStr, newStart, newEnd));
    this.chainOps(ops, () => {
      this.reload();
      this.afterLayoutChange(bar.id, dateStr);
    });
  }

  // ── Resize handle — pointer-event based for mouse + touch in one path ──
  onResizeStart(event: PointerEvent, evt: PlannedTask): void {
    event.stopPropagation();
    event.preventDefault();

    const bar = evt as DayBar;
    if (!bar.startTime || !bar.endTime) return;

    this.selectedEventId.set(evt.id);
    this._cancelResize?.();

    const handle = event.currentTarget as HTMLElement;
    const card = handle.closest('[data-event-id]') as HTMLElement | null;
    if (!card) return;

    const pointerId = event.pointerId;
    const startY    = event.clientY;
    const startH    = this.getEventHeight(bar.startTime, bar.endTime);
    let   currentH  = startH;
    const startText = `${bar.startTime}–${bar.endTime}`;

    // Find Angular's text node inside the time button BEFORE any drag.
    // We must mutate .data on the existing node rather than using .textContent,
    // because .textContent replaces all child nodes — detaching the node Angular
    // holds a reference to and preventing it from updating the label after reload().
    const timeBtn = card.querySelector('[data-time-label]') as HTMLElement | null;
    let timeTn: Text | null = null;
    if (timeBtn) {
      for (let i = 0; i < timeBtn.childNodes.length; i++) {
        const n = timeBtn.childNodes[i];
        if (n.nodeType === Node.TEXT_NODE) { timeTn = n as Text; break; }
      }
    }
    const setLabel = (text: string) => { if (timeTn) timeTn.data = text; };

    // Use document-level listeners so we receive events even when the pointer
    // leaves the handle or the card. setPointerCapture alone can be unreliable
    // on mobile Safari; document listeners are always reliable.
    //
    // trackBy: trackEvent on *ngFor guarantees Angular reuses this DOM node
    // across CD cycles, so the `card` closure reference stays valid throughout.
    const onMove = (e: Event) => {
      const pe = e as PointerEvent;
      if (pe.pointerId !== pointerId) return;
      pe.preventDefault();
      const h = Math.max(20, startH + (pe.clientY - startY));
      currentH = h;
      card.style.height = `${h}px`;
      const mins = Math.max(5, Math.round(((h / 80) * 60) / 5) * 5);
      setLabel(`${bar.startTime}–${this.addMinutesToTime(bar.startTime!, mins)}`);
    };

    const finish = (commit: boolean) => {
      this.doc.removeEventListener('pointermove', onMove);
      this.doc.removeEventListener('pointerup', onUp);
      this.doc.removeEventListener('pointercancel', onCancel);
      this._cancelResize = null;

      card.style.height = '';
      // On cancel restore the original label via the same text-node mutation.
      // On commit we let reload() → Angular CD update it via the template binding.
      if (!commit || Math.abs(currentH - startH) <= 4) {
        setLabel(startText);
        return;
      }

      this.zone.run(() => {
        const newEnd = this.addMinutesToTime(bar.startTime!, this.pixelsToMinutes(currentH));
        if (bar._segmentId) {
          this.plannedTasks.updateSegment(bar.id, bar._segmentId, { endTime: newEnd })
            .subscribe(() => {
              this.reload();
              this.afterLayoutChange(bar.id, this.dateStr);
            });
        } else if (bar.cadence === 'ONCE') {
          this.plannedTasks.update(bar.id, { endTime: newEnd })
            .subscribe(() => this.reload());
        } else {
          this.applyEditToNullBar(bar, this.dateStr, bar.startTime!, bar.startTime!, newEnd);
        }
      });
    };

    const onUp    = (e: Event) => { if ((e as PointerEvent).pointerId === pointerId) finish(true); };
    const onCancel = (e: Event) => { if ((e as PointerEvent).pointerId === pointerId) finish(false); };

    // Add listeners on document OUTSIDE Angular's zone so zone.js never triggers
    // change detection on pointermove — otherwise Angular re-runs [ngStyle] and
    // overwrites card.style.height every frame, freezing the card.
    this.zone.runOutsideAngular(() => {
      this.doc.addEventListener('pointermove', onMove, { passive: false });
      this.doc.addEventListener('pointerup', onUp);
      this.doc.addEventListener('pointercancel', onCancel);
    });

    this._cancelResize = () => finish(false);
  }

  // ── Pointer interaction: tap → select, drag (when selected) → move ─
  onEventDown(event: MouseEvent | TouchEvent, evt: PlannedTask): void {
    const target = event.target as HTMLElement;
    if (target.closest('[data-resize-handle]')) return;
    if (target.closest('[data-time-label]')) return;
    if (this.moveDrag) this.cancelMoveDrag();

    event.stopPropagation();
    if ('touches' in event) event.preventDefault();

    // First tap selects the card without starting a drag.
    if (this.selectedEventId() !== evt.id) {
      this.selectedEventId.set(evt.id);
      return;
    }

    this.moveDrag = {
      evt,
      startX: this.eventX(event),
      startY: this.eventY(event),
      isDragging: false,
      hoverHour: null,
      ghost: null,
    };

    this.doc.addEventListener('mousemove', this.boundMoveTrack as EventListener);
    this.doc.addEventListener('mouseup', this.boundMoveEnd as EventListener);
    this.doc.addEventListener('touchmove', this.boundMoveTrack as EventListener, { passive: false } as AddEventListenerOptions);
    this.doc.addEventListener('touchend', this.boundMoveEnd as EventListener);
    this.doc.addEventListener('touchcancel', this.boundMoveEnd as EventListener);
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

    if (this.moveDrag.ghost) {
      const w = this.moveDrag.ghost.offsetWidth;
      this.moveDrag.ghost.style.left = `${x - w / 2}px`;
      this.moveDrag.ghost.style.top = `${y - 24}px`;

      this.moveDrag.ghost.style.visibility = 'hidden';
      const el = this.doc.elementFromPoint(x, y);
      this.moveDrag.ghost.style.visibility = 'visible';

      const overBin = !!el?.closest('[data-bin]');
      if (overBin !== this.moveOverBin) {
        this.moveOverBin = overBin;
        this.zone.run(() => this.binArmed.set(overBin));
      }

      const slot = el?.closest('[data-hour]');
      const hour = slot ? parseInt(slot.getAttribute('data-hour')!, 10) : null;
      if (hour !== this.moveDrag.hoverHour) {
        this.moveDrag.hoverHour = hour;
        this.zone.run(() => this.dragOverHour.set(hour));
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

    if (drag.ghost) {
      drag.ghost.remove();
      drag.ghost = null;
    }

    const droppedOnBin = drag.isDragging && this.pointerOverBin(event);
    this.moveOverBin = false;

    this.zone.run(() => {
      if (droppedOnBin) {
        this.deleteBar(drag.evt as DayBar);
      } else if (drag.isDragging) {
        if (drag.hoverHour !== null && drag.evt.startTime && drag.evt.endTime) {
          const duration = this.diffMinutes(drag.evt.startTime, drag.evt.endTime);
          const newStart = `${drag.hoverHour.toString().padStart(2, '0')}:00`;
          const newEnd = this.addMinutesToTime(newStart, duration);
          const bar = drag.evt as DayBar;
          if (bar._segmentId) {
            this.plannedTasks.updateSegment(bar.id, bar._segmentId, { startTime: newStart, endTime: newEnd })
              .subscribe(() => {
                this.reload();
                this.afterLayoutChange(bar.id, this.dateStr);
              });
          } else if (bar.cadence === 'ONCE') {
            this.plannedTasks.update(bar.id, { startTime: newStart, endTime: newEnd })
              .subscribe(() => this.reload());
          } else {
            this.applyEditToNullBar(bar, this.dateStr, bar.startTime!, newStart, newEnd);
          }
        }
      }
      // No movement → keep selection; do not open the modal (use time-label tap for that).
      this.movingEventId.set(null);
      this.dragOverHour.set(null);
      this.binArmed.set(false);
    });

    this.moveDrag = null;
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
            this.afterLayoutChange(e.taskId, e.date);
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
    const el = this.doc.elementFromPoint(x, y);
    return !!el?.closest('[data-bin]');
  }

  private deleteBar(bar: DayBar): void {
    if (bar.cadence === 'ONCE') {
      this.plannedTasks.remove(bar.id).subscribe(() => this.reload());
      return;
    }
    this.removeOccurrenceForDate(bar, this.dateStr);
  }

  private removeOccurrenceForDate(bar: DayBar, date: string): void {
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

  private cancelMoveDrag(): void {
    if (!this.moveDrag) return;
    if (this.moveDrag.ghost) this.moveDrag.ghost.remove();
    this.doc.removeEventListener('mousemove', this.boundMoveTrack as EventListener);
    this.doc.removeEventListener('mouseup', this.boundMoveEnd as EventListener);
    this.doc.removeEventListener('touchmove', this.boundMoveTrack as EventListener);
    this.doc.removeEventListener('touchend', this.boundMoveEnd as EventListener);
    this.doc.removeEventListener('touchcancel', this.boundMoveEnd as EventListener);
    this.movingEventId.set(null);
    this.dragOverHour.set(null);
    this.binArmed.set(false);
    this.moveOverBin = false;
    this.moveDrag = null;
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
      transform: scale(1.04);
      transition: none;
      border-radius: 8px;
      box-shadow: 0 16px 32px rgba(94,67,251,0.3);
    `;
    this.doc.body.appendChild(clone);
    this.moveDrag.ghost = clone;
  }

  openEditModal(evt: PlannedTask): void {
    this.editingEvent.set(evt);
    this.editStart = evt.startTime || '';
    this.editEnd = evt.endTime || '';
  }

  onTimeLabelDown(event: MouseEvent | TouchEvent, _evt: PlannedTask): void {
    // Swallow the pointer-down so the card's drag-tracking handler never fires
    // on the time pill. The click event still propagates and runs onTimeLabelClick.
    event.stopPropagation();
  }

  onTimeLabelClick(event: Event, evt: PlannedTask): void {
    event.stopPropagation();
    this.selectedEventId.set(evt.id);
    this.openEditModal(evt);
  }

  onGridClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('[data-event-id]')) return;
    this.selectedEventId.set(null);
  }

  closeEditModal(): void {
    this.editingEvent.set(null);
  }

  saveEditModal(): void {
    const evt = this.editingEvent();
    if (!evt) return;
    if (this.diffMinutes(this.editStart, this.editEnd) <= 0) return;
    const bar = evt as DayBar;
    this.editingEvent.set(null);

    if (bar._segmentId) {
      // Segment bars override template times — edit the segment itself.
      this.plannedTasks.updateSegment(bar.id, bar._segmentId, {
        startTime: this.editStart,
        endTime: this.editEnd,
      }).subscribe(() => {
        this.reload();
        this.afterLayoutChange(bar.id, this.dateStr);
      });
    } else if (bar.cadence === 'ONCE') {
      this.plannedTasks.update(bar.id, {
        startTime: this.editStart,
        endTime: this.editEnd,
      }).subscribe(() => this.reload());
    } else {
      this.applyEditToNullBar(bar, this.dateStr, bar.startTime ?? this.editStart, this.editStart, this.editEnd);
    }
  }

  // ── Skip popup handlers ──────────────────────────────────────────────
  onPopupYes(remember = false): void {
    this.popupVisible.set(false);
    if (this.popupOnYes) this.popupOnYes(remember);
    this.popupOnYes = null;
    this.popupOnNo = null;
  }

  onPopupNo(remember = false): void {
    this.popupVisible.set(false);
    if (this.popupOnNo) this.popupOnNo(remember);
    this.popupOnYes = null;
    this.popupOnNo = null;
  }

  private openPopup(
    title: string,
    yesLabel: string,
    noLabel: string,
    onYes: (remember: boolean) => void,
    onNo: (remember: boolean) => void,
    showRemember = false,
  ): void {
    this.popupTitle.set(title);
    this.popupYesLabel.set(yesLabel);
    this.popupNoLabel.set(noLabel);
    this.popupShowRemember.set(showRemember);
    this.popupOnYes = onYes;
    this.popupOnNo = onNo;
    this.popupVisible.set(true);
  }

  // ── Helpers ──────────────────────────────────────────────────────────
  private eventX(e: MouseEvent | TouchEvent): number {
    return 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
  }

  private eventY(e: MouseEvent | TouchEvent): number {
    return 'touches' in e ? e.touches[0]?.clientY ?? (e as TouchEvent).changedTouches[0]?.clientY ?? 0 : (e as MouseEvent).clientY;
  }

  private pixelsToMinutes(px: number): number {
    // 5-min snap matches the live-preview label shown during drag.
    const minutes = Math.round((px / 80) * 60 / 5) * 5;
    return Math.max(5, minutes);
  }

  private addMinutesToTime(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const nh = Math.min(23, Math.floor(total / 60));
    const nm = total % 60;
    return `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}`;
  }

  private diffMinutes(start: string, end: string): number {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return eh * 60 + em - (sh * 60 + sm);
  }
}