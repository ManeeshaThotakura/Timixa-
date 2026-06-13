import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlannedTaskService } from '../../../core/services/planned-task.service';
import { PlannedTask, Weekday } from '../../../core/models/planned-task.model';
import { ExceptionPopupComponent } from '../exception-popup.component';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const WEEKDAY_NAMES: Weekday[] = [
  'MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY',
];

@Component({
  selector: 'app-schedule-day',
  standalone: true,
  imports: [CommonModule, ExceptionPopupComponent],
  template: `
    <div class="px-margin-page pt-stack-lg pb-4">
      <header class="flex items-center justify-between mb-stack-md">
        <button (click)="prev()" class="p-2 rounded-full hover:bg-surface-container" data-testid="day-prev">‹</button>
        <h2 class="font-manrope font-bold text-h2" data-testid="day-label">{{ label() }}</h2>
        <button (click)="next()" class="p-2 rounded-full hover:bg-surface-container" data-testid="day-next">›</button>
      </header>

      <section *ngIf="unscheduled().length" class="mb-stack-md" data-testid="day-unscheduled">
        <h3 class="font-semibold text-[14px] text-outline mb-2 uppercase">Needs a time slot</h3>
        <div class="flex gap-2 overflow-x-auto pb-2">
          <div *ngFor="let t of unscheduled()"
               class="flex-none w-40 p-3 rounded-[16px] bg-surface-container-lowest shadow-card cursor-grab"
               draggable="true"
               (dragstart)="onQueueDragStart($event, t)"
               [attr.data-testid]="'day-queue-' + t.id">
            <span class="w-2 h-2 rounded-full inline-block mr-2" [style.background]="t.color"></span>
            <span class="font-semibold text-on-surface">{{ t.title }}</span>
          </div>
        </div>
      </section>

      <section class="relative bg-surface-container-lowest rounded-[20px] p-0 shadow-card overflow-hidden">
        <div *ngFor="let h of hours" class="relative h-12 border-t border-outline-variant/10"
             (dragover)="$event.preventDefault()"
             (drop)="onDrop($event, h)"
             [attr.data-testid]="'day-slot-' + h">
          <span class="absolute left-2 top-1 text-[11px] text-outline">{{ pad(h) }}:00</span>
        </div>

        <div *ngFor="let t of scheduled()"
             class="absolute left-12 right-2 rounded-[12px] px-2 py-1 text-white text-[13px] font-semibold cursor-grab"
             [style.top.px]="topPx(t)"
             [style.height.px]="heightPx(t)"
             [style.background]="t.color"
             draggable="true"
             (dragstart)="onBarDragStart($event, t)"
             (dragover)="$event.preventDefault()"
             [attr.data-testid]="'day-bar-' + t.id">
          <div class="flex items-center justify-between">
            <span>{{ t.title }} <span class="font-normal">{{ t.startTime }}–{{ t.endTime }}</span></span>
            <button (click)="requestSkip(t)" class="text-[11px] opacity-80 hover:opacity-100"
                    [attr.data-testid]="'day-skip-' + t.id">skip</button>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-white/10"
               (mousedown)="onResizeStart($event, t)"
               [attr.data-testid]="'day-resize-' + t.id"></div>
        </div>
      </section>
    </div>

    <app-exception-popup *ngIf="pendingSkipId()"
      [title]="pendingPopupTitle()"
      [yesLabel]="popupYesLabel()"
      noLabel="No, just this date"
      (yes)="onSkipYes()"
      (no)="onSkipNo()" />
  `,
})
export class ScheduleDayComponent implements OnInit, OnDestroy {
  protected plannedTasks = inject(PlannedTaskService);
  private router = inject(Router);

  viewDate = signal<string>(todayIso());
  tasksForDay = signal<PlannedTask[]>([]);
  hours = Array.from({length: 24}, (_, i) => i);

  pendingSkipId = signal<string | null>(null);
  pendingPopupTitle = signal('');
  popupYesLabel = signal('');

  unscheduled = computed(() => this.tasksForDay().filter(t => t.needsTimeSlot && !t.startTime));
  scheduled   = computed(() => this.tasksForDay().filter(t => !!t.startTime));

  label = computed(() => new Date(this.viewDate()).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  }));

  ngOnInit(): void { this.reload(); }
  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
  }

  prev(): void { this.shift(-1); }
  next(): void { this.shift(+1); }

  pad(n: number): string { return String(n).padStart(2, '0'); }

  topPx(t: PlannedTask): number {
    const [h, m] = (t.startTime ?? '00:00').split(':').map(Number);
    return (h * 60 + m) * 0.8;
  }
  heightPx(t: PlannedTask): number {
    const [sh, sm] = (t.startTime ?? '00:00').split(':').map(Number);
    const [eh, em] = (t.endTime ?? '00:00').split(':').map(Number);
    return Math.max(20, (eh*60+em - sh*60-sm) * 0.8);
  }

  onQueueDragStart(ev: DragEvent, t: PlannedTask): void {
    ev.dataTransfer?.setData('text/plain', t.id);
  }

  onBarDragStart(ev: DragEvent, t: PlannedTask): void {
    ev.dataTransfer?.setData('text/plain', t.id);
  }

  onDrop(ev: DragEvent, hour: number): void {
    ev.preventDefault();
    const id = ev.dataTransfer?.getData('text/plain');
    if (!id) return;
    const t = this.tasksForDay().find(x => x.id === id);
    const start = `${this.pad(hour)}:00`;
    let end: string;
    if (t?.startTime && t?.endTime) {
      const [sh, sm] = t.startTime.split(':').map(Number);
      const [eh, em] = t.endTime.split(':').map(Number);
      const durMin = eh*60+em - sh*60-sm;
      const totalEndMin = hour*60 + durMin;
      end = `${String(Math.floor(totalEndMin/60)%24).padStart(2,'0')}:${String(totalEndMin%60).padStart(2,'0')}`;
    } else {
      end = `${this.pad((hour+1) % 24)}:00`;
    }
    this.plannedTasks.update(id, { startTime: start, endTime: end, needsTimeSlot: true }).subscribe({
      next: () => this.reload(),
    });
  }

  requestSkip(t: PlannedTask): void {
    if (t.cadence === 'DAILY') {
      this.plannedTasks.addException(t.id, this.viewDate(), 'SKIP').subscribe({
        next: () => this.reload(),
      });
      return;
    }
    if (t.cadence === 'ONCE') {
      if (confirm(`Delete ${t.title}?`)) {
        this.plannedTasks.remove(t.id).subscribe({ next: () => this.reload() });
      }
      return;
    }
    this.plannedTasks.addException(t.id, this.viewDate(), 'SKIP').subscribe({
      next: () => {
        this.pendingSkipId.set(t.id);
        if (t.cadence === 'WEEKLY') {
          const weekday = new Date(this.viewDate()).toLocaleDateString(undefined, { weekday: 'long' });
          this.pendingPopupTitle.set(`Skip every ${weekday}'s ${t.title}?`);
          this.popupYesLabel.set('Yes, every week');
        } else {
          const dayOfMonth = new Date(this.viewDate()).getDate();
          this.pendingPopupTitle.set(`Skip ${t.title} every day ${dayOfMonth} of the month?`);
          this.popupYesLabel.set('Yes, every month');
        }
        this.reload();
      },
    });
  }

  onSkipYes(): void {
    const id = this.pendingSkipId();
    if (!id) return;
    const t = this.tasksForDay().find(x => x.id === id);
    if (!t) { this.dismissPopup(); return; }

    if (t.cadence === 'WEEKLY') {
      const dow = (new Date(this.viewDate()).getDay() + 6) % 7;
      const weekday = WEEKDAY_NAMES[dow];
      const newWeekdays = (t.weekdays ?? []).filter(d => d !== weekday);
      this.plannedTasks.applyPermanently(id, this.viewDate(), { weekdays: newWeekdays }).subscribe({
        next: () => { this.dismissPopup(); this.reload(); },
      });
    } else if (t.cadence === 'MONTHLY') {
      const day = new Date(this.viewDate()).getDate();
      const newDays = (t.monthDays ?? []).filter(d => d !== day);
      this.plannedTasks.applyPermanently(id, this.viewDate(), { monthDays: newDays }).subscribe({
        next: () => { this.dismissPopup(); this.reload(); },
      });
    } else {
      this.dismissPopup();
    }
  }

  onSkipNo(): void {
    this.dismissPopup();
  }

  private dismissPopup(): void {
    this.pendingSkipId.set(null);
    this.pendingPopupTitle.set('');
    this.popupYesLabel.set('');
  }

  private resizingTaskId: string | null = null;
  private resizeStartY = 0;
  private resizeStartEndTime: string | null = null;

  onResizeStart(ev: MouseEvent, t: PlannedTask): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.resizingTaskId = t.id;
    this.resizeStartY = ev.clientY;
    this.resizeStartEndTime = t.endTime ?? null;
    document.addEventListener('mousemove', this.onResizeMove);
    document.addEventListener('mouseup', this.onResizeEnd);
  }

  private onResizeMove = (_ev: MouseEvent) => {
    // Live preview omitted; only the final position is used.
  };

  private onResizeEnd = (ev: MouseEvent) => {
    const id = this.resizingTaskId;
    const startEnd = this.resizeStartEndTime;
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
    this.resizingTaskId = null;
    this.resizeStartEndTime = null;
    if (!id || !startEnd) return;

    const dy = ev.clientY - this.resizeStartY;
    const deltaMinutes = Math.round(dy / 0.8);
    if (deltaMinutes === 0) return;
    const t = this.tasksForDay().find(x => x.id === id);
    if (!t || !t.startTime) return;

    const [eh, em] = startEnd.split(':').map(Number);
    const totalEndMin = Math.min(23*60+59, Math.max(0, eh*60 + em + deltaMinutes));
    const newEnd = `${String(Math.floor(totalEndMin/60)).padStart(2,'0')}:${String(totalEndMin%60).padStart(2,'0')}`;
    if (newEnd <= t.startTime) return;

    this.plannedTasks.update(id, { endTime: newEnd }).subscribe({ next: () => this.reload() });
  };

  private shift(deltaDays: number): void {
    const d = new Date(this.viewDate());
    d.setDate(d.getDate() + deltaDays);
    this.viewDate.set(
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
    );
    this.reload();
  }

  private reload(): void {
    this.plannedTasks.loadForDate(this.viewDate()).subscribe({
      next: list => this.tasksForDay.set(list),
    });
  }
}
