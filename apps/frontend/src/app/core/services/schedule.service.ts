import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ScheduledEvent, Meeting, UnscheduledTask } from '../models/schedule.model';

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private http = inject(HttpClient);

  private _events = signal<ScheduledEvent[]>([]);
  private _meetings = signal<Meeting[]>([]);
  private _unscheduledTasks = signal<UnscheduledTask[]>([]);

  readonly events = this._events.asReadonly();
  readonly meetings = this._meetings.asReadonly();
  readonly unscheduledTasks = this._unscheduledTasks.asReadonly();

  load(): void {
    if (this._events().length) return;
    this.http.get<ScheduledEvent[]>('assets/mock/events.json').subscribe(e => this._events.set(e));
    this.http.get<Meeting[]>('assets/mock/meetings.json').subscribe(m => this._meetings.set(m));
    this.http.get<UnscheduledTask[]>('assets/mock/unscheduled-tasks.json').subscribe(u => this._unscheduledTasks.set(u));
  }

  getByDate(date: string): ScheduledEvent[] {
    return this._events().filter(e => e.date === date);
  }

  getByWeek(startDate: string): ScheduledEvent[] {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return this._events().filter(e => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });
  }

  getByMonth(year: number, month: number): ScheduledEvent[] {
    return this._events().filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }

  scheduleTask(taskId: string): void {
    this._unscheduledTasks.update(tasks => tasks.filter(t => t.id !== taskId));
  }

  dismissUnscheduledBanner(): void {
    this._unscheduledTasks.set([]);
  }

  addMeeting(meeting: Meeting): void {
    this._meetings.update(m => [...m, meeting]);
    const event: ScheduledEvent = {
      id: `e-${meeting.id}`,
      title: meeting.title,
      type: 'meeting',
      date: meeting.date,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      color: '#006688',
    };
    this._events.update(e => [...e, event]);
  }

  addEvent(event: ScheduledEvent): void {
    this._events.update(e => [...e, event]);
  }

  getMeetingsByProject(projectId: string): Meeting[] {
    return this._meetings().filter(m => m.projectId === projectId);
  }
}
