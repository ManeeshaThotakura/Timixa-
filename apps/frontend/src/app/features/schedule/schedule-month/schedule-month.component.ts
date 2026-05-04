import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ScheduleService } from '../../../core/services/schedule.service';

@Component({
  selector: 'app-schedule-month',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="px-margin-page pt-stack-md pb-4">

      <div class="flex items-center justify-between mb-stack-md">
        <h1 class="font-manrope font-bold text-h2 text-on-surface">{{ monthLabel }}</h1>
        <div class="flex gap-2">
          <button (click)="prevMonth()" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform">
            <span class="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <button (click)="nextMonth()" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform">
            <span class="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>

      <!-- View Switcher -->
      <div class="flex gap-2 mb-stack-md bg-surface-container p-1 rounded-xl">
        <button *ngFor="let v of views"
                (click)="router.navigate([v.route])"
                class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                [class]="v.label === 'Month' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant'">
          {{ v.label }}
        </button>
      </div>

      <!-- Day Headers -->
      <div class="grid grid-cols-7 mb-2">
        <div *ngFor="let d of dayHeaders" class="text-center font-label-sm text-label-sm text-on-surface-variant py-1">{{ d }}</div>
      </div>

      <!-- Calendar Grid -->
      <div class="grid grid-cols-7 gap-0.5">
        <div *ngFor="let cell of calendarCells"
             (click)="cell.date && (selectedDate = cell.date)"
             class="aspect-square flex flex-col items-center justify-start pt-1 rounded-xl cursor-pointer transition-all hover:bg-surface-container-low"
             [class]="cellClass(cell)">
          <span class="text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full"
                [class]="dayNumClass(cell)">
            {{ cell.day || '' }}
          </span>
          <div *ngIf="cell.day" class="flex gap-0.5 mt-0.5 flex-wrap justify-center max-w-[28px]">
            <span *ngFor="let evt of getEventsForDay(cell)"
                  class="w-1.5 h-1.5 rounded-full"
                  [style.background]="evt.color"></span>
          </div>
        </div>
      </div>

      <!-- Selected Day Summary -->
      <div *ngIf="selectedDate && selectedDateEvents.length > 0" class="mt-stack-lg">
        <h3 class="font-manrope font-bold text-[18px] text-on-surface mb-3">{{ selectedDate | date:'EEEE, MMMM d' }}</h3>
        <div class="flex flex-col gap-2">
          <div *ngFor="let evt of selectedDateEvents"
               class="flex items-center gap-3 py-2 border-b border-outline-variant last:border-0">
            <div class="w-2 h-2 rounded-full flex-shrink-0" [style.background]="evt.color"></div>
            <span class="text-sm text-on-surface flex-1">{{ evt.title }}</span>
            <span class="text-xs text-on-surface-variant">{{ evt.startTime }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ScheduleMonthComponent implements OnInit {
  router = inject(Router);
  private scheduleService = inject(ScheduleService);

  currentYear = new Date().getFullYear();
  currentMonth = new Date().getMonth();
  selectedDate: Date | null = null;
  dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  views = [
    { label: 'Day', route: '/schedule' },
    { label: 'Week', route: '/schedule/week' },
    { label: 'Month', route: '/schedule/month' },
  ];

  get monthLabel(): string {
    return new Date(this.currentYear, this.currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  get calendarCells(): { day: number | null; date?: Date }[] {
    const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const cells: { day: number | null; date?: Date }[] = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, date: new Date(this.currentYear, this.currentMonth, d) });
    }
    return cells;
  }

  get selectedDateEvents() {
    if (!this.selectedDate) return [];
    return this.scheduleService.getByDate(this.selectedDate.toISOString().split('T')[0]);
  }

  ngOnInit(): void {
    this.scheduleService.load();
  }

  getEventsForDay(cell: { day: number | null; date?: Date }) {
    if (!cell.date) return [];
    return this.scheduleService.getByDate(cell.date.toISOString().split('T')[0]).slice(0, 3);
  }

  prevMonth(): void {
    if (this.currentMonth === 0) { this.currentMonth = 11; this.currentYear--; } else this.currentMonth--;
  }

  nextMonth(): void {
    if (this.currentMonth === 11) { this.currentMonth = 0; this.currentYear++; } else this.currentMonth++;
  }

  cellClass(cell: { day: number | null; date?: Date }): string {
    if (!cell.day) return '';
    const isSelected = cell.date?.toDateString() === this.selectedDate?.toDateString();
    const isToday = cell.date?.toDateString() === new Date().toDateString();
    if (isSelected) return 'bg-primary/10';
    if (isToday) return 'bg-surface-container';
    return '';
  }

  dayNumClass(cell: { day: number | null; date?: Date }): string {
    const isToday = cell.date?.toDateString() === new Date().toDateString();
    const isSelected = cell.date?.toDateString() === this.selectedDate?.toDateString();
    if (isSelected) return 'bg-primary text-white';
    if (isToday) return 'bg-primary/20 text-primary font-bold';
    return 'text-on-surface';
  }
}
