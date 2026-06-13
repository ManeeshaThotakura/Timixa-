import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { PlannedTaskService } from '../../../core/services/planned-task.service';
import { PlannedTask } from '../../../core/models/planned-task.model';

function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

@Component({
  selector: 'app-schedule-month',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="px-margin-page pt-stack-lg pb-4">
      <header class="flex items-center justify-between mb-stack-md">
        <button (click)="prev()" class="p-2 rounded-full hover:bg-surface-container" data-testid="month-prev">‹</button>
        <h2 class="font-manrope font-bold text-h2" data-testid="month-label">{{ label() }}</h2>
        <button (click)="next()" class="p-2 rounded-full hover:bg-surface-container" data-testid="month-next">›</button>
      </header>
      <div class="grid grid-cols-7 gap-1">
        <div *ngFor="let date of monthDates(); let i = index"
             class="aspect-square p-1 rounded-[12px] bg-surface-container-lowest cursor-pointer"
             [attr.data-testid]="'month-cell-' + date"
             (click)="selectedDate.set(date)">
          <div class="text-[12px] font-bold text-on-surface">{{ dayNumber(date) }}</div>
          <div class="flex gap-0.5 mt-1 flex-wrap">
            <span *ngFor="let t of tasksOn(date)"
                  class="w-1.5 h-1.5 rounded-full"
                  [style.background]="t.color"></span>
          </div>
        </div>
      </div>
      <div *ngIf="selectedDate() as d" class="mt-stack-md p-4 rounded-[16px] bg-surface-container-lowest shadow-card" data-testid="month-selected">
        <h3 class="font-bold text-on-surface mb-2">{{ d }}</h3>
        <div *ngFor="let t of tasksOn(d)" class="flex items-center gap-2 py-1">
          <span class="w-3 h-3 rounded-full" [style.background]="t.color"></span>
          <span class="font-semibold text-on-surface">{{ t.title }}</span>
          <span *ngIf="t.startTime" class="text-sm text-on-surface-variant">{{ t.startTime }}–{{ t.endTime }}</span>
        </div>
        <p *ngIf="!tasksOn(d).length" class="text-sm text-outline">No tasks on this day.</p>
      </div>
    </div>
  `,
})
export class ScheduleMonthComponent implements OnInit {
  private plannedTasks = inject(PlannedTaskService);

  monthStart = signal<string>((() => {
    const d = new Date(); d.setDate(1); return isoFromDate(d);
  })());

  selectedDate = signal<string | null>(null);
  tasksByDay = signal<Map<string, PlannedTask[]>>(new Map());

  label = computed(() => new Date(this.monthStart()).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));

  monthDates = computed<string[]>(() => {
    const start = new Date(this.monthStart());
    const targetMonth = start.getMonth();
    const days: string[] = [];
    const d = new Date(start);
    while (d.getMonth() === targetMonth) {
      days.push(isoFromDate(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  });

  ngOnInit(): void { this.reload(); }

  prev(): void {
    const d = new Date(this.monthStart()); d.setMonth(d.getMonth() - 1); d.setDate(1);
    this.monthStart.set(isoFromDate(d)); this.selectedDate.set(null); this.reload();
  }
  next(): void {
    const d = new Date(this.monthStart()); d.setMonth(d.getMonth() + 1); d.setDate(1);
    this.monthStart.set(isoFromDate(d)); this.selectedDate.set(null); this.reload();
  }

  dayNumber(date: string): number { return new Date(date).getDate(); }

  tasksOn(date: string): PlannedTask[] {
    return this.tasksByDay().get(date) ?? [];
  }

  private reload(): void {
    const dates = this.monthDates();
    const calls: { [date: string]: Observable<PlannedTask[]> } = {};
    for (const iso of dates) calls[iso] = this.plannedTasks.loadForDate(iso);
    forkJoin(calls).subscribe({
      next: (map: { [date: string]: PlannedTask[] }) =>
        this.tasksByDay.set(new Map<string, PlannedTask[]>(Object.entries(map))),
    });
  }
}
