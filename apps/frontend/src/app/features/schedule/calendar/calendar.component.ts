import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ScheduleService } from '../../../core/services/schedule.service';
import { BannerComponent } from '../../../shared/components/banner/banner.component';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, BannerComponent],
  template: `
    <div class="px-margin-page pt-stack-md pb-4">

      <!-- Unscheduled Tasks Banner -->
      <div *ngIf="showBanner && unscheduledCount() > 0" class="mb-stack-md">
        <app-banner
          [count]="unscheduledCount()"
          (dismissed)="dismissBanner()"
          (action)="goToSchedule()"
        />
      </div>

      <!-- Month Navigation -->
      <div class="flex items-center justify-between mb-stack-md">
        <button (click)="prevMonth()"
                class="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform">
          <span class="material-symbols-outlined text-on-surface">chevron_left</span>
        </button>
        <h2 class="font-manrope font-bold text-h2 text-on-surface">
          {{ monthLabel }}
        </h2>
        <button (click)="nextMonth()"
                class="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform">
          <span class="material-symbols-outlined text-on-surface">chevron_right</span>
        </button>
      </div>

      <!-- View Switcher -->
      <div class="flex gap-2 mb-stack-md bg-surface-container p-1 rounded-xl">
        <button *ngFor="let v of views"
                (click)="switchView(v.route)"
                class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                [class]="v.label === 'Month' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant'">
          {{ v.label }}
        </button>
      </div>

      <!-- Day Headers -->
      <div class="grid grid-cols-7 mb-2">
        <div *ngFor="let day of dayHeaders"
             class="text-center font-label-sm text-label-sm text-on-surface-variant py-1">
          {{ day }}
        </div>
      </div>

      <!-- Calendar Grid -->
      <div class="grid grid-cols-7 gap-0.5">
        <div *ngFor="let cell of calendarCells"
             (click)="selectDate(cell)"
             class="aspect-square flex flex-col items-center justify-start pt-1 rounded-xl cursor-pointer transition-all"
             [class]="cellClass(cell)">

          <span class="text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full"
                [class]="dayNumClass(cell)">
            {{ cell.day || '' }}
          </span>

          <!-- Event dots -->
          <div *ngIf="cell.day" class="flex gap-0.5 mt-0.5 flex-wrap justify-center max-w-[28px]">
            <span *ngFor="let evt of getEventsForDay(cell)"
                  class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  [style.background]="evt.color">
            </span>
          </div>
        </div>
      </div>

      <!-- Selected Day Events -->
      <div *ngIf="selectedDate" class="mt-stack-lg">
        <h3 class="font-manrope font-bold text-[18px] text-on-surface mb-stack-md">
          {{ selectedDate | date:'EEEE, MMMM d' }}
        </h3>
        <div *ngIf="selectedEvents.length === 0" class="text-on-surface-variant text-sm py-4 text-center">
          No events scheduled
        </div>
        <div class="flex flex-col gap-3">
          <div *ngFor="let evt of selectedEvents"
               class="bg-surface-container-lowest rounded-[16px] p-4 shadow-card flex items-center gap-4">
            <div class="w-1 h-10 rounded-full" [style.background]="evt.color"></div>
            <div class="flex-1">
              <h4 class="font-manrope font-semibold text-sm text-on-surface">{{ evt.title }}</h4>
              <p class="text-on-surface-variant text-xs mt-0.5">{{ evt.startTime }} – {{ evt.endTime }}</p>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase"
                  [class]="typeClass(evt.type)">
              {{ evt.type }}
            </span>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CalendarComponent implements OnInit {
  private scheduleService = inject(ScheduleService);
  private router = inject(Router);

  showBanner = true;
  selectedDate: Date | null = new Date();
  currentYear = new Date().getFullYear();
  currentMonth = new Date().getMonth();

  dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  views = [
    { label: 'Day', route: '/schedule' },
    { label: 'Week', route: '/schedule/week' },
    { label: 'Month', route: '/schedule/month' },
  ];

  unscheduledCount = computed(() => this.scheduleService.unscheduledTasks().length);

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

  get selectedEvents() {
    if (!this.selectedDate) return [];
    const dateStr = this.selectedDate.toISOString().split('T')[0];
    return this.scheduleService.getByDate(dateStr);
  }

  ngOnInit(): void {
    this.scheduleService.load();
  }

  getEventsForDay(cell: { day: number | null; date?: Date }) {
    if (!cell.date) return [];
    const dateStr = cell.date.toISOString().split('T')[0];
    return this.scheduleService.getByDate(dateStr).slice(0, 3);
  }

  selectDate(cell: { day: number | null; date?: Date }): void {
    if (cell.date) this.selectedDate = cell.date;
  }

  prevMonth(): void {
    if (this.currentMonth === 0) { this.currentMonth = 11; this.currentYear--; }
    else this.currentMonth--;
  }

  nextMonth(): void {
    if (this.currentMonth === 11) { this.currentMonth = 0; this.currentYear++; }
    else this.currentMonth++;
  }

  switchView(route: string): void {
    this.router.navigate([route]);
  }

  dismissBanner(): void {
    this.showBanner = false;
    this.scheduleService.dismissUnscheduledBanner();
  }

  goToSchedule(): void {
    this.router.navigate(['/schedule']);
  }

  cellClass(cell: { day: number | null; date?: Date }): string {
    if (!cell.day) return '';
    const isToday = cell.date?.toDateString() === new Date().toDateString();
    const isSelected = cell.date?.toDateString() === this.selectedDate?.toDateString();
    if (isSelected) return 'bg-primary/10';
    if (isToday) return 'bg-surface-container';
    return 'hover:bg-surface-container-low';
  }

  dayNumClass(cell: { day: number | null; date?: Date }): string {
    const isToday = cell.date?.toDateString() === new Date().toDateString();
    const isSelected = cell.date?.toDateString() === this.selectedDate?.toDateString();
    if (isSelected) return 'bg-primary text-white';
    if (isToday) return 'bg-primary/20 text-primary font-bold';
    return 'text-on-surface';
  }

  typeClass(type: string): string {
    return { task: 'bg-surface-container text-on-surface-variant', habit: 'bg-primary/10 text-primary', meeting: 'bg-secondary-fixed/30 text-secondary' }[type] || '';
  }
}
