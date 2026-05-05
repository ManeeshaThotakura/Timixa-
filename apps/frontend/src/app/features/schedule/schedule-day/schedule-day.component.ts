import { Component, OnInit, OnDestroy, inject, signal, NgZone } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ScheduleService } from '../../../core/services/schedule.service';
import { ScheduledEvent, UnscheduledTask } from '../../../core/models/schedule.model';

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 00:00 – 23:00

@Component({
  selector: 'app-schedule-day',
  standalone: true,
  imports: [CommonModule],
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

    <!-- Unplanned Tasks -->
    <section class="mt-stack-lg" *ngIf="unscheduledTasks.length > 0">
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
          <p class="text-[11px] text-on-surface-variant">Due {{ task.dueDate | date:'MMM d' }}</p>
        </div>
      </div>
    </section>

    <!-- Time Grid -->
    <section class="px-margin-page mt-stack-md relative pb-8">
      <div>
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
                 class="absolute left-0 right-2 top-2 rounded-lg px-3 flex items-center gap-2 border-l-4"
                 style="box-shadow:0 2px 8px rgba(0,0,0,0.06);"
                 [style.height.px]="getEventHeight(evt.startTime, evt.endTime)"
                 [style.background]="getEventBg(evt.type)"
                 [style.borderLeftColor]="getEventBorder(evt.type, evt.color)">
              <span class="material-symbols-outlined text-sm flex-shrink-0"
                    [style.color]="getEventBorder(evt.type, evt.color)">
                {{ getEventIcon(evt.type) }}
              </span>
              <span class="text-sm font-semibold truncate flex-1"
                    [style.color]="getEventBorder(evt.type, evt.color)">
                {{ evt.title }}
              </span>
              <span class="text-[10px] font-medium flex-shrink-0"
                    [style.color]="getEventBorder(evt.type, evt.color)">
                {{ evt.startTime }}–{{ evt.endTime }}
              </span>
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
  `,
})
export class ScheduleDayComponent implements OnInit, OnDestroy {
  router = inject(Router);
  private route = inject(ActivatedRoute);
  private scheduleService = inject(ScheduleService);
  private zone = inject(NgZone);
  private doc = inject(DOCUMENT);

  currentDate = new Date();
  hours = HOURS;
  draggingTask = signal<UnscheduledTask | null>(null);
  dragOverHour = signal<number | null>(null);

  views = [
    { label: 'Day', route: '/schedule' },
    { label: 'Week', route: '/schedule/week' },
    { label: 'Month', route: '/schedule/month' },
  ];

  highlightedTaskId = signal<string | null>(null);

  get unscheduledTasks() {
    const id  = this.highlightedTaskId();
    const all = this.scheduleService.unscheduledTasks();
    if (!id) return all;
    return [...all.filter(t => t.id === id), ...all.filter(t => t.id !== id)];
  }

  // Touch drag state
  private touchClone: HTMLElement | null = null;
  private touchDragOverHour: number | null = null;
  private readonly boundTouchMove = (e: TouchEvent) => this.onTouchMove(e);
  private readonly boundTouchEnd  = (e: TouchEvent) => this.onTouchEnd(e);

  get dateStr(): string {
    return this.currentDate.toISOString().split('T')[0];
  }

  get todayEvents(): ScheduledEvent[] {
    return this.scheduleService.getByDate(this.dateStr);
  }

  get progressPercent(): number {
    const total = this.todayEvents.length + this.unscheduledTasks.length;
    return total === 0 ? 0 : Math.round((this.todayEvents.length / total) * 100);
  }

  get strokeOffset(): number {
    return 2 * Math.PI * 20 * (1 - this.progressPercent / 100);
  }

  ngOnInit(): void {
    this.scheduleService.load();
    const snap = this.route.snapshot.queryParamMap;

    const dateParam = snap.get('date');
    if (dateParam) {
      const parsed = new Date(dateParam + 'T00:00:00');
      if (!isNaN(parsed.getTime())) this.currentDate = parsed;
    }

    const taskId = snap.get('taskId');
    if (taskId) this.highlightedTaskId.set(taskId);
  }

  ngOnDestroy(): void { this.cleanupTouchListeners(); }

  formatHour(h: number): string {
    return `${h.toString().padStart(2, '0')}:00`;
  }

  getEventsForHour(hour: number): ScheduledEvent[] {
    return this.todayEvents.filter(e => parseInt(e.startTime.split(':')[0], 10) === hour);
  }

  getEventHeight(startTime: string, endTime: string): number {
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    return Math.max(36, Math.min(72, ((toMin(endTime) - toMin(startTime)) / 60) * 72));
  }

  getEventBg(type: string): string {
    if (type === 'habit') return 'rgba(194,232,255,0.4)';
    if (type === 'meeting') return '#E8F5E9';
    return 'rgba(228,223,255,0.4)';
  }

  getEventBorder(type: string, color: string): string {
    if (type === 'habit') return '#006688';
    if (type === 'meeting') return '#2E7D32';
    return color || '#451de3';
  }

  getEventIcon(type: string): string {
    if (type === 'habit') return 'self_improvement';
    if (type === 'meeting') return 'groups';
    return 'task_alt';
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

  // ── Desktop HTML5 drag ──────────────────────────────────────────────
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
  onTouchStart(event: TouchEvent, task: UnscheduledTask): void {
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
  private scheduleAt(task: UnscheduledTask, hour: number): void {
    const start = `${hour.toString().padStart(2, '0')}:00`;
    const end   = `${(hour + 1).toString().padStart(2, '0')}:00`;
    this.scheduleService.addEvent({
      id: `task-${task.id}-${Date.now()}`,
      title: task.title,
      type: 'task',
      date: this.dateStr,
      startTime: start,
      endTime: end,
      color: '#451de3',
    });
    this.scheduleService.scheduleTask(task.id);
  }
}
