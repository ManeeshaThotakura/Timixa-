import { Injectable } from '@angular/core';
import { PlannedTask, Weekday } from '../models/planned-task.model';

export interface FrequencyWarning {
  taskId: string;
  title: string;
  cadence: 'WEEKLY' | 'MONTHLY';
  actual: number;
  expected: number;
  period: string;
}

const WEEKDAY_ORDER: Weekday[] = [
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
];

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const dow = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - dow);
  out.setHours(0, 0, 0, 0);
  return out;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

@Injectable({ providedIn: 'root' })
export class FrequencyValidatorService {

  validateForWeek(tasks: PlannedTask[], anyDateInWeek: Date): FrequencyWarning[] {
    const start = startOfWeek(anyDateInWeek);
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
    const out: FrequencyWarning[] = [];
    for (const t of tasks) {
      if (t.cadence !== 'WEEKLY' || !t.weekdays || t.weekdays.length === 0) continue;
      const expected = t.weekdays.length;
      const actual = this.countApplicable(t, dates);
      if (actual > expected) {
        out.push({
          taskId: t.id,
          title: t.title,
          cadence: 'WEEKLY',
          actual,
          expected,
          period: 'this week',
        });
      }
    }
    return out;
  }

  validateForMonth(tasks: PlannedTask[], anyDateInMonth: Date): FrequencyWarning[] {
    const start = startOfMonth(anyDateInMonth);
    const end = endOfMonth(anyDateInMonth);
    const dates: Date[] = [];
    for (let day = start.getDate(); day <= end.getDate(); day++) {
      dates.push(new Date(anyDateInMonth.getFullYear(), anyDateInMonth.getMonth(), day));
    }
    const out: FrequencyWarning[] = [];
    for (const t of tasks) {
      if (t.cadence !== 'MONTHLY' || !t.monthDays || t.monthDays.length === 0) continue;
      const expected = t.monthDays.length;
      const actual = this.countApplicable(t, dates);
      if (actual > expected) {
        out.push({
          taskId: t.id,
          title: t.title,
          cadence: 'MONTHLY',
          actual,
          expected,
          period: 'this month',
        });
      }
    }
    return out;
  }

  private countApplicable(task: PlannedTask, dates: Date[]): number {
    let count = 0;
    for (const d of dates) {
      if (this.appliesOn(task, d)) count++;
    }
    return count;
  }

  private appliesOn(task: PlannedTask, date: Date): boolean {
    const iso = isoDate(date);
    const ex = task.exceptions?.find(e => e.date === iso);
    if (task.cadence === 'ONCE') return iso === task.scheduledDate;
    if (task.cadence === 'DAILY') return ex?.type !== 'SKIP';
    if (task.cadence === 'WEEKLY') {
      const dow = WEEKDAY_ORDER[(date.getDay() + 6) % 7];
      const covered = task.weekdays?.includes(dow) ?? false;
      return (covered && ex?.type !== 'SKIP') || (!covered && ex?.type === 'ADD');
    }
    if (task.cadence === 'MONTHLY') {
      const covered = task.monthDays?.includes(date.getDate()) ?? false;
      return (covered && ex?.type !== 'SKIP') || (!covered && ex?.type === 'ADD');
    }
    return false;
  }
}
