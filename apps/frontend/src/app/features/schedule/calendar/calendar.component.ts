import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlannedTaskService } from '../../../core/services/planned-task.service';
import { PlannedTask } from '../../../core/models/planned-task.model';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="px-margin-page pt-stack-lg pb-4">
      <header class="flex items-center justify-between mb-stack-md">
        <button (click)="prev()" class="p-2 rounded-full hover:bg-surface-container" data-testid="cal-prev">‹</button>
        <h2 class="font-manrope font-bold text-h2" data-testid="cal-label">{{ label() }}</h2>
        <button (click)="next()" class="p-2 rounded-full hover:bg-surface-container" data-testid="cal-next">›</button>
      </header>

      <section *ngIf="unscheduled().length" class="mb-stack-md p-4 rounded-[16px]"
               style="background:rgba(255,209,102,0.18); border:1px solid rgba(255,179,0,0.4);"
               data-testid="cal-unscheduled-banner">
        <p class="font-semibold text-on-surface">
          {{ unscheduled().length }} task{{ unscheduled().length === 1 ? '' : 's' }} need a time slot today
        </p>
        <button (click)="goSchedule()" class="btn-primary mt-3 px-4 py-2" data-testid="cal-open-schedule">Open today's schedule</button>
      </section>

      <section class="relative bg-surface-container-lowest rounded-[20px] p-0 shadow-card overflow-hidden">
        <div *ngFor="let h of hours" class="relative h-12 border-t border-outline-variant/10">
          <span class="absolute left-2 top-1 text-[11px] text-outline">{{ pad(h) }}:00</span>
        </div>
        <div *ngFor="let t of scheduled()"
             class="absolute left-12 right-2 rounded-[12px] px-2 py-1 text-white text-[13px] font-semibold"
             [style.top.px]="topPx(t)"
             [style.height.px]="heightPx(t)"
             [style.background]="t.color"
             [attr.data-testid]="'cal-bar-' + t.id">
          {{ t.title }} <span class="font-normal">{{ t.startTime }}–{{ t.endTime }}</span>
        </div>
      </section>
    </div>
  `,
})
export class CalendarComponent implements OnInit {
  private plannedTasks = inject(PlannedTaskService);
  private router = inject(Router);

  viewDate = signal<string>(todayIso());
  tasksForDay = signal<PlannedTask[]>([]);
  hours = Array.from({length: 24}, (_, i) => i);

  unscheduled = computed(() => this.tasksForDay().filter(t => t.needsTimeSlot && !t.startTime));
  scheduled   = computed(() => this.tasksForDay().filter(t => !!t.startTime));

  label = computed(() => new Date(this.viewDate()).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));

  ngOnInit(): void { this.reload(); }

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
  goSchedule(): void { this.router.navigateByUrl('/schedule'); }

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
