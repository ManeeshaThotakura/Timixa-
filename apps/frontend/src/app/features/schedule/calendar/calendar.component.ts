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
      <!-- Day | Week toggle -->
      <div class="flex bg-surface-container rounded-full p-1 mb-stack-md">
        <button (click)="setView('day')"
                class="flex-1 py-1.5 rounded-full text-[13px] font-semibold transition-all"
                [class.bg-surface-container-lowest]="view() === 'day'"
                [class.shadow-sm]="view() === 'day'"
                [class.text-on-surface]="view() === 'day'"
                [class.text-on-surface-variant]="view() !== 'day'"
                data-testid="cal-tab-day">Day</button>
        <button (click)="setView('week')"
                class="flex-1 py-1.5 rounded-full text-[13px] font-semibold transition-all"
                [class.bg-surface-container-lowest]="view() === 'week'"
                [class.shadow-sm]="view() === 'week'"
                [class.text-on-surface]="view() === 'week'"
                [class.text-on-surface-variant]="view() !== 'week'"
                data-testid="cal-tab-week">Week</button>
      </div>

      <header class="flex items-center justify-between mb-stack-md">
        <button (click)="prev()" class="p-2 rounded-full hover:bg-surface-container" data-testid="cal-prev">‹</button>
        <h2 class="font-manrope font-bold text-h2" data-testid="cal-label">{{ label() }}</h2>
        <button (click)="next()" class="p-2 rounded-full hover:bg-surface-container" data-testid="cal-next">›</button>
      </header>

      <!-- ── Day read-only view ─────────────────────────────── -->
      <ng-container *ngIf="view() === 'day'">
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

        <!-- Any-time tasks (no slot required) -->
        <section *ngIf="anytime().length" class="mb-stack-md" data-testid="cal-anytime">
          <p class="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-widest mb-2">Any time</p>
          <div class="flex gap-2 overflow-x-auto pb-1" style="-ms-overflow-style:none;scrollbar-width:none;">
            <div *ngFor="let t of anytime()"
                 class="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-full border"
                 [style.background]="t.completedToday ? 'rgba(46,125,50,0.08)' : '#ffffff'"
                 [style.borderColor]="t.completedToday ? 'rgba(46,125,50,0.35)' : 'rgba(120,117,136,0.25)'"
                 [attr.data-testid]="'cal-anytime-' + t.id">
              <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" [style.background]="t.color"></span>
              <span class="text-[13px] font-semibold text-on-surface whitespace-nowrap"
                    [class.line-through]="t.completedToday">{{ t.title }}</span>
              <span *ngIf="t.completedToday" class="material-symbols-outlined text-[16px]" style="color:#2e7d32;">check_circle</span>
            </div>
          </div>
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
      </ng-container>

      <!-- ── Week read-only view ─────────────────────────────── -->
      <ng-container *ngIf="view() === 'week'">

        <!-- 7-column time grid -->
        <section class="relative bg-surface-container-lowest rounded-[20px] overflow-hidden shadow-card"
                 data-testid="cal-week-grid">
          <!-- Single scroll container so header, any-time row, and body stay column-aligned -->
          <div class="overflow-x-auto" style="scrollbar-width:none;">
            <div style="min-width: calc(40px + 7 * 80px);">

              <!-- Day header row -->
              <div class="flex border-b border-outline-variant/10">
                <div class="w-10 flex-shrink-0"></div>
                <div *ngFor="let day of weekDays()"
                     class="flex-1 min-w-[80px] text-center py-2 border-l border-outline-variant/10"
                     [style.background]="day.isToday ? 'rgba(94,67,251,0.06)' : ''"
                     [attr.data-testid]="'cal-week-col-' + day.dateStr">
                  <p class="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                    {{ day.shortDay }}
                  </p>
                  <p class="text-[13px] font-bold"
                     [class.text-primary]="day.isToday"
                     [class.text-on-surface]="!day.isToday">
                    {{ day.dateStr.slice(8) }}
                  </p>
                </div>
              </div>

              <!-- Any-time row: no-slot tasks per day, above 00:00 -->
              <div *ngIf="weekHasAnytime()" class="flex border-b border-outline-variant/10"
                   data-testid="cal-week-anytime">
                <div class="w-10 flex-shrink-0 pt-1 px-1 text-[8px] font-bold uppercase text-outline leading-tight">
                  Any time
                </div>
                <div *ngFor="let day of weekDays()"
                     class="flex-1 min-w-[80px] border-l border-outline-variant/10 p-0.5 flex flex-col gap-0.5"
                     [style.background]="day.isToday ? 'rgba(94,67,251,0.03)' : ''"
                     [attr.data-testid]="'cal-week-anytime-' + day.dateStr">
                  <div *ngFor="let t of weekAnytimeFor(day.dateStr)"
                       class="rounded-md px-1.5 py-0.5 border-l-2 overflow-hidden"
                       [style.background]="t.completedToday ? 'rgba(46,125,50,0.10)' : 'rgba(228,223,255,0.45)'"
                       [style.borderLeftColor]="t.color"
                       [attr.title]="t.title">
                    <span class="text-[10px] font-bold truncate leading-tight text-on-surface block"
                          [class.line-through]="t.completedToday">{{ t.title }}</span>
                  </div>
                </div>
              </div>

              <!-- Grid body -->
              <div class="flex">

              <!-- Hour labels gutter -->
              <div class="w-10 flex-shrink-0">
                <div *ngFor="let h of hours" class="relative h-12 border-t border-outline-variant/10">
                  <span class="absolute left-1 top-0.5 text-[9px] text-outline leading-none">{{ pad(h) }}</span>
                </div>
              </div>

              <!-- Day columns -->
              <div *ngFor="let day of weekDays()"
                   class="flex-1 min-w-[80px] relative"
                   [style.background]="day.isToday ? 'rgba(94,67,251,0.03)' : ''">
                <!-- Hour rows (grid lines) -->
                <div *ngFor="let h of hours" class="h-12 border-t border-l border-outline-variant/10"></div>

                <!-- Bars -->
                <div *ngFor="let b of weekBarsFor(day.dateStr); trackBy: trackBar"
                     class="absolute left-0.5 right-0.5 rounded-[8px] px-1.5 py-0.5 overflow-hidden border-l-2 flex flex-col justify-center gap-0.5"
                     style="background:rgba(228,223,255,0.45);"
                     [style.borderLeftColor]="b.color"
                     [style.top.px]="topPx(b)"
                     [style.height.px]="heightPx(b)"
                     [attr.title]="b.title + ' · ' + b.startTime + '–' + b.endTime"
                     [attr.data-testid]="'cal-week-bar-' + b.taskId">
                  <span class="text-[10px] font-bold truncate leading-tight text-on-surface">{{ b.title }}</span>
                  <span class="text-[8px] leading-tight truncate opacity-70" [style.color]="b.color">
                    {{ b.startTime }}–{{ b.endTime }}
                  </span>
                </div>
              </div>

              </div><!-- /grid body flex -->
            </div><!-- /min-width -->
          </div><!-- /overflow-x-auto -->
        </section>

      </ng-container>
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
  view = signal<'day' | 'week'>('day');
  tasksForDay = signal<PlannedTask[]>([]);
  tasksByWeek = signal<Map<string, PlannedTask[]>>(new Map());
  hours = Array.from({length: 24}, (_, i) => i);

  readonly bars = computed<CalBar[]>(() => this.buildBars(this.tasksForDay()));

  readonly unscheduled = computed(() =>
    this.tasksForDay().filter(t =>
      t.needsTimeSlot && !t.startTime
        && (t.segmentsForDate?.length ?? 0) === 0
        && (t.patternForDate?.length ?? 0) === 0,
    ),
  );

  readonly anytime = computed(() =>
    this.tasksForDay().filter(
      t => !t.needsTimeSlot && (t.segmentsForDate?.length ?? 0) === 0 && (t.patternForDate?.length ?? 0) === 0,
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

  readonly weekStart = computed<string>(() => {
    const d = new Date(this.viewDate() + 'T00:00:00');
    const day = d.getDay(); // 0=Sun
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });

  readonly weekDays = computed<{dateStr: string; label: string; shortDay: string; isToday: boolean}[]>(() => {
    const todayStr = todayIso();
    const start = new Date(this.weekStart() + 'T00:00:00');
    return Array.from({length: 7}, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const shortDay = d.toLocaleDateString(undefined, { weekday: 'short' });
      const label = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
      return { dateStr, label, shortDay, isToday: dateStr === todayStr };
    });
  });

  readonly weekLabel = computed<string>(() => {
    const days = this.weekDays();
    const first = new Date(days[0].dateStr + 'T00:00:00');
    const last  = new Date(days[6].dateStr + 'T00:00:00');
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${fmt(first)} – ${fmt(last)}`;
  });

  readonly label = computed(() =>
    this.view() === 'week'
      ? this.weekLabel()
      : new Date(this.viewDate() + 'T00:00:00')
          .toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
  );

  ngOnInit(): void {
    const dateParam = this.route.snapshot.queryParamMap.get('date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      this.viewDate.set(dateParam);
    }
    const viewParam = this.route.snapshot.queryParamMap.get('view');
    if (viewParam === 'week') this.view.set('week');
    this.reload();
  }

  setView(v: 'day' | 'week'): void {
    this.view.set(v);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: v, date: this.viewDate() },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.reload();
  }

  prev(): void {
    this.view() === 'week' ? this.shiftWeek(-1) : this.shift(-1);
  }

  next(): void {
    this.view() === 'week' ? this.shiftWeek(+1) : this.shift(+1);
  }

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

  weekBarsFor(dateStr: string): CalBar[] {
    return this.buildBars(this.tasksByWeek().get(dateStr) ?? []);
  }

  weekAnytimeFor(dateStr: string): PlannedTask[] {
    return (this.tasksByWeek().get(dateStr) ?? []).filter(
      t => !t.needsTimeSlot
        && (t.segmentsForDate?.length ?? 0) === 0
        && (t.patternForDate?.length ?? 0) === 0
        && !t.startTime,
    );
  }

  weekHasAnytime(): boolean {
    return this.weekDays().some(d => this.weekAnytimeFor(d.dateStr).length > 0);
  }

  goSchedule(): void {
    if (this.view() === 'week') {
      this.router.navigate(['/schedule/week'], { queryParams: { date: this.weekStart() } });
    } else {
      this.router.navigate(['/schedule'], { queryParams: { date: this.viewDate() } });
    }
  }

  private buildBars(tasks: PlannedTask[]): CalBar[] {
    const out: CalBar[] = [];
    for (const t of tasks) {
      const segs = t.segmentsForDate ?? [];
      const pattern = t.patternForDate ?? [];
      if (segs.length > 0) {
        for (const s of segs) {
          out.push({
            key: s.id, taskId: t.id, title: t.title, color: t.color,
            startTime: s.startTime, endTime: s.endTime,
          });
        }
      } else if (pattern.length > 0) {
        for (const p of pattern) {
          out.push({
            key: `${t.id}-${p.startTime}`, taskId: t.id, title: t.title, color: t.color,
            startTime: p.startTime, endTime: p.endTime,
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
  }

  private shift(deltaDays: number): void {
    const d = new Date(this.viewDate() + 'T00:00:00');
    d.setDate(d.getDate() + deltaDays);
    this.viewDate.set(
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
    );
    this.reload();
  }

  private shiftWeek(deltaWeeks: number): void {
    const d = new Date(this.weekStart() + 'T00:00:00');
    d.setDate(d.getDate() + deltaWeeks * 7);
    this.viewDate.set(
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
    );
    this.reload();
  }

  private reload(): void {
    if (this.view() === 'week') {
      this.plannedTasks.loadForWeek(this.weekStart()).subscribe({
        next: map => this.tasksByWeek.set(map),
      });
    } else {
      this.plannedTasks.loadForDate(this.viewDate()).subscribe({
        next: list => this.tasksForDay.set(list),
      });
    }
  }
}
