import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ScheduleService } from '../../../core/services/schedule.service';

@Component({
  selector: 'app-schedule-week',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="px-margin-page pt-stack-md pb-4">

      <div class="flex items-center justify-between mb-stack-md">
        <div>
          <h1 class="font-manrope font-bold text-h2 text-on-surface">Week View</h1>
          <p class="text-on-surface-variant text-xs mt-0.5">{{ weekLabel }}</p>
        </div>
        <div class="flex gap-2">
          <button (click)="prevWeek()" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform">
            <span class="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <button (click)="nextWeek()" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform">
            <span class="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>

      <!-- View Switcher -->
      <div class="flex gap-2 mb-stack-md bg-surface-container p-1 rounded-xl">
        <button *ngFor="let v of views"
                (click)="router.navigate([v.route])"
                class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                [class]="v.label === 'Week' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant'">
          {{ v.label }}
        </button>
      </div>

      <!-- Week Days -->
      <div class="grid grid-cols-7 gap-1 mb-4">
        <div *ngFor="let day of weekDays"
             class="flex flex-col items-center gap-1 cursor-pointer"
             (click)="selectedDay = day.date">
          <span class="font-label-sm text-label-sm text-on-surface-variant">{{ day.dayName }}</span>
          <span class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
                [class]="isSelectedDay(day.date) ? 'bg-primary text-white' : isToday(day.date) ? 'bg-primary/20 text-primary font-bold' : 'text-on-surface'">
            {{ day.dayNum }}
          </span>
          <div class="flex gap-0.5">
            <span *ngFor="let _ of getEventDots(day.date)"
                  class="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
          </div>
        </div>
      </div>

      <!-- Events for selected day -->
      <div class="flex flex-col gap-3">
        <div *ngIf="selectedDayEvents.length === 0" class="text-on-surface-variant text-sm py-4 text-center">
          No events for this day
        </div>
        <div *ngFor="let evt of selectedDayEvents"
             class="bg-surface-container-lowest rounded-[16px] p-4 shadow-card flex items-center gap-4">
          <div class="w-1 h-10 rounded-full flex-shrink-0" [style.background]="evt.color"></div>
          <div class="flex-1">
            <h4 class="font-manrope font-semibold text-sm text-on-surface">{{ evt.title }}</h4>
            <p class="text-on-surface-variant text-xs mt-0.5">{{ evt.startTime }} – {{ evt.endTime }}</p>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-surface-container text-on-surface-variant">
            {{ evt.type }}
          </span>
        </div>
      </div>
    </div>
  `,
})
export class ScheduleWeekComponent implements OnInit {
  router = inject(Router);
  private scheduleService = inject(ScheduleService);

  weekStart = this.getWeekStart(new Date());
  selectedDay = new Date();

  views = [
    { label: 'Day', route: '/schedule' },
    { label: 'Week', route: '/schedule/week' },
    { label: 'Month', route: '/schedule/month' },
  ];

  get weekDays() {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(this.weekStart);
      d.setDate(d.getDate() + i);
      return {
        date: d,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
      };
    });
  }

  get weekLabel(): string {
    const end = new Date(this.weekStart);
    end.setDate(end.getDate() + 6);
    return `${this.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }

  get selectedDayEvents() {
    return this.scheduleService.getByDate(this.selectedDay.toISOString().split('T')[0]);
  }

  ngOnInit(): void {
    this.scheduleService.load();
  }

  getEventDots(date: Date) {
    const events = this.scheduleService.getByDate(date.toISOString().split('T')[0]);
    return events.slice(0, 3);
  }

  isSelectedDay(date: Date): boolean {
    return date.toDateString() === this.selectedDay.toDateString();
  }

  isToday(date: Date): boolean {
    return date.toDateString() === new Date().toDateString();
  }

  getWeekStart(date: Date): Date {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    return d;
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
}
