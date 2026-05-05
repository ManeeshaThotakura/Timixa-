import { Component, OnInit, OnDestroy, inject, signal, NgZone } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { ScheduleService } from '../../../core/services/schedule.service';
import { ScheduledEvent, UnscheduledTask } from '../../../core/models/schedule.model';

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 00:00 – 23:00
const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

@Component({
  selector: 'app-schedule-week',
  standalone: true,
  imports: [CommonModule],
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

    <!-- Week navigation -->
    <div class="px-margin-page mt-stack-md flex items-center justify-between">
      <button (click)="prevWeek()"
              class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform">
        <span class="material-symbols-outlined text-[18px]">chevron_left</span>
      </button>
      <span class="text-sm font-semibold text-on-surface">{{ weekLabel }}</span>
      <button (click)="nextWeek()"
              class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform">
        <span class="material-symbols-outlined text-[18px]">chevron_right</span>
      </button>
    </div>

    <!-- 7-day × 24h time grid -->
    <div class="mt-stack-md overflow-x-auto" style="-ms-overflow-style:none;scrollbar-width:none;">
      <div [style.minWidth.px]="48 + weekDays.length * COL_W">

        <!-- Day header row -->
        <div class="flex sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-100">
          <div class="flex-shrink-0 border-r border-slate-100" [style.width.px]="48"></div>
          <div *ngFor="let day of weekDays"
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
        <div *ngFor="let hour of hours" class="flex" [style.height.px]="ROW_H">

          <!-- Hour label (sticky left) -->
          <div class="flex-shrink-0 border-r border-slate-100 text-[10px] text-slate-400 pt-1 px-1 font-medium bg-white"
               style="position: sticky; left: 0; z-index: 10;"
               [style.width.px]="48">
            {{ formatHour(hour) }}
          </div>

          <!-- Day cells -->
          <div *ngFor="let day of weekDays"
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

            <!-- Events in this cell -->
            <div *ngFor="let evt of getEventsForCell(hour, day.dateStr)"
                 class="absolute inset-x-1 top-1 rounded-md px-1.5 py-1 border-l-2 overflow-hidden"
                 [style.height.px]="getCellEventHeight(evt.startTime, evt.endTime)"
                 [style.background]="getEventBg(evt.type)"
                 [style.borderLeftColor]="getEventBorder(evt.type, evt.color)">
              <p class="text-[10px] font-bold truncate leading-tight"
                 [style.color]="getEventBorder(evt.type, evt.color)">
                {{ evt.title }}
              </p>
              <p class="text-[9px] leading-tight"
                 [style.color]="getEventBorder(evt.type, evt.color) + 'aa'">
                {{ evt.startTime }}
              </p>
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
  `,
})
export class ScheduleWeekComponent implements OnInit, OnDestroy {
  router = inject(Router);
  private scheduleService = inject(ScheduleService);
  private zone = inject(NgZone);
  private doc = inject(DOCUMENT);

  readonly COL_W = 110;
  readonly ROW_H = 64;
  hours = HOURS;
  unplannedOpen = true;
  weekStart = this.getMonday(new Date());

  views = [
    { label: 'Day',   route: '/schedule' },
    { label: 'Week',  route: '/schedule/week' },
    { label: 'Month', route: '/schedule/month' },
  ];

  unscheduledTasks = this.scheduleService.unscheduledTasks;
  draggingTask  = signal<UnscheduledTask | null>(null);
  dragOverHour  = signal<number | null>(null);
  dragOverDate  = signal<string | null>(null);

  // Touch drag state
  private touchClone: HTMLElement | null = null;
  private touchDropHour: number | null = null;
  private touchDropDate: string | null = null;
  private readonly boundTouchMove = (e: TouchEvent) => this.onTouchMove(e);
  private readonly boundTouchEnd  = (e: TouchEvent) => this.onTouchEnd(e);

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
  ngOnDestroy(): void { this.cleanupTouch(); }

  isToday(date: Date): boolean {
    return date.toDateString() === new Date().toDateString();
  }

  formatHour(h: number): string {
    return `${h.toString().padStart(2, '0')}:00`;
  }

  getEventsForCell(hour: number, dateStr: string): ScheduledEvent[] {
    return this.scheduleService.getByDate(dateStr)
      .filter(e => parseInt(e.startTime.split(':')[0], 10) === hour);
  }

  getCellEventHeight(startTime: string, endTime: string): number {
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    return Math.max(28, Math.min(this.ROW_H - 4,
      ((toMin(endTime) - toMin(startTime)) / 60) * this.ROW_H - 4));
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
    const start = `${hour.toString().padStart(2, '0')}:00`;
    const end   = `${(hour + 1).toString().padStart(2, '0')}:00`;
    this.scheduleService.addEvent({
      id: `task-${task.id}-${Date.now()}`,
      title: task.title,
      type: 'task',
      date: dateStr,
      startTime: start,
      endTime: end,
      color: '#451de3',
    });
    this.scheduleService.scheduleTask(task.id);
  }

  private getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
