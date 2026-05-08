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

  scheduleTask(taskId: string, minutes: number): void {
    this._unscheduledTasks.update(tasks =>
      tasks.map(t =>
        t.id === taskId
          ? { ...t, remainingMinutes: Math.max(0, t.remainingMinutes - minutes) }
          : t,
      ),
    );
  }

  returnTimeToTask(taskId: string, minutes: number): void {
    if (minutes <= 0) return;
    this._unscheduledTasks.update(tasks => {
      const idx = tasks.findIndex(t => t.id === taskId);
      if (idx >= 0) {
        const t = tasks[idx];
        const next = [...tasks];
        next[idx] = {
          ...t,
          remainingMinutes: Math.min(t.durationMinutes, t.remainingMinutes + minutes),
        };
        return next;
      }
      return tasks;
    });
  }

  resizeEvent(eventId: string, newDurationMinutes: number): void {
    const event = this._events().find(e => e.id === eventId);
    if (!event) return;
    const oldDuration = this.minutesBetween(event.startTime, event.endTime);
    const delta = oldDuration - newDurationMinutes;
    const newEnd = this.addMinutes(event.startTime, newDurationMinutes);
    this._events.update(events =>
      events.map(e => (e.id === eventId ? { ...e, endTime: newEnd } : e)),
    );
    if (event.sourceTaskId && delta !== 0) {
      if (delta > 0) this.returnTimeToTask(event.sourceTaskId, delta);
      else this.scheduleTask(event.sourceTaskId, -delta);
    }
  }

  updateEvent(
    eventId: string,
    patch: { date?: string; startTime?: string; endTime?: string },
  ): void {
    const event = this._events().find(e => e.id === eventId);
    if (!event) return;
    const newStart = patch.startTime ?? event.startTime;
    const newEnd = patch.endTime ?? event.endTime;
    const newDate = patch.date ?? event.date;
    const oldDuration = this.minutesBetween(event.startTime, event.endTime);
    const newDuration = this.minutesBetween(newStart, newEnd);
    const delta = oldDuration - newDuration;
    this._events.update(events =>
      events.map(e =>
        e.id === eventId ? { ...e, date: newDate, startTime: newStart, endTime: newEnd } : e,
      ),
    );
    if (event.sourceTaskId && delta !== 0) {
      if (delta > 0) this.returnTimeToTask(event.sourceTaskId, delta);
      else this.scheduleTask(event.sourceTaskId, -delta);
    }
  }

  updateEventTime(eventId: string, startTime: string, endTime: string): void {
    const event = this._events().find(e => e.id === eventId);
    if (!event) return;
    const oldDuration = this.minutesBetween(event.startTime, event.endTime);
    const newDuration = this.minutesBetween(startTime, endTime);
    const delta = oldDuration - newDuration;
    this._events.update(events =>
      events.map(e => (e.id === eventId ? { ...e, startTime, endTime } : e)),
    );
    if (event.sourceTaskId && delta !== 0) {
      if (delta > 0) this.returnTimeToTask(event.sourceTaskId, delta);
      else this.scheduleTask(event.sourceTaskId, -delta);
    }
  }

  removeEvent(eventId: string): void {
    const event = this._events().find(e => e.id === eventId);
    if (!event) return;
    const duration = this.minutesBetween(event.startTime, event.endTime);
    this._events.update(events => events.filter(e => e.id !== eventId));
    if (event.sourceTaskId) this.returnTimeToTask(event.sourceTaskId, duration);
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

  private minutesBetween(start: string, end: string): number {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return eh * 60 + em - (sh * 60 + sm);
  }

  private addMinutes(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}`;
  }
}
