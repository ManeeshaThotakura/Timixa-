import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PlannedTaskService } from '../../../core/services/planned-task.service';
import { PlannedTask } from '../../../core/models/planned-task.model';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// A read-only bar: template times or one per-date segment.
interface CalBar {
  key: string;
  taskId: string;
  title: string;
  color: string;
  startTime: string;
  endTime: string;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="px-margin-page pt-stack-lg pb-28">
      <header class="flex items-center justify-between mb-stack-md">
        <button (click)="prev()" class="p-2 rounded-full hover:bg-surface-container" data-testid="cal-prev">‹</button>
        <h2 class="font-manrope font-bold text-h2" data-testid="cal-label">{{ label() }}</h2>
        <button (click)="next()" class="p-2 rounded-full hover:bg-surface-container" data-testid="cal-next">›</button>
      </header>

      <!-- Conflict banner -->
      <section *ngIf="conflictCount() > 0" class="mb-stack-md p-4 rounded-[16px]"
               style="background:rgba(186,26,26,0.08); border:1px solid rgba(186,26,26,0.25);"
               data-testid="cal-conflict-banner">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[20px]" style="color:#ba1a1a;">warning</span>
          <p class="font-semibold" style="color:#ba1a1a;">
            {{ conflictCount() }} time {{ conflictCount() === 1 ? 'conflict' : 'conflicts' }} on this day
          </p>
        </div>
        <button (click)="goSchedule()" class="btn-primary mt-3 px-4 py-2" data-testid="cal-resolve-now">
          Resolve now
        </button>
      </section>

      <!-- Unscheduled banner -->
      <section *ngIf="unscheduled().length" class="mb-stack-md p-4 rounded-[16px]"
               style="background:rgba(255,209,102,0.18); border:1px solid rgba(255,179,0,0.4);"
               data-testid="cal-unscheduled-banner">
        <p class="font-semibold text-on-surface">
          {{ unscheduled().length }} task{{ unscheduled().length === 1 ? '' : 's' }} need a time slot
        </p>
        <button (click)="goSchedule()" class="btn-primary mt-3 px-4 py-2" data-testid="cal-open-schedule">
          Schedule now
        </button>
      </section>

      <!-- Read-only time grid -->
      <section class="relative bg-surface-container-lowest rounded-[20px] p-0 shadow-card overflow-hidden">
        <div *ngFor="let h of hours" class="relative h-12 border-t border-outline-variant/10">
          <span class="absolute left-2 top-1 text-[11px] text-outline">{{ pad(h) }}:00</span>
        </div>
        <div *ngFor="let b of bars(); trackBy: trackBar"
             class="absolute left-12 right-2 rounded-[12px] px-2 py-1 text-white text-[13px] font-semibold overflow-hidden"
             [style.top.px]="topPx(b)"
             [style.height.px]="heightPx(b)"
             [style.background]="b.color"
             [attr.title]="b.title + ' · ' + b.startTime + '–' + b.endTime"
             [attr.data-testid]="'cal-bar-' + b.taskId">
          {{ b.title }} <span class="font-normal">{{ b.startTime }}–{{ b.endTime }}</span>
        </div>
      </section>
    </div>

    <!-- Footer Edit -->
    <div class="fixed inset-x-0 bottom-24 z-40 flex justify-center pointer-events-none">
      <button type="button"
              (click)="goSchedule()"
              class="pointer-events-auto flex items-center gap-2 px-6 py-3 rounded-full text-white font-semibold active:scale-95 transition-all"
              style="background:linear-gradient(135deg,#451de3,#00c1fd); box-shadow:0 8px 24px rgba(69,29,227,0.3);"
              data-testid="cal-edit">
        <span class="material-symbols-outlined text-[18px]">edit</span>
        Edit schedule
      </button>
    </div>
  `,
})
export class CalendarComponent implements OnInit {
  private plannedTasks = inject(PlannedTaskService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  viewDate = signal<string>(todayIso());
  tasksForDay = signal<PlannedTask[]>([]);
  hours = Array.from({length: 24}, (_, i) => i);

  readonly bars = computed<CalBar[]>(() => {
    const out: CalBar[] = [];
    for (const t of this.tasksForDay()) {
      const segs = t.segmentsForDate ?? [];
      if (segs.length > 0) {
        for (const s of segs) {
          out.push({
            key: s.id, taskId: t.id, title: t.title, color: t.color,
            startTime: s.startTime, endTime: s.endTime,
          });
        }
      } else if (t.startTime && t.endTime) {
        out.push({
          key: t.id, taskId: t.id, title: t.title, color: t.color,
          startTime: t.startTime, endTime: t.endTime,
        });
      }
    }
    return out.sort((a, b) => (a.startTime < b.startTime ? -1 : 1));
  });

  readonly unscheduled = computed(() =>
    this.tasksForDay().filter(t =>
      t.needsTimeSlot && !t.startTime && (t.segmentsForDate?.length ?? 0) === 0,
    ),
  );

  readonly conflictCount = computed(() => {
    const list = this.bars();
    let conflicts = 0;
    let prevEnd = '';
    for (const b of list) {
      if (prevEnd && b.startTime < prevEnd) conflicts++;
      if (!prevEnd || b.endTime > prevEnd) prevEnd = b.endTime;
    }
    return conflicts;
  });

  readonly label = computed(() =>
    new Date(this.viewDate() + 'T00:00:00')
      .toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
  );

  ngOnInit(): void {
    const dateParam = this.route.snapshot.queryParamMap.get('date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      this.viewDate.set(dateParam);
    }
    this.reload();
  }

  prev(): void { this.shift(-1); }
  next(): void { this.shift(+1); }
  pad(n: number): string { return String(n).padStart(2, '0'); }
  trackBar(_: number, b: CalBar): string { return b.key; }

  topPx(b: CalBar): number {
    const [h, m] = b.startTime.split(':').map(Number);
    return (h * 60 + m) * 0.8;
  }

  heightPx(b: CalBar): number {
    const [sh, sm] = b.startTime.split(':').map(Number);
    const [eh, em] = b.endTime.split(':').map(Number);
    return Math.max(20, (eh*60+em - sh*60-sm) * 0.8);
  }

  goSchedule(): void {
    this.router.navigate(['/schedule'], { queryParams: { date: this.viewDate() } });
  }

  private shift(deltaDays: number): void {
    const d = new Date(this.viewDate() + 'T00:00:00');
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
