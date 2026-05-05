import { Component, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ScheduleService } from '../../../core/services/schedule.service';
import { ScheduledEvent } from '../../../core/models/schedule.model';


const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const HOURS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Unscheduled Tasks Banner -->
    <div *ngIf="showBanner && unscheduledCount() > 0" class="px-margin-page mt-4">
      <div class="bg-primary-container/10 border border-primary-container/20 rounded-2xl p-4 flex justify-between items-center shadow-sm">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-xl">assignment_late</span>
          <span class="text-sm font-semibold text-on-surface">
            You have {{ unscheduledCount() }} unscheduled {{ unscheduledCount() === 1 ? 'task' : 'tasks' }}
          </span>
        </div>
        <button (click)="scheduleNow()"
                class="text-primary text-xs font-bold uppercase tracking-wider hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors">
          Schedule Now
        </button>
      </div>
    </div>

    <!-- Weekly Date Strip -->
    <div class="px-margin-page mt-stack-md">
      <div class="flex justify-between items-center bg-surface-container-lowest p-4 rounded-3xl shadow-[0px_8px_24px_rgba(94,67,251,0.04)]">
        <div *ngFor="let d of weekDays"
             (click)="selectDay(d.date)"
             class="flex flex-col items-center p-2 rounded-2xl cursor-pointer transition-all active:scale-90"
             [class]="d.isSelected ? 'bg-primary-container text-white shadow-lg' : 'hover:bg-surface-container-low'">
          <span class="font-label-sm text-label-sm mb-2"
                [class]="d.isSelected ? 'opacity-80' : (d.isWeekend ? 'text-red-400' : 'text-tertiary')">
            {{ d.abbr }}
          </span>
          <span class="font-h2 text-body-lg font-bold"
                [class]="d.isSelected ? 'text-white' : 'text-on-surface'">
            {{ d.day }}
          </span>
        </div>
      </div>
    </div>

    <!-- Time Grid -->
    <main class="px-margin-page mt-stack-lg">
      <div class="relative flex">

        <!-- Hour Labels -->
        <div class="w-16 flex-shrink-0 pt-2">
          <div *ngFor="let h of hours" class="h-20 text-label-sm font-label-sm text-tertiary">{{ h }}</div>
        </div>

        <!-- Grid + Event Blocks -->
        <div class="flex-grow relative" [style.height.px]="hours.length * 80">

          <!-- Horizontal Grid Lines -->
          <div class="absolute inset-0 flex flex-col pointer-events-none">
            <div *ngFor="let h of hours" class="h-20 border-t border-surface-container"></div>
          </div>

          <!-- Event Blocks -->
          <div *ngFor="let evt of todayEvents"
               class="absolute left-2 right-4 rounded-xl p-3 flex justify-between items-start shadow-sm border-l-4"
               [style.top.px]="getEventTop(evt.startTime)"
               [style.height.px]="getEventHeight(evt.startTime, evt.endTime)"
               [style.background]="getEventBg(evt.type)"
               [style.borderLeftColor]="getEventAccent(evt.type, evt.color)">
            <div class="overflow-hidden">
              <p class="font-label-sm font-bold text-[13px] truncate"
                 [style.color]="getEventAccent(evt.type, evt.color)">
                {{ evt.title }}
              </p>
              <p class="text-[11px] mt-0.5"
                 [style.color]="getEventAccent(evt.type, evt.color) + 'b3'">
                {{ evt.type | titlecase }} • {{ evt.startTime }}–{{ evt.endTime }}
              </p>
            </div>
            <span class="material-symbols-outlined text-lg cursor-grab active:cursor-grabbing flex-shrink-0"
                  [style.color]="getEventAccent(evt.type, evt.color) + '66'">
              drag_indicator
            </span>
          </div>

          <!-- Empty state -->
          <div *ngIf="todayEvents.length === 0"
               class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p class="text-on-surface-variant text-sm">No events scheduled for this day</p>
          </div>
        </div>
      </div>
    </main>

    <!-- FAB -->
    <button (click)="openNewTask()"
            class="fixed bottom-28 right-6 w-16 h-16 bg-gradient-to-br from-primary to-secondary-container text-white rounded-full shadow-[0px_8px_32px_rgba(94,67,251,0.3)] flex items-center justify-center active:scale-90 transition-transform duration-300 z-[9999]">
      <span class="material-symbols-outlined text-3xl">add</span>
    </button>
  `,
})
export class CalendarComponent implements OnInit {
  private scheduleService = inject(ScheduleService);
  private router = inject(Router);

  showBanner   = true;
  selectedDate = new Date();
  hours        = HOURS;

  unscheduledCount = computed(() => this.scheduleService.unscheduledTasks().length);

  get weekDays() {
    const today = new Date();
    const dow = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        abbr: DAY_ABBR[d.getDay()],
        day: d.getDate(),
        date: d,
        isToday: d.toDateString() === today.toDateString(),
        isSelected: d.toDateString() === this.selectedDate.toDateString(),
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      };
    });
  }

  get todayEvents(): ScheduledEvent[] {
    return this.scheduleService.getByDate(this.selectedDate.toISOString().split('T')[0]);
  }

  ngOnInit(): void {
    this.scheduleService.load();
  }

  selectDay(date: Date): void {
    this.selectedDate = new Date(date);
  }

  scheduleNow(): void { this.router.navigate(['/schedule']); }

  openNewTask(): void { this.router.navigate(['/new-task']); }

  getEventTop(startTime: string): number {
    const [h, m] = startTime.split(':').map(Number);
    return (h - 8) * 80 + (m / 60) * 80 + 8;
  }

  getEventHeight(startTime: string, endTime: string): number {
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    return Math.max(48, ((toMin(endTime) - toMin(startTime)) / 60) * 80 - 8);
  }

  getEventBg(type: string): string {
    if (type === 'habit') return 'rgba(228,223,255,0.4)';
    if (type === 'meeting') return '#E8F5E9';
    return 'rgba(0,193,253,0.08)';
  }

  getEventAccent(type: string, color: string): string {
    if (type === 'habit') return '#451de3';
    if (type === 'meeting') return '#2E7D32';
    return color || '#006688';
  }
}
