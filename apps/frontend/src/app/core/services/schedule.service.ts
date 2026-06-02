import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ScheduledEvent, Meeting, UnscheduledTask } from '../models/schedule.model';
import { environment } from '../../../environments/environment';

interface MeetingCreatedResponse {
  meeting: Meeting;
  event: ScheduledEvent;
}

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  private _events = signal<ScheduledEvent[]>([]);
  private _meetings = signal<Meeting[]>([]);
  private _unscheduledTasks = signal<UnscheduledTask[]>([]);
  private _loaded = signal(false);

  readonly events = this._events.asReadonly();
  readonly meetings = this._meetings.asReadonly();
  readonly unscheduledTasks = this._unscheduledTasks.asReadonly();

  load(): void {
    if (this._loaded()) return;
    this._loaded.set(true);
    this.http.get<ScheduledEvent[]>(`${this.apiUrl}/events`).subscribe({
      next: e => this._events.set(e),
      error: () => this._loaded.set(false),
    });
    this.http.get<Meeting[]>(`${this.apiUrl}/meetings`).subscribe({
      next: m => this._meetings.set(m),
      error: () => {},
    });
    this.http.get<UnscheduledTask[]>(`${this.apiUrl}/unscheduled-tasks`).subscribe({
      next: u => this._unscheduledTasks.set(u),
      error: () => {},
    });
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
    let newRemaining = 0;
    this._unscheduledTasks.update(tasks =>
      tasks.map(t => {
        if (t.id !== taskId) return t;
        newRemaining = Math.max(0, t.remainingMinutes - minutes);
        return { ...t, remainingMinutes: newRemaining };
      }),
    );
    this.http
      .patch(`${this.apiUrl}/unscheduled-tasks/${taskId}`, { remainingMinutes: newRemaining })
      .subscribe({ error: () => this.refreshUnscheduled() });
  }

  returnTimeToTask(taskId: string, minutes: number): void {
    if (minutes <= 0) return;
    let newRemaining = 0;
    this._unscheduledTasks.update(tasks =>
      tasks.map(t => {
        if (t.id !== taskId) return t;
        newRemaining = Math.min(t.durationMinutes, t.remainingMinutes + minutes);
        return { ...t, remainingMinutes: newRemaining };
      }),
    );
    this.http
      .patch(`${this.apiUrl}/unscheduled-tasks/${taskId}`, { remainingMinutes: newRemaining })
      .subscribe({ error: () => this.refreshUnscheduled() });
  }

  resizeEvent(eventId: string, newDurationMinutes: number): void {
    const event = this._events().find(e => e.id === eventId);
    if (!event) return;
    const oldDuration = this.minutesBetween(event.startTime, event.endTime);
    const delta = oldDuration - newDurationMinutes;
    const newEnd = this.addMinutes(event.startTime, newDurationMinutes);

    // Optimistic
    this._events.update(events =>
      events.map(e => (e.id === eventId ? { ...e, endTime: newEnd } : e)),
    );

    this.http
      .put<ScheduledEvent>(`${this.apiUrl}/events/${eventId}`, { ...event, endTime: newEnd })
      .subscribe({
        next: saved => this._events.update(es => es.map(e => (e.id === eventId ? saved : e))),
        error: () => this.refreshEvents(),
      });

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
    const updated: ScheduledEvent = { ...event, ...patch };
    const oldDuration = this.minutesBetween(event.startTime, event.endTime);
    const newDuration = this.minutesBetween(updated.startTime, updated.endTime);
    const delta = oldDuration - newDuration;

    this._events.update(events => events.map(e => (e.id === eventId ? updated : e)));

    this.http
      .put<ScheduledEvent>(`${this.apiUrl}/events/${eventId}`, updated)
      .subscribe({
        next: saved => this._events.update(es => es.map(e => (e.id === eventId ? saved : e))),
        error: () => this.refreshEvents(),
      });

    if (event.sourceTaskId && delta !== 0) {
      if (delta > 0) this.returnTimeToTask(event.sourceTaskId, delta);
      else this.scheduleTask(event.sourceTaskId, -delta);
    }
  }

  updateEventTime(eventId: string, startTime: string, endTime: string): void {
    this.updateEvent(eventId, { startTime, endTime });
  }

  removeEvent(eventId: string): void {
    const event = this._events().find(e => e.id === eventId);
    if (!event) return;
    const duration = this.minutesBetween(event.startTime, event.endTime);

    this._events.update(events => events.filter(e => e.id !== eventId));
    this.http.delete(`${this.apiUrl}/events/${eventId}`).subscribe({
      error: () => this.refreshEvents(),
    });

    if (event.sourceTaskId) this.returnTimeToTask(event.sourceTaskId, duration);
  }

  dismissUnscheduledBanner(): void {
    this._unscheduledTasks.set([]);
  }

  addMeeting(meeting: Meeting): void {
    const { id, ...payload } = meeting;
    this.http
      .post<MeetingCreatedResponse>(`${this.apiUrl}/meetings`, payload)
      .subscribe(({ meeting: createdMeeting, event: createdEvent }) => {
        this._meetings.update(m => [...m, createdMeeting]);
        this._events.update(e => [...e, createdEvent]);
      });
  }

  addEvent(event: ScheduledEvent): void {
    const { id, ...payload } = event;
    this.http
      .post<ScheduledEvent>(`${this.apiUrl}/events`, payload)
      .subscribe(created => this._events.update(e => [...e, created]));
  }

  addUnscheduledTask(input: {
    title: string;
    durationMinutes: number;
    dueDate?: string;
  }): void {
    const payload = {
      title: input.title,
      projectId: '',
      durationMinutes: input.durationMinutes,
      remainingMinutes: input.durationMinutes,
      dueDate: input.dueDate ?? '',
      priority: 'medium',
      status: 'todo',
    };
    this.http
      .post<{
        id: string;
        title: string;
        projectId: string;
        dueDate: string;
        durationMinutes: number;
        remainingMinutes: number;
      }>(`${this.apiUrl}/tasks`, payload)
      .subscribe(created => {
        this._unscheduledTasks.update(list => [
          ...list,
          {
            id: created.id,
            title: created.title,
            projectId: created.projectId,
            dueDate: created.dueDate,
            durationMinutes: created.durationMinutes,
            remainingMinutes: created.remainingMinutes,
          },
        ]);
      });
  }

  getMeetingsByProject(projectId: string): Meeting[] {
    return this._meetings().filter(m => m.projectId === projectId);
  }

  private refreshEvents(): void {
    this.http.get<ScheduledEvent[]>(`${this.apiUrl}/events`).subscribe(e => this._events.set(e));
  }

  private refreshUnscheduled(): void {
    this.http
      .get<UnscheduledTask[]>(`${this.apiUrl}/unscheduled-tasks`)
      .subscribe(u => this._unscheduledTasks.set(u));
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
