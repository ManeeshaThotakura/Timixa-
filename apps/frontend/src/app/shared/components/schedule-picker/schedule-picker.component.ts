import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ScheduleConfig,
  Frequency,
  WeekOption,
  MonthlyMode,
  EndsMode,
  WeekOrdinal,
  Weekday,
  defaultScheduleConfig,
} from '../../../core/models/schedule-config.model';

interface FrequencyTab {
  value: Frequency;
  label: string;
}

@Component({
  selector: 'app-schedule-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-stack-md">

      <!-- Frequency tabs -->
      <div>
        <label class="block text-[11px] font-bold text-primary uppercase tracking-wider mb-2">
          Select Frequency <span class="text-error">*</span>
        </label>
        <div class="flex gap-1 p-1 bg-surface-container-low rounded-xl border border-outline-variant/10">
          <button *ngFor="let tab of frequencies"
                  type="button"
                  (click)="setFrequency(tab.value)"
                  class="flex-1 py-2 text-[13px] font-bold rounded-lg transition-all"
                  [class]="config.frequency === tab.value
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-white/40'">
            {{ tab.label }}
          </button>
        </div>
        <p class="text-[11px] italic text-on-surface-variant mt-2">
          *You can schedule this task more graphically in the calendar.
        </p>
      </div>

      <!-- Start row: date + time (hidden for all-day notify-only tasks) -->
      <div *ngIf="needsTimeSlot" class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        <div class="min-w-0">
          <label class="block text-[10px] sm:text-[11px] font-bold text-outline uppercase ml-1 mb-1">
            Start Date <span class="font-normal text-outline-variant lowercase">(optional)</span>
          </label>
          <div class="flex items-center gap-1.5 px-2.5 py-2.5 sm:px-3 sm:py-3 bg-surface-container-low rounded-xl min-w-0">
            <span class="material-symbols-outlined text-on-surface-variant text-[16px] sm:text-[18px] flex-shrink-0">calendar_today</span>
            <input type="date" [(ngModel)]="config.startDate" (ngModelChange)="emitChange()"
                   class="flex-1 min-w-0 w-full bg-transparent border-none focus:ring-0 text-[13px] sm:text-[14px] p-0" />
          </div>
        </div>
        <div class="min-w-0">
          <label class="block text-[10px] sm:text-[11px] font-bold text-outline uppercase ml-1 mb-1">
            Start Time <span class="font-normal text-outline-variant lowercase">(optional)</span>
          </label>
          <div class="flex items-center gap-1.5 px-2.5 py-2.5 sm:px-3 sm:py-3 bg-surface-container-low rounded-xl min-w-0">
            <span class="material-symbols-outlined text-on-surface-variant text-[16px] sm:text-[18px] flex-shrink-0">schedule</span>
            <input type="time" [(ngModel)]="config.startTime" (ngModelChange)="emitChange()"
                   class="flex-1 min-w-0 w-full bg-transparent border-none focus:ring-0 text-[13px] sm:text-[14px] p-0" />
          </div>
        </div>
      </div>

      <!-- End row: date + time (hidden for all-day notify-only tasks) -->
      <div *ngIf="needsTimeSlot" class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        <div class="min-w-0">
          <label class="block text-[10px] sm:text-[11px] font-bold text-outline uppercase ml-1 mb-1">
            End Date <span class="font-normal text-outline-variant lowercase">(optional)</span>
          </label>
          <div class="flex items-center gap-1.5 px-2.5 py-2.5 sm:px-3 sm:py-3 bg-surface-container-low rounded-xl min-w-0">
            <span class="material-symbols-outlined text-on-surface-variant text-[16px] sm:text-[18px] flex-shrink-0">calendar_today</span>
            <input type="date" [(ngModel)]="config.endDate" (ngModelChange)="emitChange()"
                   class="flex-1 min-w-0 w-full bg-transparent border-none focus:ring-0 text-[13px] sm:text-[14px] p-0" />
          </div>
        </div>
        <div class="min-w-0">
          <label class="block text-[10px] sm:text-[11px] font-bold text-outline uppercase ml-1 mb-1">
            End Time <span class="font-normal text-outline-variant lowercase">(optional)</span>
          </label>
          <div class="flex items-center gap-1.5 px-2.5 py-2.5 sm:px-3 sm:py-3 bg-surface-container-low rounded-xl min-w-0">
            <span class="material-symbols-outlined text-on-surface-variant text-[16px] sm:text-[18px] flex-shrink-0">schedule</span>
            <input type="time" [(ngModel)]="config.endTime" (ngModelChange)="emitChange()"
                   class="flex-1 min-w-0 w-full bg-transparent border-none focus:ring-0 text-[13px] sm:text-[14px] p-0" />
          </div>
        </div>
      </div>

      <!-- Repeat every (interval) -->
      <div class="pt-3 border-t border-outline-variant/10">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <span class="text-[14px] sm:text-body-md font-medium">
            Repeat every <span class="font-normal text-outline text-[11px] sm:text-[12px]">(Optional)</span>
          </span>
          <div class="flex items-center gap-2">
            <input type="number" min="1" max="99"
                   [(ngModel)]="config.interval" (ngModelChange)="emitChange()"
                   class="w-12 sm:w-14 p-1.5 sm:p-2 bg-surface-container-low border-none rounded-lg text-center font-bold text-primary text-[14px] focus:ring-2 focus:ring-primary/20" />
            <span class="text-on-surface-variant text-[13px] sm:text-[14px] min-w-[3rem]">{{ unitLabel }}</span>
          </div>
        </div>
      </div>

      <!-- Daily-specific options -->
      <div *ngIf="config.frequency === 'daily'" class="flex flex-wrap gap-1.5 sm:gap-2">
        <button type="button" *ngFor="let opt of dailyOptions"
                (click)="setDailyOption(opt.value)"
                class="px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-[12px] font-bold transition-all whitespace-nowrap"
                [class]="config.dailyOption === opt.value
                  ? 'bg-primary-fixed/40 text-primary border border-primary-fixed'
                  : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/20'">
          {{ opt.label }}
        </button>
      </div>

      <!-- Weekly-specific: day chips -->
      <div *ngIf="config.frequency === 'weekly'">
        <label class="block text-[10px] sm:text-[11px] font-bold text-outline uppercase ml-1 mb-2">On</label>
        <div class="flex gap-1 sm:gap-1.5">
          <button type="button" *ngFor="let d of weekdays"
                  (click)="toggleWeeklyDay(d.value)"
                  class="flex-1 min-w-0 h-9 sm:h-10 rounded-full text-[11px] sm:text-[12px] font-bold transition-all"
                  [class]="isWeeklyDaySelected(d.value)
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/20'">
            {{ d.short }}
          </button>
        </div>
      </div>

      <!-- Monthly-specific -->
      <div *ngIf="config.frequency === 'monthly'" class="space-y-3">
        <label class="block text-[10px] sm:text-[11px] font-bold text-outline uppercase ml-1">Repeat by</label>
        <div class="flex gap-2">
          <button type="button"
                  (click)="setMonthlyMode('day-of-month')"
                  class="flex-1 min-w-0 py-2 text-[12px] sm:text-[13px] font-semibold rounded-xl transition-all border-2"
                  [class]="config.monthlyMode === 'day-of-month'
                    ? 'border-primary text-primary bg-primary-fixed/30'
                    : 'border-outline-variant/20 text-on-surface-variant'">
            Day of month
          </button>
          <button type="button"
                  (click)="setMonthlyMode('pattern')"
                  class="flex-1 min-w-0 py-2 text-[12px] sm:text-[13px] font-semibold rounded-xl transition-all border-2"
                  [class]="config.monthlyMode === 'pattern'
                    ? 'border-primary text-primary bg-primary-fixed/30'
                    : 'border-outline-variant/20 text-on-surface-variant'">
            Pattern
          </button>
        </div>

        <div *ngIf="config.monthlyMode === 'day-of-month'">
          <label class="block text-[10px] sm:text-[11px] font-bold text-outline uppercase ml-1 mb-1">On day</label>
          <select [(ngModel)]="config.monthlyDay" (ngModelChange)="emitChange()"
                  class="w-full px-3 py-2.5 sm:py-3 bg-surface-container-low border-none rounded-xl text-[13px] sm:text-[14px] focus:ring-2 focus:ring-primary/20">
            <option *ngFor="let d of monthDays" [ngValue]="d">{{ d }}</option>
          </select>
        </div>

        <div *ngIf="config.monthlyMode === 'pattern'" class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          <div class="min-w-0">
            <label class="block text-[10px] sm:text-[11px] font-bold text-outline uppercase ml-1 mb-1">Week</label>
            <select [(ngModel)]="config.monthlyPatternWeek" (ngModelChange)="emitChange()"
                    class="w-full px-3 py-2.5 sm:py-3 bg-surface-container-low border-none rounded-xl text-[13px] sm:text-[14px] focus:ring-2 focus:ring-primary/20">
              <option *ngFor="let w of weekOrdinals" [ngValue]="w.value">{{ w.label }}</option>
            </select>
          </div>
          <div class="min-w-0">
            <label class="block text-[10px] sm:text-[11px] font-bold text-outline uppercase ml-1 mb-1">Day</label>
            <select [(ngModel)]="config.monthlyPatternDay" (ngModelChange)="emitChange()"
                    class="w-full px-3 py-2.5 sm:py-3 bg-surface-container-low border-none rounded-xl text-[13px] sm:text-[14px] focus:ring-2 focus:ring-primary/20">
              <option *ngFor="let d of patternDays" [ngValue]="d.value">{{ d.label }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Yearly-specific -->
      <div *ngIf="config.frequency === 'yearly'" class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        <div class="min-w-0">
          <label class="block text-[10px] sm:text-[11px] font-bold text-outline uppercase ml-1 mb-1">Month</label>
          <select [(ngModel)]="config.yearlyMonth" (ngModelChange)="emitChange()"
                  class="w-full px-3 py-2.5 sm:py-3 bg-surface-container-low border-none rounded-xl text-[13px] sm:text-[14px] focus:ring-2 focus:ring-primary/20">
            <option *ngFor="let m of months; let i = index" [ngValue]="i + 1">{{ m }}</option>
          </select>
        </div>
        <div class="min-w-0">
          <label class="block text-[10px] sm:text-[11px] font-bold text-outline uppercase ml-1 mb-1">Day</label>
          <select [(ngModel)]="config.yearlyDay" (ngModelChange)="emitChange()"
                  class="w-full px-3 py-2.5 sm:py-3 bg-surface-container-low border-none rounded-xl text-[13px] sm:text-[14px] focus:ring-2 focus:ring-primary/20">
            <option *ngFor="let d of monthDays" [ngValue]="d">{{ d }}</option>
          </select>
        </div>
      </div>

      <!-- Ends -->
      <div class="pt-3 border-t border-outline-variant/10 space-y-3">
        <label class="block text-[10px] sm:text-[11px] font-bold text-outline uppercase ml-1">Ends</label>
        <div class="flex gap-1.5 sm:gap-2">
          <button type="button" *ngFor="let opt of endsModes"
                  (click)="setEndsMode(opt.value)"
                  class="flex-1 min-w-0 py-2 text-[12px] sm:text-[13px] font-semibold rounded-xl transition-all border-2"
                  [class]="config.endsMode === opt.value
                    ? 'border-primary text-primary bg-primary-fixed/30'
                    : 'border-outline-variant/20 text-on-surface-variant'">
            {{ opt.label }}
          </button>
        </div>

        <div *ngIf="config.endsMode === 'on-date'" class="flex items-center gap-1.5 px-2.5 py-2.5 sm:px-3 sm:py-3 bg-surface-container-low rounded-xl min-w-0">
          <span class="material-symbols-outlined text-on-surface-variant text-[16px] sm:text-[18px] flex-shrink-0">calendar_today</span>
          <input type="date" [(ngModel)]="config.endsOnDate" (ngModelChange)="emitChange()"
                 class="flex-1 min-w-0 w-full bg-transparent border-none focus:ring-0 text-[13px] sm:text-[14px] p-0" />
        </div>

        <div *ngIf="config.endsMode === 'count'" class="flex items-center justify-between gap-2 p-2.5 sm:p-3 bg-surface-container-low rounded-xl">
          <span class="text-[13px] sm:text-[14px] text-on-surface-variant">After</span>
          <div class="flex items-center gap-1.5 sm:gap-2">
            <input type="number" min="1" [(ngModel)]="config.endsCount" (ngModelChange)="emitChange()"
                   class="w-14 sm:w-16 p-1.5 sm:p-2 bg-white border-none rounded-lg text-center font-bold text-primary text-[14px] focus:ring-2 focus:ring-primary/20" />
            <span class="text-[13px] sm:text-[14px] text-on-surface-variant">occurrences</span>
          </div>
        </div>
      </div>

      <!-- Advanced -->
      <div class="pt-2 border-t border-outline-variant/10">
        <button type="button" (click)="advancedOpen = !advancedOpen"
                class="w-full flex items-center justify-between py-2 text-[13px] font-semibold text-outline hover:text-on-surface transition-colors">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">settings</span>
            Advanced Settings
          </div>
          <span class="material-symbols-outlined transition-transform"
                [class.rotate-180]="advancedOpen">expand_more</span>
        </button>

        <div *ngIf="advancedOpen" class="space-y-3 pt-3">
          <label class="flex items-center justify-between text-[14px]">
            <span>Skip holidays</span>
            <input type="checkbox" [(ngModel)]="advSkipHolidays" (ngModelChange)="emitAdvanced()"
                   class="rounded text-primary focus:ring-primary/20" />
          </label>
          <label class="flex items-center justify-between text-[14px]">
            <span>Auto reschedule on conflict</span>
            <input type="checkbox" [(ngModel)]="advAutoReschedule" (ngModelChange)="emitAdvanced()"
                   class="rounded text-primary focus:ring-primary/20" />
          </label>
          <div>
            <label class="block text-[11px] font-bold text-outline uppercase ml-1 mb-1">Buffer (min)</label>
            <input type="number" min="0" [(ngModel)]="advBuffer" (ngModelChange)="emitAdvanced()"
                   class="w-full p-3 bg-surface-container-low border-none rounded-xl text-[14px] focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>
      </div>

      <!-- Live preview -->
      <div class="bg-secondary-fixed/30 rounded-xl p-3 flex items-start gap-2">
        <span class="material-symbols-outlined text-secondary text-[18px] mt-0.5">auto_awesome</span>
        <p class="text-[13px] text-on-secondary-fixed-variant leading-snug">{{ summary }}</p>
      </div>

    </div>
  `,
})
export class SchedulePickerComponent implements OnInit {
  @Input() value: ScheduleConfig | null = null;
  @Input() lockedFrequency: Frequency | null = null;
  @Input() needsTimeSlot = true;
  @Output() valueChange = new EventEmitter<ScheduleConfig>();

  config: ScheduleConfig = { ...defaultScheduleConfig };

  advancedOpen = false;
  advSkipHolidays = false;
  advAutoReschedule = false;
  advBuffer = 0;

  readonly frequencies: FrequencyTab[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  readonly dailyOptions: { value: WeekOption; label: string }[] = [
    { value: 'every-day', label: 'Every day' },
    { value: 'weekdays', label: 'Weekdays' },
    { value: 'weekends', label: 'Weekends' },
  ];

  readonly weekdays: { value: Weekday; short: string }[] = [
    { value: 'mon', short: 'M' },
    { value: 'tue', short: 'T' },
    { value: 'wed', short: 'W' },
    { value: 'thu', short: 'T' },
    { value: 'fri', short: 'F' },
    { value: 'sat', short: 'S' },
    { value: 'sun', short: 'S' },
  ];

  readonly weekOrdinals: { value: WeekOrdinal; label: string }[] = [
    { value: 'first', label: 'First' },
    { value: 'second', label: 'Second' },
    { value: 'third', label: 'Third' },
    { value: 'fourth', label: 'Fourth' },
    { value: 'last', label: 'Last' },
  ];

  readonly patternDays: { value: Weekday; label: string }[] = [
    { value: 'mon', label: 'Monday' },
    { value: 'tue', label: 'Tuesday' },
    { value: 'wed', label: 'Wednesday' },
    { value: 'thu', label: 'Thursday' },
    { value: 'fri', label: 'Friday' },
    { value: 'sat', label: 'Saturday' },
    { value: 'sun', label: 'Sunday' },
    { value: 'day', label: 'Day' },
  ];

  readonly months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  readonly monthDays = Array.from({ length: 31 }, (_, i) => i + 1);

  readonly endsModes: { value: EndsMode; label: string }[] = [
    { value: 'never', label: 'Never' },
    { value: 'on-date', label: 'On Date' },
    { value: 'count', label: 'Count' },
  ];

  ngOnInit(): void {
    if (this.value) {
      this.config = { ...defaultScheduleConfig, ...this.value };
    }
    if (this.lockedFrequency) {
      this.config.frequency = this.lockedFrequency;
    }
    this.advSkipHolidays = !!this.config.advanced?.skipHolidays;
    this.advAutoReschedule = !!this.config.advanced?.autoReschedule;
    this.advBuffer = this.config.advanced?.bufferMinutes ?? 0;
  }

  get unitLabel(): string {
    const map: Record<Frequency, string> = {
      daily: this.config.interval === 1 ? 'day' : 'days',
      weekly: this.config.interval === 1 ? 'week' : 'weeks',
      monthly: this.config.interval === 1 ? 'month' : 'months',
      yearly: this.config.interval === 1 ? 'year' : 'years',
    };
    return map[this.config.frequency];
  }

  get summary(): string {
    const c = this.config;
    const every = c.interval > 1 ? `every ${c.interval} ${this.unitLabel}` : `every ${this.unitLabel.replace(/s$/, '')}`;
    let detail = '';
    if (c.frequency === 'daily' && c.dailyOption && c.dailyOption !== 'every-day') {
      detail = ` (${c.dailyOption.replace('-', ' ')})`;
    }
    if (c.frequency === 'weekly' && c.weeklyDays?.length) {
      detail = ` on ${c.weeklyDays.map(d => d.toUpperCase()).join(', ')}`;
    }
    if (c.frequency === 'monthly' && c.monthlyMode === 'pattern' && c.monthlyPatternWeek && c.monthlyPatternDay) {
      detail = ` on the ${c.monthlyPatternWeek} ${c.monthlyPatternDay}`;
    }
    if (c.frequency === 'monthly' && c.monthlyMode === 'day-of-month' && c.monthlyDay) {
      detail = ` on day ${c.monthlyDay}`;
    }
    let ends = '';
    if (c.endsMode === 'on-date' && c.endsOnDate) ends = `, until ${c.endsOnDate}`;
    if (c.endsMode === 'count' && c.endsCount) ends = `, for ${c.endsCount} occurrences`;
    return `Repeats ${every}${detail}${ends}.`;
  }

  setFrequency(f: Frequency): void {
    if (this.lockedFrequency) return;
    this.config.frequency = f;
    if (f === 'monthly' && !this.config.monthlyMode) {
      this.config.monthlyMode = 'day-of-month';
      this.config.monthlyDay = this.config.monthlyDay ?? new Date().getDate();
    }
    if (f === 'yearly') {
      const today = new Date();
      this.config.yearlyMonth = this.config.yearlyMonth ?? today.getMonth() + 1;
      this.config.yearlyDay = this.config.yearlyDay ?? today.getDate();
    }
    this.emitChange();
  }

  setDailyOption(opt: WeekOption): void {
    this.config.dailyOption = opt;
    this.emitChange();
  }

  toggleWeeklyDay(d: Weekday): void {
    const set = new Set(this.config.weeklyDays || []);
    set.has(d) ? set.delete(d) : set.add(d);
    this.config.weeklyDays = Array.from(set);
    this.emitChange();
  }

  isWeeklyDaySelected(d: Weekday): boolean {
    return (this.config.weeklyDays || []).includes(d);
  }

  setMonthlyMode(m: MonthlyMode): void {
    this.config.monthlyMode = m;
    if (m === 'day-of-month' && !this.config.monthlyDay) {
      this.config.monthlyDay = new Date().getDate();
    }
    if (m === 'pattern') {
      this.config.monthlyPatternWeek = this.config.monthlyPatternWeek ?? 'first';
      this.config.monthlyPatternDay = this.config.monthlyPatternDay ?? 'mon';
    }
    this.emitChange();
  }

  setEndsMode(m: EndsMode): void {
    this.config.endsMode = m;
    if (m === 'count' && !this.config.endsCount) this.config.endsCount = 10;
    this.emitChange();
  }

  emitChange(): void {
    this.valueChange.emit({ ...this.config });
  }

  emitAdvanced(): void {
    this.config.advanced = {
      skipHolidays: this.advSkipHolidays,
      autoReschedule: this.advAutoReschedule,
      bufferMinutes: this.advBuffer || undefined,
    };
    this.emitChange();
  }
}
