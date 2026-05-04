import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ScheduleService } from '../../../core/services/schedule.service';
import { ScheduledEvent } from '../../../core/models/schedule.model';

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

@Component({
  selector: 'app-schedule-day',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="px-margin-page pt-stack-md pb-4">

      <!-- Header + Nav -->
      <div class="flex items-center justify-between mb-stack-md">
        <div>
          <h1 class="font-manrope font-bold text-h2 text-on-surface">Schedule</h1>
          <p class="text-on-surface-variant text-xs mt-0.5">{{ dateLabel }}</p>
        </div>
        <div class="flex gap-2">
          <button (click)="prevDay()" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform">
            <span class="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <button (click)="nextDay()" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform">
            <span class="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>

      <!-- View Switcher -->
      <div class="flex gap-2 mb-stack-md bg-surface-container p-1 rounded-xl">
        <button *ngFor="let v of views"
                (click)="router.navigate([v.route])"
                class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                [class]="v.label === 'Day' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant'">
          {{ v.label }}
        </button>
      </div>

      <!-- Time Grid -->
      <div class="relative">
        <div *ngFor="let hour of hours" class="flex gap-3 mb-1">
          <div class="w-12 text-right flex-shrink-0 pt-1">
            <span class="font-label-sm text-label-sm text-on-surface-variant">
              {{ formatHour(hour) }}
            </span>
          </div>
          <div class="flex-1 min-h-[56px] border-t border-outline-variant relative">
            <div *ngFor="let evt of getEventsForHour(hour)"
                 class="absolute inset-x-0 mx-1 rounded-lg px-2 py-1 text-white text-xs font-semibold"
                 [style.background]="evt.color"
                 [style.top]="'4px'">
              {{ evt.title }}
              <span class="opacity-75 ml-1">{{ evt.startTime }}–{{ evt.endTime }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ScheduleDayComponent implements OnInit {
  router = inject(Router);
  private scheduleService = inject(ScheduleService);

  currentDate = new Date();
  hours = HOURS;

  views = [
    { label: 'Day', route: '/schedule' },
    { label: 'Week', route: '/schedule/week' },
    { label: 'Month', route: '/schedule/month' },
  ];

  get dateLabel(): string {
    return this.currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  get dateStr(): string {
    return this.currentDate.toISOString().split('T')[0];
  }

  ngOnInit(): void {
    this.scheduleService.load();
  }

  getEventsForHour(hour: number): ScheduledEvent[] {
    return this.scheduleService.getByDate(this.dateStr).filter(e => {
      const h = parseInt(e.startTime.split(':')[0], 10);
      return h === hour;
    });
  }

  formatHour(h: number): string {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const display = h > 12 ? h - 12 : h;
    return `${display}${ampm}`;
  }

  prevDay(): void {
    const d = new Date(this.currentDate);
    d.setDate(d.getDate() - 1);
    this.currentDate = d;
  }

  nextDay(): void {
    const d = new Date(this.currentDate);
    d.setDate(d.getDate() + 1);
    this.currentDate = d;
  }
}
