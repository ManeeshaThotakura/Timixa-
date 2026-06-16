import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ExceptionType,
  PlannedTask,
  PlannedTaskInput,
  PlannedTaskUpdate,
  Weekday,
} from '../models/planned-task.model';

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hhmmNow(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class PlannedTaskService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/planned-tasks`;

  private _tasks = signal<PlannedTask[]>([]);
  readonly tasks = this._tasks.asReadonly();

  private _now = signal<Date>(new Date());
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  readonly nowTask = computed<PlannedTask | null>(() => {
    const now = hhmmNow(this._now());
    return (
      this._tasks()
        .filter(
          t =>
            !t.completedToday &&
            t.startTime &&
            t.endTime &&
            t.startTime <= now &&
            now < t.endTime,
        )
        .sort((a, b) => (a.startTime! < b.startTime! ? -1 : 1))[0] ?? null
    );
  });

  readonly upcomingToday = computed<PlannedTask[]>(() => {
    const now = hhmmNow(this._now());
    const current = this.nowTask();
    return this._tasks()
      .filter(
        t =>
          !t.completedToday &&
          t !== current &&
          t.startTime &&
          t.startTime >= now,
      )
      .sort((a, b) => (a.startTime! < b.startTime! ? -1 : 1));
  });

  readonly unscheduledToday = computed<PlannedTask[]>(() =>
    this._tasks().filter(t => !t.completedToday && t.needsTimeSlot && !t.startTime),
  );

  readonly completedToday = computed<PlannedTask[]>(() =>
    this._tasks().filter(t => t.completedToday),
  );

  loadToday(): Observable<PlannedTask[]> {
    return this.loadForDate(todayIso()).pipe(tap(list => this._tasks.set(list)));
  }

  loadForDate(date: string): Observable<PlannedTask[]> {
    return this.http.get<PlannedTask[]>(`${this.base}?date=${date}`);
  }

  loadForWeek(weekStart: string): Observable<Map<string, PlannedTask[]>> {
    const start = new Date(weekStart);
    const calls: { [date: string]: Observable<PlannedTask[]> } = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = isoFromDate(d);
      calls[iso] = this.loadForDate(iso);
    }
    return forkJoin(calls).pipe(
      switchMap(map => of(new Map(Object.entries(map)))),
    );
  }

  create(input: PlannedTaskInput): Observable<PlannedTask> {
    return this.http
      .post<PlannedTask>(this.base, input)
      .pipe(tap(t => this._tasks.update(list => [t, ...list])));
  }

  update(id: string, patch: PlannedTaskUpdate): Observable<PlannedTask> {
    return this.http
      .patch<PlannedTask>(`${this.base}/${id}`, patch)
      .pipe(tap(updated => this._tasks.update(list => list.map(t => (t.id === id ? updated : t)))));
  }

  complete(id: string, date: string = todayIso()): Observable<PlannedTask> {
    return this.http
      .post<PlannedTask>(`${this.base}/${id}/completions`, { date })
      .pipe(tap(updated => this._tasks.update(list => list.map(t => (t.id === id ? updated : t)))));
  }

  uncomplete(id: string, date: string = todayIso()): Observable<void> {
    return this.http
      .delete<void>(`${this.base}/${id}/completions/${date}`)
      .pipe(
        tap(() =>
          this._tasks.update(list =>
            list.map(t => (t.id === id ? { ...t, completedToday: false } : t)),
          ),
        ),
      );
  }

  scheduleForToday(id: string, startTime: string, endTime: string): Observable<PlannedTask> {
    return this.update(id, { startTime, endTime, needsTimeSlot: true });
  }

  remove(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.base}/${id}`)
      .pipe(tap(() => this._tasks.update(list => list.filter(t => t.id !== id))));
  }

  addException(id: string, date: string, type: ExceptionType): Observable<PlannedTask> {
    return this.http
      .post<PlannedTask>(`${this.base}/${id}/exceptions`, { date, type })
      .pipe(tap(updated => this._tasks.update(list => list.map(t => (t.id === id ? updated : t)))));
  }

  removeException(id: string, date: string): Observable<PlannedTask> {
    return this.http
      .delete<void>(`${this.base}/${id}/exceptions/${date}`)
      .pipe(
        switchMap(() => this.loadOne(id)),
        tap(updated => this._tasks.update(list => list.map(t => (t.id === id ? updated : t)))),
      );
  }

  applyPermanently(
    id: string,
    date: string,
    template: { weekdays?: Weekday[]; monthDays?: number[] },
  ): Observable<PlannedTask> {
    return this.removeException(id, date).pipe(
      switchMap(() => this.update(id, template)),
    );
  }

  startTicker(): void {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => this._now.set(new Date()), 60_000);
  }

  stopTicker(): void {
    if (this.tickHandle) clearInterval(this.tickHandle);
    this.tickHandle = null;
  }

  private loadOne(id: string): Observable<PlannedTask> {
    return this.http.get<PlannedTask>(`${this.base}/${id}`);
  }
}
