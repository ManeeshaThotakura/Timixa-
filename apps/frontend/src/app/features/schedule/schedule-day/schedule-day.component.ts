import { Component, OnInit, OnDestroy, inject, signal, computed, NgZone } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { PlannedTaskService } from '../../../core/services/planned-task.service';
import { PlannedTask } from '../../../core/models/planned-task.model';
import { ExceptionPopupComponent } from '../exception-popup.component';

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 00:00 – 23:00

// A rendered bar on the grid. Either the task's template times (segmentId=null)
// or one of its per-date segments.
interface DayBar extends PlannedTask {
  _segmentId: string | null;
}

@Component({
  selector: 'app-schedule-day',
  standalone: true,
  imports: [CommonModule, FormsModule, ExceptionPopupComponent],
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
            <div *ngFor="let evt of getEventsForHour(hour)"
                 [attr.data-event-id]="evt.id"
                 class="absolute rounded-lg border-l-4 select-none cursor-pointer transition-all overflow-hidden"
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

              <!-- Content row (icons, title, time) -->
              <div class="flex items-center gap-2 px-3 h-full"
                   [class.pb-4]="selectedEventId() === evt.id">
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
                        class="text-[10px] font-medium flex-shrink-0 rounded-md transition-colors border-0"
                        data-time-label
                        [class.px-2]="selectedEventId() === evt.id"
                        [class.py-1]="selectedEventId() === evt.id"
                        [style.color]="getEventBorder(evt.color)"
                        [style.background]="selectedEventId() === evt.id ? 'rgba(94,67,251,0.18)' : 'transparent'"
                        [style.cursor]="selectedEventId() === evt.id ? 'pointer' : 'default'"
                        (mousedown)="onTimeLabelDown($event, evt)"
                        (touchstart)="onTimeLabelDown($event, evt)"
                        (click)="onTimeLabelClick($event, evt)">
                  {{ resizingEventId() === evt.id ? resizingTimeLabel() : (evt.startTime || '') + '–' + (evt.endTime || '') }}
                </button>
              </div>

              <!-- Resize handle row — only visible & active when card is selected -->
              <div *ngIf="selectedEventId() === evt.id"
                   class="absolute left-0 right-0 bottom-0 h-4 flex items-center justify-center cursor-ns-resize"
                   data-resize-handle
                   style="touch-action: none; background: rgba(94,67,251,0.22);"
                   (mousedown)="onResizeStart($event, evt)"
                   (touchstart)="onResizeStart($event, evt)">
                <div class="w-16 h-1 rounded-full pointer-events-none" [style.background]="getEventBorder(evt.color)"></div>
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
    <button class="fixed bottom-28 right-6 w-14 h-14 rounded-full flex items-center justify-center text-white active:scale-95 transition-all z-40"
            style="background:linear-gradient(135deg,#451de3,#00c1fd); box-shadow:0 8px 32px rgba(69,29,227,0.3);">
      <span class="material-symbols-outlined text-2xl">add</span>
    </button>

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
      (yes)="onPopupYes()"
      (no)="onPopupNo()">
    </app-exception-popup>
  `,
})
export class ScheduleDayComponent implements OnInit, OnDestroy {
  router = inject(Router);
  private route = inject(ActivatedRoute);
  private plannedTasks = inject(PlannedTaskService);
  private zone = inject(NgZone);
  private doc = inject(DOCUMENT);

  currentDate = new Date();
  hours = HOURS;
  draggingTask = signal<PlannedTask | null>(null);
  dragOverHour = signal<number | null>(null);

  // Local signal holding tasks for the displayed day
  tasksForDay = signal<PlannedTask[]>([]);

  // Resize state
  resizingEventId = signal<string | null>(null);
  resizingHeight = signal<number>(0);
  private resizeStartY = 0;
  private resizeStartHeight = 0;
  private resizeEvent: PlannedTask | null = null;
  private readonly boundResizeMove = (e: MouseEvent | TouchEvent) => this.onResizeMove(e);
  private readonly boundResizeEnd = (e: MouseEvent | TouchEvent) => this.onResizeEnd(e);

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
  private popupOnYes: (() => void) | null = null;
  private popupOnNo: (() => void) | null = null;

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

  resizingTimeLabel = computed(() => {
    if (!this.resizeEvent || !this.resizeEvent.startTime) return '';
    const minutes = this.pixelsToMinutes(this.resizingHeight());
    const end = this.addMinutesToTime(this.resizeEvent.startTime, minutes);
    return `${this.resizeEvent.startTime}–${end}`;
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
    return this.currentDate.toISOString().split('T')[0];
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

  get todayEvents(): DayBar[] {
    const out: DayBar[] = [];
    for (const t of this.tasksForDay()) {
      const segs = t.segmentsForDate ?? [];
      if (segs.length > 0) {
        for (const s of segs) {
          out.push({ ...t, _segmentId: s.id, startTime: s.startTime, endTime: s.endTime });
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

  get dayLayout(): Map<string, { col: number; count: number }> {
    return this.computeLayout(this.todayEvents);
  }

  get conflictCount(): number {
    let n = 0;
    this.dayLayout.forEach(l => { if (l.count > 1) n++; });
    return n;
  }

  getEventBoxStyle(evt: PlannedTask): Record<string, string> {
    const isResizing = this.resizingEventId() === evt.id;
    const height = isResizing ? this.resizingHeight() : this.getEventHeight(evt.startTime!, evt.endTime!);
    const layout = this.dayLayout.get(evt.id);
    const style: Record<string, string> = {
      top: '2px',
      height: `${height}px`,
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
    return Math.max(36, ((toMin(endTime) - toMin(startTime)) / 60) * 80 - 4);
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

    const segs = task.segmentsForDate ?? [];
    if (segs.length === 0 && task.startTime && task.endTime) {
      // Template times currently render the day's bar. Lift them into a segment first so
      // they don't disappear when we add the new chunk (segments replace template render).
      this.plannedTasks.createSegment(task.id, date, task.startTime, task.endTime).subscribe({
        next: () => this.plannedTasks.createSegment(task.id, date, start, end)
          .subscribe(() => this.reload()),
        error: () => this.plannedTasks.createSegment(task.id, date, start, end)
          .subscribe(() => this.reload()),
      });
    } else if (segs.length === 0 && !task.startTime) {
      // First time scheduling. Set template times so the task has a default for other dates.
      this.plannedTasks.update(task.id, { startTime: start, endTime: end, needsTimeSlot: true })
        .subscribe(() => this.reload());
    } else {
      // Already has segments — just add another.
      this.plannedTasks.createSegment(task.id, date, start, end)
        .subscribe(() => this.reload());
    }
  }

  // ── Resize handle (bottom edge of event) ────────────────────────────
  onResizeStart(event: MouseEvent | TouchEvent, evt: PlannedTask): void {
    event.stopPropagation();
    event.preventDefault();
    this.resizeEvent = evt;
    this.resizeStartY = this.eventY(event);
    this.resizeStartHeight = this.getEventHeight(evt.startTime!, evt.endTime!);
    this.resizingEventId.set(evt.id);
    this.resizingHeight.set(this.resizeStartHeight);
    this.doc.addEventListener('mousemove', this.boundResizeMove as EventListener);
    this.doc.addEventListener('mouseup', this.boundResizeEnd as EventListener);
    this.doc.addEventListener('touchmove', this.boundResizeMove as EventListener, { passive: false } as AddEventListenerOptions);
    this.doc.addEventListener('touchend', this.boundResizeEnd as EventListener);
  }

  private onResizeMove(event: MouseEvent | TouchEvent): void {
    if (!this.resizeEvent) return;
    event.preventDefault?.();
    const dy = this.eventY(event) - this.resizeStartY;
    const next = Math.max(18, this.resizeStartHeight + dy);
    this.zone.run(() => this.resizingHeight.set(next));
  }

  private onResizeEnd(_event: MouseEvent | TouchEvent): void {
    this.doc.removeEventListener('mousemove', this.boundResizeMove as EventListener);
    this.doc.removeEventListener('mouseup', this.boundResizeEnd as EventListener);
    this.doc.removeEventListener('touchmove', this.boundResizeMove as EventListener);
    this.doc.removeEventListener('touchend', this.boundResizeEnd as EventListener);

    this.zone.run(() => {
      const moved = Math.abs(this.resizingHeight() - this.resizeStartHeight) > 1;
      if (moved && this.resizeEvent && this.resizeEvent.startTime) {
        const minutes = this.pixelsToMinutes(this.resizingHeight());
        if (minutes > 0) {
          const newEnd = this.addMinutesToTime(this.resizeEvent.startTime, minutes);
          const bar = this.resizeEvent as DayBar;
          if (bar._segmentId) {
            // Segment bar — silent update, no popup.
            this.plannedTasks.updateSegment(bar.id, bar._segmentId, { endTime: newEnd })
              .subscribe(() => this.reload());
          } else if (bar.cadence === 'ONCE') {
            // One-off, no popup either.
            this.plannedTasks.update(bar.id, { endTime: newEnd })
              .subscribe(() => this.reload());
          } else {
            this.askTimePopupFor(bar, this.dateStr, bar.startTime!, newEnd);
          }
        }
      }
      this.resizingEventId.set(null);
      this.resizingHeight.set(0);
      this.resizeEvent = null;
    });
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

      const slot = el?.closest('[data-hour]');
      const hour = slot ? parseInt(slot.getAttribute('data-hour')!, 10) : null;
      if (hour !== this.moveDrag.hoverHour) {
        this.moveDrag.hoverHour = hour;
        this.zone.run(() => this.dragOverHour.set(hour));
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

    if (drag.ghost) {
      drag.ghost.remove();
      drag.ghost = null;
    }

    this.zone.run(() => {
      if (drag.isDragging) {
        if (drag.hoverHour !== null && drag.evt.startTime && drag.evt.endTime) {
          const duration = this.diffMinutes(drag.evt.startTime, drag.evt.endTime);
          const newStart = `${drag.hoverHour.toString().padStart(2, '0')}:00`;
          const newEnd = this.addMinutesToTime(newStart, duration);
          const bar = drag.evt as DayBar;
          if (bar._segmentId) {
            this.plannedTasks.updateSegment(bar.id, bar._segmentId, { startTime: newStart, endTime: newEnd })
              .subscribe(() => this.reload());
          } else if (bar.cadence === 'ONCE') {
            this.plannedTasks.update(bar.id, { startTime: newStart, endTime: newEnd })
              .subscribe(() => this.reload());
          } else {
            this.askTimePopupFor(bar, this.dateStr, newStart, newEnd);
          }
        }
      }
      // No movement → keep selection; do not open the modal (use time-label tap for that).
      this.movingEventId.set(null);
      this.dragOverHour.set(null);
    });

    this.moveDrag = null;
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
    if (this.selectedEventId() !== evt.id) {
      this.selectedEventId.set(evt.id);
      return;
    }
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
    this.plannedTasks.update(evt.id, {
      startTime: this.editStart,
      endTime: this.editEnd,
    }).subscribe(() => this.reload());
    this.editingEvent.set(null);
  }

  // ── Skip popup handlers ──────────────────────────────────────────────
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

  // ── Helpers ──────────────────────────────────────────────────────────
  private eventX(e: MouseEvent | TouchEvent): number {
    return 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
  }

  private eventY(e: MouseEvent | TouchEvent): number {
    return 'touches' in e ? e.touches[0]?.clientY ?? (e as TouchEvent).changedTouches[0]?.clientY ?? 0 : (e as MouseEvent).clientY;
  }

  private pixelsToMinutes(px: number): number {
    const minutes = Math.round((px / 80) * 60 / 15) * 15;
    return Math.max(15, minutes);
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