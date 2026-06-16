export type Frequency = 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type WeekOption = 'every-day' | 'weekdays' | 'weekends' | 'custom';
export type MonthlyMode = 'day-of-month' | 'pattern';
export type EndsMode = 'never' | 'on-date' | 'count';
export type WeekOrdinal = 'first' | 'second' | 'third' | 'fourth' | 'last';
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | 'day';

export interface ScheduleConfig {
  frequency: Frequency;

  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;

  interval: number;

  dailyOption?: WeekOption;
  weeklyDays?: Weekday[];
  monthlyMode?: MonthlyMode;
  monthlyDay?: number;
  monthlyPatternWeek?: WeekOrdinal;
  monthlyPatternDay?: Weekday;
  yearlyMonth?: number;
  yearlyDay?: number;

  endsMode: EndsMode;
  endsOnDate?: string;
  endsCount?: number;

  advanced?: {
    timezone?: string;
    bufferMinutes?: number;
    minGapHours?: number;
    maxGapHours?: number;
    skipHolidays?: boolean;
    autoReschedule?: boolean;
  };
}

export const defaultScheduleConfig: ScheduleConfig = {
  frequency: 'daily',
  interval: 1,
  dailyOption: 'every-day',
  endsMode: 'never',
};
