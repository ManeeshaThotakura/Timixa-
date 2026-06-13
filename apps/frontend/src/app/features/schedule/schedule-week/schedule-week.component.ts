import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { PlannedTaskService } from '../../../core/services/planned-task.service';
import { PlannedTask, Weekday } from '../../../core/models/planned-task.model';
import { ExceptionPopupComponent } from '../exception-popup.component';

const WEEKDAY_NAMES: Weekday[] = [
  'MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY',
];

function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function mondayOfThisWeek(): string {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return isoFromDate(d);
}

@Component({
  selector: 'app-schedule-week',
  standalone: true,
  imports: [CommonModule, ExceptionPopupComponent],
  template: `
    <div class="px-margin-page pt-stack-lg pb-4">
      <header class="flex items-center justify-between mb-stack-md">
        <button (click)="prev()" class="p-2 rounded-full hover:bg-surface-container" data-testid="week-prev">‹</button>
        <h2 class="font-manrope font-bold text-h2" data-testid="week-label">Week of {{ weekStart() }}</h2>
        <button (click)="next()" class="p-2 rounded-full hover:bg-surface-container" data-testid="week-next">›</button>
      </header>

      <section *ngIf="unscheduled().length" class="mb-stack-md" data-testid="week-unscheduled">
        <h3 class="font-semibold text-[14px] text-outline mb-2 uppercase">Needs a time slot</h3>
        <div class="flex gap-2 overflow-x-auto pb-2">
          <div *ngFor="let t of unscheduled()"
               class="flex-none w-40 p-3 rounded-[16px] bg-surface-container-lowest shadow-card cursor-grab"
               draggable="true"
               (dragstart)="onQueueDragStart($event, t)"
               [attr.data-testid]="'week-queue-' + t.id">
            <span class="w-2 h-2 rounded-full inline-block mr-2" [style.background]="t.color"></span>
            <span class="font-semibold text-on-surface">{{ t.title }}</span>
          </div>
        </div>
      </section>

      <section class="grid grid-cols-7 gap-1 bg-surface-container-lowest rounded-[20px] p-2 shadow-card">
        <div *ngFor="let date of weekDates(); let i = index"
             class="relative min-h-[400px] bg-surface-container/30 rounded-[12px]"
             (dragover)="$event.preventDefault()"
             (drop)="onDrop($event, date)"
             [attr.data-testid]="'week-col-' + date">
          <div class="sticky top-0 px-2 py-1 text-[11px] font-bold uppercase text-outline bg-surface-container-lowest border-b border-outline-variant/10">
            {{ dayLabel(date) }}
          </div>
          <div *ngFor="let t of tasksOn(date)"
               class="m-1 px-2 py-1 rounded-[8px] text-white text-[12px] font-semibold cursor-grab"
               [style.background]="t.color"
               draggable="true"
               (dragstart)="onBarDragStart($event, t, date)"
               [attr.data-testid]="'week-bar-' + t.id + '-' + date">
            {{ t.title }} <span class="font-normal">{{ t.startTime }}–{{ t.endTime }}</span>
          </div>
        </div>
      </section>
    </div>

    <app-exception-popup *ngIf="popupVisible()"
      [title]="popupTitle()"
      [yesLabel]="popupYesLabel()"
      noLabel="No, just this date"
      (yes)="onPopupYes()"
      (no)="onPopupNo()" />
  `,
})
export class ScheduleWeekComponent implements OnInit, OnDestroy {
  protected plannedTasks = inject(PlannedTaskService);

  weekStart = signal<string>(mondayOfThisWeek());
  tasksByDay = signal<Map<string, PlannedTask[]>>(new Map());

  popupVisible = signal(false);
  popupTitle = signal('');
  popupYesLabel = signal('');
  private pendingAction: (() => void) | null = null;

  weekDates = computed<string[]>(() => {
    const d = new Date(this.weekStart());
    return Array.from({length: 7}, (_, i) => {
      const x = new Date(d); x.setDate(d.getDate() + i); return isoFromDate(x);
    });
  });

  unscheduled = computed<PlannedTask[]>(() => {
    const seen = new Set<string>();
    const out: PlannedTask[] = [];
    for (const list of this.tasksByDay().values()) {
      for (const t of list) {
        if (t.needsTimeSlot && !t.startTime && !seen.has(t.id)) {
          seen.add(t.id); out.push(t);
        }
      }
    }
    return out;
  });

  ngOnInit(): void { this.reload(); }
  ngOnDestroy(): void {}

  prev(): void { this.shift(-7); }
  next(): void { this.shift(+7); }

  dayLabel(date: string): string {
    return new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  tasksOn(date: string): PlannedTask[] {
    return (this.tasksByDay().get(date) ?? []).filter(t => !!t.startTime)
      .sort((a, b) => (a.startTime! < b.startTime! ? -1 : 1));
  }

  onQueueDragStart(ev: DragEvent, t: PlannedTask): void {
    ev.dataTransfer?.setData('text/plain', JSON.stringify({ id: t.id, fromDate: null }));
  }

  onBarDragStart(ev: DragEvent, t: PlannedTask, fromDate: string): void {
    ev.dataTransfer?.setData('text/plain', JSON.stringify({ id: t.id, fromDate }));
  }

  onDrop(ev: DragEvent, toDate: string): void {
    ev.preventDefault();
    const raw = ev.dataTransfer?.getData('text/plain');
    if (!raw) return;
    let payload: { id: string; fromDate: string | null };
    try { payload = JSON.parse(raw); } catch { return; }

    const t = [...this.tasksByDay().values()].flat().find(x => x.id === payload.id);
    if (!t) return;

    if (payload.fromDate && payload.fromDate !== toDate) {
      this.onCrossDayDrop(t, payload.fromDate, toDate);
    } else if (!payload.fromDate) {
      this.onQueueDrop(t, toDate);
    }
  }

  onQueueDrop(t: PlannedTask, toDate: string): void {
    const start = '09:00', end = '10:00';
    this.plannedTasks.update(t.id, { startTime: start, endTime: end, needsTimeSlot: true }).subscribe({
      next: () => {
        const covered = this.dateCovered(t, toDate);
        if (covered) {
          this.reload();
        } else {
          this.plannedTasks.addException(t.id, toDate, 'ADD').subscribe({
            next: () => {
              this.openPermanentPopup(t, toDate);
              this.reload();
            },
          });
        }
      },
    });
  }

  onCrossDayDrop(t: PlannedTask, fromDate: string, toDate: string): void {
    this.plannedTasks.addException(t.id, fromDate, 'SKIP').subscribe({
      next: () => this.plannedTasks.addException(t.id, toDate, 'ADD').subscribe({
        next: () => {
          this.openMovePopup(t, fromDate, toDate);
          this.reload();
        },
      }),
    });
  }

  private dateCovered(t: PlannedTask, dateIso: string): boolean {
    const d = new Date(dateIso);
    if (t.cadence === 'DAILY') return true;
    if (t.cadence === 'WEEKLY') {
      const dow = WEEKDAY_NAMES[(d.getDay() + 6) % 7];
      return (t.weekdays ?? []).includes(dow);
    }
    if (t.cadence === 'MONTHLY') {
      return (t.monthDays ?? []).includes(d.getDate());
    }
    return t.scheduledDate === dateIso;
  }

  private openPermanentPopup(t: PlannedTask, addedDate: string): void {
    const wd = WEEKDAY_NAMES[(new Date(addedDate).getDay() + 6) % 7];
    const friendly = wd.charAt(0) + wd.slice(1).toLowerCase();
    this.popupTitle.set(`Add ${friendly} to every week's ${t.title}?`);
    this.popupYesLabel.set('Yes, every week');
    this.pendingAction = () => {
      const newWeekdays = [...(t.weekdays ?? []), wd] as Weekday[];
      this.plannedTasks.applyPermanently(t.id, addedDate, { weekdays: newWeekdays }).subscribe({
        next: () => { this.closePopup(); this.reload(); },
      });
    };
    this.popupVisible.set(true);
  }

  private openMovePopup(t: PlannedTask, fromDate: string, toDate: string): void {
    const fromWd = WEEKDAY_NAMES[(new Date(fromDate).getDay() + 6) % 7];
    const toWd   = WEEKDAY_NAMES[(new Date(toDate).getDay() + 6) % 7];
    const friendly = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
    this.popupTitle.set(`Move ${t.title} from ${friendly(fromWd)} to ${friendly(toWd)} every week?`);
    this.popupYesLabel.set('Yes, every week');
    this.pendingAction = () => {
      this.plannedTasks.removeException(t.id, toDate).subscribe({
        next: () => this.plannedTasks.applyPermanently(t.id, fromDate, {
          weekdays: ([...(t.weekdays ?? [])].filter(d => d !== fromWd).concat(toWd)) as Weekday[],
        }).subscribe({
          next: () => { this.closePopup(); this.reload(); },
        }),
      });
    };
    this.popupVisible.set(true);
  }

  onPopupYes(): void { this.pendingAction?.(); }
  onPopupNo(): void { this.closePopup(); this.reload(); }

  private closePopup(): void {
    this.popupVisible.set(false);
    this.popupTitle.set('');
    this.popupYesLabel.set('');
    this.pendingAction = null;
  }

  private shift(deltaDays: number): void {
    const d = new Date(this.weekStart());
    d.setDate(d.getDate() + deltaDays);
    this.weekStart.set(isoFromDate(d));
    this.reload();
  }

  private reload(): void {
    this.plannedTasks.loadForWeek(this.weekStart()).subscribe({
      next: map => this.tasksByDay.set(map),
    });
  }
}
