import { Component, OnInit, OnDestroy, inject, signal, computed, NgZone, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ScheduleService } from '../../../core/services/schedule.service';
import { ScheduledEvent, UnscheduledTask } from '../../../core/models/schedule.model';

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 00:00 – 23:00
const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

@Component({
  selector: 'app-schedule-week',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

    <!-- Unplanned Tasks (collapsible) -->
    <section class="px-margin-page mt-stack-md">
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
            <p class="text-[10px] text-on-surface-variant">Due {{ task.dueDate | date:'MMM d' }}</p>
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
               [style.background]="isToday(day.date) ? 'rgba(94,67,251,0.05)' : ''">
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

            <!-- Events in this cell (same layout as day view: drag + title + time + resize) -->
            <!-- z-index keeps multi-hour events clickable beyond their parent cell — without it,
                 cells in the rows below cover the overflow region and steal pointer events. -->
            <div *ngFor="let evt of getEventsForCell(hour, day.dateStr); trackBy: trackByEventId"
                 [attr.data-event-id]="evt.id"
                 class="absolute rounded-md pl-1 pr-1.5 flex items-center gap-1 border-l-2 overflow-hidden cursor-pointer select-none transition-shadow"
                 [class.cursor-grab]="selectedEventId() === evt.id"
                 [class.active:cursor-grabbing]="selectedEventId() === evt.id"
                 style="touch-action: none;"
                 [style.zIndex]="movingEventId() === evt.id ? 8 : (selectedEventId() === evt.id ? 7 : 6)"
                 [style.boxShadow]="selectedEventId() === evt.id
                   ? '0 0 0 2px #5e43fb, 0 8px 20px rgba(94,67,251,0.25)'
                   : '0 1px 4px rgba(0,0,0,0.06)'"
                 [ngStyle]="getCellEventStyle(evt, day.dateStr)"
                 [style.opacity]="movingEventId() === evt.id ? '0.35' : '1'"
                 [style.background]="getEventBg(evt.type)"
                 [style.borderLeftColor]="getEventBorder(evt.type, evt.color)"
                 (mousedown)="onEventDown($event, evt)"
                 (touchstart)="onEventDown($event, evt)">
              <span class="material-symbols-outlined text-[13px] opacity-70 flex-shrink-0 -ml-1 relative z-10 leading-none pointer-events-none"
                    [style.color]="getEventBorder(evt.type, evt.color)">
                drag_indicator
              </span>
              <span class="text-[10px] font-bold truncate flex-1 leading-tight pointer-events-none"
                    [style.color]="getEventBorder(evt.type, evt.color)">
                {{ evt.title }}
              </span>
              <span class="text-[9px] font-medium flex-shrink-0 leading-tight whitespace-nowrap pointer-events-none"
                    [style.color]="getEventBorder(evt.type, evt.color)">
                {{ resizingEventId() === evt.id ? resizingTimeLabel() : evt.startTime + '–' + evt.endTime }}
              </span>
              <!-- Resize handle (off the left edge so it never overlaps the drag indicator) -->
              <div class="absolute bottom-0 left-8 right-1 h-3 flex items-center justify-center cursor-ns-resize hover:bg-primary/10 transition-colors"
                   data-resize-handle
                   style="touch-action: none;"
                   (mousedown)="onResizeStart($event, evt)"
                   (touchstart)="onResizeStart($event, evt)">
                <div class="w-5 h-0.5 rounded-full bg-on-surface-variant/30"></div>
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
    <button class="fixed bottom-24 right-6 w-14 h-14 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform z-50"
            style="background:linear-gradient(135deg,#5e43fb,#00c1fd); box-shadow:0 8px 24px rgba(94,67,251,0.3);">
      <span class="material-symbols-outlined text-2xl">add</span>
    </button>

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
  `,
})
export class ScheduleWeekComponent implements OnInit, OnDestroy {
  router = inject(Router);
  private scheduleService = inject(ScheduleService);
  private zone = inject(NgZone);
  private doc = inject(DOCUMENT);

  // Zoom: 1.0 = 100% (COL_W=110, ROW_H=64). Range 0.6 — 2.0.
  private readonly BASE_COL_W = 110;
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

  unscheduledTasks = computed(() =>
    this.scheduleService.unscheduledTasks().filter(t => t.remainingMinutes > 0),
  );
  draggingTask  = signal<UnscheduledTask | null>(null);
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
    evt: ScheduledEvent;
    startX: number; startY: number;
    isDragging: boolean;
    hoverHour: number | null;
    hoverDate: string | null;
    ghost: HTMLElement | null;
  } | null = null;
  movingEventId = signal<string | null>(null);
  selectedEventId = signal<string | null>(null);
  private readonly boundMoveTrack = (e: MouseEvent | TouchEvent) => this.onMoveTrack(e);
  private readonly boundMoveEnd = (e: MouseEvent | TouchEvent) => this.onMoveEnd(e);

  // Resize state
  resizingEventId = signal<string | null>(null);
  resizingHeight = signal<number>(0);
  private resizeStartY = 0;
  private resizeStartHeight = 0;
  private resizeEvent: ScheduledEvent | null = null;
  private readonly boundResizeMove = (e: MouseEvent | TouchEvent) => this.onResizeMove(e);
  private readonly boundResizeEnd = (e: MouseEvent | TouchEvent) => this.onResizeEnd(e);

  resizingTimeLabel = computed(() => {
    if (!this.resizeEvent) return '';
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
  editingEvent = signal<ScheduledEvent | null>(null);
  editDate = '';
  editStart = '';
  editEnd = '';

  get weekDays() {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(this.weekStart);
      d.setDate(d.getDate() + i);
      return {
        abbr: DAY_ABBR[d.getDay()],
        day: d.getDate(),
        date: d,
        dateStr: d.toISOString().split('T')[0],
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
    return this.weekDays.reduce((sum, d) =>
      sum + this.scheduleService.getByDate(d.dateStr).length, 0);
  }

  get weekVelocity(): number {
    const total = this.weekEventsCount + this.unscheduledTasks().length;
    return total === 0 ? 0 : Math.round((this.weekEventsCount / total) * 100);
  }

  ngOnInit(): void { this.scheduleService.load(); }
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

  isToday(date: Date): boolean {
    return date.toDateString() === new Date().toDateString();
  }

  formatHour(h: number): string {
    return `${h.toString().padStart(2, '0')}:00`;
  }

  // Cached buckets — recompute only when events signal changes, not every CD cycle.
  private allEventsByCell = computed(() => {
    const events = this.scheduleService.events();
    const byCell = new Map<string, ScheduledEvent[]>();
    for (const evt of events) {
      const hour = parseInt(evt.startTime.split(':')[0], 10);
      const key = `${evt.date}#${hour}`;
      let bucket = byCell.get(key);
      if (!bucket) { bucket = []; byCell.set(key, bucket); }
      bucket.push(evt);
    }
    return byCell;
  });

  private allLayouts = computed(() => {
    const events = this.scheduleService.events();
    const byDate = new Map<string, ScheduledEvent[]>();
    for (const evt of events) {
      let bucket = byDate.get(evt.date);
      if (!bucket) { bucket = []; byDate.set(evt.date, bucket); }
      bucket.push(evt);
    }
    const layouts = new Map<string, Map<string, { col: number; count: number }>>();
    for (const [date, dayEvents] of byDate) {
      layouts.set(date, this.computeLayout(dayEvents));
    }
    return layouts;
  });

  getEventsForCell(hour: number, dateStr: string): ScheduledEvent[] {
    return this.allEventsByCell().get(`${dateStr}#${hour}`) ?? [];
  }

  trackByEventId(_i: number, evt: ScheduledEvent): string { return evt.id; }
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

  private computeLayout(events: ScheduledEvent[]): Map<string, { col: number; count: number }> {
    const result = new Map<string, { col: number; count: number }>();
    if (events.length === 0) return result;
    const sorted = [...events].sort((a, b) => this.toMin(a.startTime) - this.toMin(b.startTime));
    let cluster: ScheduledEvent[] = [];
    let clusterEnd = -1;
    const flush = () => {
      if (!cluster.length) return;
      const cols: number[] = [];
      const assigns: number[] = [];
      for (const evt of cluster) {
        const start = this.toMin(evt.startTime);
        let assigned = -1;
        for (let i = 0; i < cols.length; i++) {
          if (cols[i] <= start) { assigned = i; break; }
        }
        if (assigned === -1) { assigned = cols.length; cols.push(0); }
        cols[assigned] = this.toMin(evt.endTime);
        assigns.push(assigned);
      }
      const count = cols.length;
      cluster.forEach((evt, i) => result.set(evt.id, { col: assigns[i], count }));
    };
    for (const evt of sorted) {
      const s = this.toMin(evt.startTime);
      const e = this.toMin(evt.endTime);
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

  getCellEventStyle(evt: ScheduledEvent, dateStr: string): Record<string, string> {
    const isResizing = this.resizingEventId() === evt.id;
    const height = isResizing
      ? this.resizingHeight()
      : this.getCellEventHeight(evt.startTime, evt.endTime);
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

  getEventBg(type: string): string {
    if (type === 'habit') return 'rgba(194,232,255,0.45)';
    if (type === 'meeting') return 'rgba(232,245,233,0.9)';
    return 'rgba(228,223,255,0.45)';
  }

  getEventBorder(type: string, color: string): string {
    if (type === 'habit') return '#006688';
    if (type === 'meeting') return '#2E7D32';
    return color || '#451de3';
  }

  getTaskIcon(task: UnscheduledTask): string {
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
  }

  nextWeek(): void {
    const d = new Date(this.weekStart);
    d.setDate(d.getDate() + 7);
    this.weekStart = d;
  }

  // ── Desktop drag ─────────────────────────────────────────────────────
  onDragStart(event: DragEvent, task: UnscheduledTask): void {
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
  onTouchStart(event: TouchEvent, task: UnscheduledTask): void {
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

  private scheduleAt(task: UnscheduledTask, hour: number, dateStr: string): void {
    const remaining = task.remainingMinutes;
    if (remaining <= 0) return;

    const start = `${hour.toString().padStart(2, '0')}:00`;
    const total = hour * 60 + remaining;
    const eh = Math.min(23, Math.floor(total / 60));
    const em = total % 60;
    const end = `${eh.toString().padStart(2, '0')}:${em.toString().padStart(2, '0')}`;

    this.scheduleService.addEvent({
      id: `task-${task.id}-${Date.now()}`,
      title: task.title,
      type: 'task',
      date: dateStr,
      startTime: start,
      endTime: end,
      color: '#451de3',
      sourceTaskId: task.id,
    });
    this.scheduleService.scheduleTask(task.id, remaining);
  }

  // ── Pointer interaction: select → edit/move ─────────────────────────
  onEventDown(event: MouseEvent | TouchEvent, evt: ScheduledEvent): void {
    if (this.moveDrag) this.cancelMoveDrag();

    event.stopPropagation();
    if ('touches' in event) event.preventDefault();

    // First tap on an unselected event just selects it. Drag/edit needs a 2nd interaction.
    if (this.selectedEventId() !== evt.id) {
      this.zone.run(() => this.selectedEventId.set(evt.id));
      return;
    }

    this.moveDrag = {
      evt,
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

  private onMoveEnd(_event: MouseEvent | TouchEvent): void {
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

    this.zone.run(() => {
      if (drag.isDragging) {
        if (drag.hoverHour !== null && drag.hoverDate) {
          const duration = this.diffMinutes(drag.evt.startTime, drag.evt.endTime);
          const newStart = `${drag.hoverHour.toString().padStart(2, '0')}:00`;
          const newEnd = this.addMinutesToTime(newStart, duration);
          this.scheduleService.updateEvent(drag.evt.id, {
            date: drag.hoverDate,
            startTime: newStart,
            endTime: newEnd,
          });
        }
      } else {
        this.openEditModal(drag.evt);
      }
      this.movingEventId.set(null);
      this.dragOverHour.set(null);
      this.dragOverDate.set(null);
    });

    this.moveDrag = null;
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
    const el = this.gridScrollEl;
    const rect = el.getBoundingClientRect();
    const EDGE = 60;
    const MAX_SPEED = 14;
    const { x, y } = this.currentDragXY;

    let dx = 0, dy = 0;
    if (x < rect.left + EDGE) {
      const t = Math.min(1, (rect.left + EDGE - x) / EDGE);
      dx = -Math.round(MAX_SPEED * t);
    } else if (x > rect.right - EDGE) {
      const t = Math.min(1, (x - (rect.right - EDGE)) / EDGE);
      dx = Math.round(MAX_SPEED * t);
    }
    if (y < rect.top + EDGE) {
      const t = Math.min(1, (rect.top + EDGE - y) / EDGE);
      dy = -Math.round(MAX_SPEED * t);
    } else if (y > rect.bottom - EDGE) {
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
    this.moveDrag = null;
  }

  private createMoveGhost(evt: ScheduledEvent): void {
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
  onResizeStart(event: MouseEvent | TouchEvent, evt: ScheduledEvent): void {
    event.stopPropagation();
    event.preventDefault();

    // Resize handle also requires the event to be selected first.
    if (this.selectedEventId() !== evt.id) {
      this.zone.run(() => this.selectedEventId.set(evt.id));
      return;
    }

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
      if (this.resizeEvent) {
        const minutes = this.pixelsToMinutes(this.resizingHeight());
        if (minutes > 0) this.scheduleService.resizeEvent(this.resizeEvent.id, minutes);
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

  openEditModal(evt: ScheduledEvent): void {
    this.editingEvent.set(evt);
    this.editDate = evt.date;
    this.editStart = evt.startTime;
    this.editEnd = evt.endTime;
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
    if (!this.editDate) return;
    this.scheduleService.updateEvent(evt.id, {
      date: this.editDate,
      startTime: this.editStart,
      endTime: this.editEnd,
    });
    this.editingEvent.set(null);
  }

  private eventX(e: MouseEvent | TouchEvent): number {
    return 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
  }

  private eventY(e: MouseEvent | TouchEvent): number {
    return 'touches' in e ? e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY ?? 0 : e.clientY;
  }

  private getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
