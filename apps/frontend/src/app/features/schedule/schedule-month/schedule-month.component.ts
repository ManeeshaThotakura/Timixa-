import { Component, OnInit, OnDestroy, inject, signal, NgZone } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { ScheduleService } from '../../../core/services/schedule.service';
import { UnscheduledTask } from '../../../core/models/schedule.model';

const DAY_HEADERS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const ICON_BG = ['rgba(194,232,255,0.4)', 'rgba(228,223,255,0.5)', 'rgba(224,227,230,0.6)'];
const ICON_COLOR = ['#006688', '#451de3', '#4b4f52'];

interface CalendarCell {
  day: number;
  date: Date;
  dateStr: string;
  currentMonth: boolean;
}

@Component({
  selector: 'app-schedule-month',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Segmented Control -->
    <div class="px-margin-page mt-stack-md">
      <div class="bg-surface-container p-1 rounded-xl flex items-center">
        <button *ngFor="let v of views"
                (click)="router.navigate([v.route])"
                class="flex-1 py-2 text-label-sm font-semibold transition-all rounded-lg"
                [class]="v.label === 'Month'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'font-medium text-on-surface-variant hover:text-on-surface'">
          {{ v.label }}
        </button>
      </div>
    </div>

    <!-- Month Header -->
    <div class="px-margin-page mt-stack-lg flex justify-between items-center mb-stack-md">
      <div>
        <h2 class="font-bold text-[28px] text-on-surface" style="font-family:Manrope;">{{ monthLabel }}</h2>
        <p class="text-[12px] text-outline mt-0.5">{{ monthEventCount }} sessions scheduled this month</p>
      </div>
      <div class="flex gap-1 p-1 rounded-full" style="background:#f3f3f6;">
        <button (click)="prevMonth()"
                class="p-2 rounded-full hover:bg-white transition-all text-on-surface-variant active:scale-90">
          <span class="material-symbols-outlined text-[20px]">chevron_left</span>
        </button>
        <button (click)="nextMonth()"
                class="p-2 rounded-full hover:bg-white transition-all text-on-surface-variant active:scale-90">
          <span class="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>
      </div>
    </div>

    <!-- Drag-in-progress hint (appears above calendar when dragging) -->
    <div *ngIf="draggingTask()" class="px-margin-page mb-3 transition-all">
      <div class="flex items-center justify-center gap-2 py-2 rounded-2xl"
           style="background:rgba(94,67,251,0.07); border:1.5px dashed rgba(94,67,251,0.35);">
        <span class="material-symbols-outlined text-[15px]" style="color:#451de3;">touch_app</span>
        <span style="font-size:11px;font-weight:700;color:#451de3;letter-spacing:0.4px;">
          Drop on a date to schedule
        </span>
      </div>
    </div>

    <!-- Calendar Grid -->
    <div class="px-margin-page">
      <div class="bg-white rounded-[32px] p-4 overflow-hidden"
           style="box-shadow:0 8px 24px rgba(94,67,251,0.04);">

        <!-- Day headers -->
        <div class="grid grid-cols-7 mb-2">
          <div *ngFor="let h of dayHeaders"
               class="text-center py-2 text-label-sm font-label-sm text-outline">
            {{ h }}
          </div>
        </div>

        <!-- Calendar cells -->
        <div class="grid grid-cols-7 gap-y-1">
          <div *ngFor="let cell of calendarCells"
               [attr.data-date]="cell.dateStr"
               class="aspect-square flex flex-col items-center justify-start pt-1 rounded-2xl cursor-pointer transition-all relative"
               [style.opacity]="cell.currentMonth ? '1' : '0.3'"
               [style.background]="getCellBg(cell)"
               [style.boxShadow]="draggingTask() && cell.currentMonth && dragOverDate() !== cell.dateStr
                                    ? 'inset 0 0 0 1.5px rgba(94,67,251,0.2)' : ''"
               (click)="selectDate(cell)"
               (dragover)="onDragOver($event)"
               (dragleave)="onDragLeave($event)"
               (drop)="onDrop($event, cell)">

            <!-- Day number -->
            <span class="text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full z-10"
                  [style.background]="isSelected(cell) ? '#5e43fb' : 'transparent'"
                  [style.color]="isSelected(cell) ? '#fff' : isToday(cell) ? '#451de3' : '#1a1c1e'"
                  [style.fontWeight]="isToday(cell) || isSelected(cell) ? '700' : '500'">
              {{ cell.day }}
            </span>

            <!-- Event dots -->
            <div class="flex gap-0.5 mt-0.5 flex-wrap justify-center max-w-[28px]">
              <span *ngFor="let evt of getEventsForDay(cell)"
                    class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    [style.background]="evt.color">
              </span>
            </div>

            <!-- Drop highlight overlay — visible border + "+" so the target date stays readable -->
            <div *ngIf="dragOverDate() === cell.dateStr"
                 class="absolute inset-0 rounded-2xl pointer-events-none z-20 flex items-end justify-center pb-1"
                 style="border:2px solid #451de3; background:rgba(94,67,251,0.13);">
              <span style="font-size:11px;line-height:1;color:#451de3;font-weight:900;">+</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Selected day summary -->
    <div *ngIf="selectedDate && selectedDateEvents.length > 0" class="px-margin-page mt-stack-md">
      <h3 class="font-semibold text-[15px] text-on-surface mb-2">
        {{ selectedDate | date:'EEEE, MMMM d' }}
      </h3>
      <div class="space-y-2">
        <div *ngFor="let evt of selectedDateEvents"
             class="flex items-center gap-3 py-2 border-b border-outline-variant last:border-0">
          <div class="w-2 h-2 rounded-full flex-shrink-0" [style.background]="evt.color"></div>
          <span class="text-sm text-on-surface flex-1">{{ evt.title }}</span>
          <span class="text-xs text-on-surface-variant">{{ evt.startTime }}</span>
        </div>
      </div>
    </div>

    <!-- Unscheduled Tasks -->
    <section class="px-margin-page mt-stack-lg pb-32">
      <div class="flex justify-between items-center mb-stack-md">
        <h3 class="font-semibold text-[16px] text-on-surface">Unscheduled Tasks</h3>
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-on-surface-variant"
              style="background:#e2e2e5;">
          {{ unscheduledTasks().length }} TOTAL
        </span>
      </div>
      <p class="text-[11px] text-on-surface-variant mb-3 flex items-center gap-1">
        <span class="material-symbols-outlined text-[14px]">touch_app</span>
        Drag a task onto a calendar day to schedule it
      </p>

      <div class="space-y-3">
        <div *ngFor="let task of unscheduledTasks(); let i = index"
             [attr.data-task-id]="task.id"
             draggable="true"
             (dragstart)="onDragStart($event, task)"
             (dragend)="onDragEnd()"
             (touchstart)="onTouchStart($event, task)"
             class="bg-white p-4 rounded-3xl flex items-center gap-4 cursor-grab active:cursor-grabbing select-none touch-none border border-slate-50 transition-all duration-200"
             style="box-shadow:0 8px 24px rgba(94,67,251,0.02);"
             [style.opacity]="draggingTask()?.id === task.id ? '0.3' : '1'"
             [style.transform]="draggingTask()?.id === task.id ? 'scale(0.97)' : 'scale(1)'">

          <!-- Icon -->
          <div class="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
               [style.background]="ICON_BG[i % 3]">
            <span class="material-symbols-outlined"
                  [style.color]="ICON_COLOR[i % 3]">
              {{ getTaskIcon(task) }}
            </span>
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <p class="font-bold text-on-surface text-[15px] truncate">{{ task.title }}</p>
            <p class="text-label-sm text-outline mt-0.5">Due {{ task.dueDate | date:'MMM d' }}</p>
          </div>

          <!-- Drag handle -->
          <span class="material-symbols-outlined text-slate-300 flex-shrink-0">drag_indicator</span>
        </div>

        <div *ngIf="unscheduledTasks().length === 0"
             class="text-center py-8 text-on-surface-variant text-sm">
          All tasks scheduled!
        </div>
      </div>
    </section>

    <!-- FAB -->
    <button class="fixed bottom-28 right-6 w-14 h-14 rounded-full flex items-center justify-center text-white active:scale-90 transition-all z-40"
            style="background:linear-gradient(135deg,#5e43fb,#00c1fd); box-shadow:0 8px 24px rgba(94,67,251,0.3);">
      <span class="material-symbols-outlined">add</span>
    </button>
  `,
})
export class ScheduleMonthComponent implements OnInit, OnDestroy {
  router  = inject(Router);
  private scheduleService = inject(ScheduleService);
  private zone  = inject(NgZone);
  private doc   = inject(DOCUMENT);

  readonly ICON_BG    = ICON_BG;
  readonly ICON_COLOR = ICON_COLOR;

  currentYear  = new Date().getFullYear();
  currentMonth = new Date().getMonth();
  selectedDate: Date | null = null;
  dayHeaders = DAY_HEADERS;

  views = [
    { label: 'Day',   route: '/schedule' },
    { label: 'Week',  route: '/schedule/week' },
    { label: 'Month', route: '/schedule/month' },
  ];

  unscheduledTasks = this.scheduleService.unscheduledTasks;
  draggingTask  = signal<UnscheduledTask | null>(null);
  dragOverDate  = signal<string | null>(null);

  // Touch state
  private touchClone: HTMLElement | null = null;
  private touchTargetDate: string | null = null;
  private readonly boundTouchMove = (e: TouchEvent) => this.onTouchMove(e);
  private readonly boundTouchEnd  = (e: TouchEvent) => this.onTouchEnd(e);

  get monthLabel(): string {
    return new Date(this.currentYear, this.currentMonth)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  get monthEventCount(): number {
    return this.scheduleService.getByMonth(this.currentYear, this.currentMonth).length;
  }

  get calendarCells(): CalendarCell[] {
    const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const prevDays    = new Date(this.currentYear, this.currentMonth, 0).getDate();
    const cells: CalendarCell[] = [];

    for (let i = offset; i > 0; i--) {
      const d = new Date(this.currentYear, this.currentMonth - 1, prevDays - i + 1);
      cells.push({ day: d.getDate(), date: d, dateStr: d.toISOString().split('T')[0], currentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(this.currentYear, this.currentMonth, d);
      cells.push({ day: d, date, dateStr: date.toISOString().split('T')[0], currentMonth: true });
    }
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(this.currentYear, this.currentMonth + 1, i);
      cells.push({ day: d.getDate(), date: d, dateStr: d.toISOString().split('T')[0], currentMonth: false });
    }
    return cells;
  }

  get selectedDateEvents() {
    if (!this.selectedDate) return [];
    return this.scheduleService.getByDate(this.selectedDate.toISOString().split('T')[0]);
  }

  ngOnInit(): void { this.scheduleService.load(); }
  ngOnDestroy(): void { this.cleanupTouch(); }

  isToday(cell: CalendarCell): boolean {
    return cell.date.toDateString() === new Date().toDateString();
  }

  isSelected(cell: CalendarCell): boolean {
    return cell.date.toDateString() === this.selectedDate?.toDateString();
  }

  getCellBg(cell: CalendarCell): string {
    if (this.isSelected(cell)) return 'rgba(94,67,251,0.08)';
    if (this.isToday(cell))    return '#eeeef0';
    return '';
  }

  getEventsForDay(cell: CalendarCell) {
    return this.scheduleService.getByDate(cell.dateStr).slice(0, 3);
  }

  selectDate(cell: CalendarCell): void {
    this.selectedDate = cell.date;
  }

  prevMonth(): void {
    if (this.currentMonth === 0) { this.currentMonth = 11; this.currentYear--; }
    else this.currentMonth--;
    this.selectedDate = null;
  }

  nextMonth(): void {
    if (this.currentMonth === 11) { this.currentMonth = 0; this.currentYear++; }
    else this.currentMonth++;
    this.selectedDate = null;
  }

  getTaskIcon(task: UnscheduledTask): string {
    const t = task.title.toLowerCase();
    if (t.includes('study') || t.includes('interview') || t.includes('learn')) return 'menu_book';
    if (t.includes('workout') || t.includes('fitness') || t.includes('run'))   return 'fitness_center';
    if (t.includes('api') || t.includes('schema') || t.includes('code'))       return 'code';
    if (t.includes('wire') || t.includes('design') || t.includes('flow'))      return 'draw';
    if (t.includes('meeting') || t.includes('sync'))                            return 'groups';
    if (t.includes('review') || t.includes('audit'))                            return 'auto_awesome';
    if (t.includes('blog') || t.includes('write') || t.includes('draft'))      return 'edit_square';
    return 'task_alt';
  }

  // ── Desktop drag ─────────────────────────────────────────────────────
  onDragStart(event: DragEvent, task: UnscheduledTask): void {
    this.draggingTask.set(task);
    if (event.dataTransfer) {
      event.dataTransfer.setData('taskId', task.id);
      event.dataTransfer.effectAllowed = 'move';

      // Compact pill ghost so it doesn't obscure calendar cells on desktop
      const label = task.title.length > 22 ? task.title.slice(0, 22) + '…' : task.title;
      const ghost = this.doc.createElement('div');
      ghost.textContent = label;
      ghost.style.cssText = `
        position:fixed; top:-9999px; left:-9999px;
        background:white; border-radius:100px; padding:10px 20px;
        font-family:Manrope,sans-serif; font-size:13px; font-weight:700;
        box-shadow:0 12px 40px rgba(94,67,251,0.35);
        border:2px solid rgba(94,67,251,0.3);
        color:#1a1c1e; white-space:nowrap;
      `;
      this.doc.body.appendChild(ghost);
      event.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
      setTimeout(() => { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 0);
    }
  }

  onDragEnd(): void {
    this.draggingTask.set(null);
    this.dragOverDate.set(null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    const cell = (event.currentTarget as HTMLElement);
    const date = cell.getAttribute('data-date');
    if (date && this.dragOverDate() !== date) this.dragOverDate.set(date);
  }

  onDragLeave(event: DragEvent): void {
    const rel = event.relatedTarget as HTMLElement | null;
    if (!rel || !(event.currentTarget as HTMLElement).contains(rel)) {
      this.dragOverDate.set(null);
    }
  }

  onDrop(event: DragEvent, cell: CalendarCell): void {
    event.preventDefault();
    const task = this.draggingTask();
    this.draggingTask.set(null);
    this.dragOverDate.set(null);
    if (task && cell.currentMonth) {
      this.goToDayView(cell.dateStr, task.id);
    }
  }

  // ── Touch drag ───────────────────────────────────────────────────────
  onTouchStart(event: TouchEvent, task: UnscheduledTask): void {
    this.draggingTask.set(task);

    // Build a compact pill chip — small enough that the calendar is fully visible
    const icon  = this.getTaskIcon(task);
    const label = task.title.length > 22 ? task.title.slice(0, 22) + '…' : task.title;
    const clone = this.doc.createElement('div');
    clone.style.cssText = `
      position:fixed;
      z-index:9999;
      opacity:0.96;
      pointer-events:none;
      background:white;
      border-radius:100px;
      padding:10px 18px;
      display:flex;
      align-items:center;
      gap:8px;
      box-shadow:0 12px 40px rgba(94,67,251,0.4), 0 0 0 2px rgba(94,67,251,0.25);
      transform:scale(1.04) rotate(1.5deg);
      transition:none;
      font-family:Manrope,sans-serif;
      white-space:nowrap;
      max-width:240px;
    `;
    clone.innerHTML = `
      <span class="material-symbols-outlined"
            style="font-size:18px;color:#451de3;flex-shrink:0;
                   font-family:'Material Symbols Outlined',sans-serif;">${icon}</span>
      <span style="font-size:13px;font-weight:700;color:#1a1c1e;">${label}</span>
    `;

    const src  = event.currentTarget as HTMLElement;
    const rect = src.getBoundingClientRect();
    clone.style.left = `${rect.left}px`;
    clone.style.top  = `${rect.top}px`;

    this.doc.body.appendChild(clone);
    this.touchClone = clone;
    this.doc.addEventListener('touchmove', this.boundTouchMove, { passive: false } as AddEventListenerOptions);
    this.doc.addEventListener('touchend',  this.boundTouchEnd);
  }

  private onTouchMove(event: TouchEvent): void {
    event.preventDefault();
    const touch = event.touches[0];
    if (this.touchClone) {
      const cloneW = this.touchClone.offsetWidth  || 220;
      const cloneH = this.touchClone.offsetHeight || 48;
      // Position the chip ABOVE the finger so the calendar cell under the touch is always visible
      this.touchClone.style.left = `${touch.clientX - cloneW / 2}px`;
      this.touchClone.style.top  = `${touch.clientY - cloneH - 20}px`;

      this.touchClone.style.visibility = 'hidden';
      const el = this.doc.elementFromPoint(touch.clientX, touch.clientY);
      this.touchClone.style.visibility = 'visible';

      const cell = el?.closest('[data-date]');
      const date = cell?.getAttribute('data-date') || null;

      if (date !== this.touchTargetDate) {
        this.touchTargetDate = date;
        this.zone.run(() => this.dragOverDate.set(date));
      }
    }
  }

  private onTouchEnd(_event: TouchEvent): void {
    this.cleanupTouch();
    const task = this.draggingTask();
    const date = this.touchTargetDate;

    if (this.touchClone) {
      this.doc.body.removeChild(this.touchClone);
      this.touchClone = null;
    }

    this.zone.run(() => {
      this.draggingTask.set(null);
      this.dragOverDate.set(null);
      if (task && date) this.goToDayView(date, task.id);
    });
    this.touchTargetDate = null;
  }

  private cleanupTouch(): void {
    this.doc.removeEventListener('touchmove', this.boundTouchMove);
    this.doc.removeEventListener('touchend',  this.boundTouchEnd);
  }

  private goToDayView(dateStr: string, taskId?: string): void {
    const queryParams: Record<string, string> = { date: dateStr };
    if (taskId) queryParams['taskId'] = taskId;
    this.router.navigate(['/schedule'], { queryParams });
  }
}
