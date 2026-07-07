import { Injectable, inject } from '@angular/core';
import { PlannedTaskService } from './planned-task.service';

function hhmmNow(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class NotificationSchedulerService {
  private plannedTasks = inject(PlannedTaskService);

  private handle: ReturnType<typeof setInterval> | null = null;
  private fired = new Set<string>();

  start(): void {
    if (this.handle) return;
    this.plannedTasks.loadToday().subscribe();
    this.handle = setInterval(() => this.tick(), 30_000);
  }

  stop(): void {
    if (this.handle) clearInterval(this.handle);
    this.handle = null;
  }

  private tick(): void {
    const tasks = this.plannedTasks.tasks();
    const now = hhmmNow();
    const anyNotify = tasks.some(
      t => (t.notifyAtStart || t.notifyAtEnd) && !!t.startTime,
    );
    if (!anyNotify) return;
    this.ensurePermission();

    for (const t of tasks) {
      if (t.completedToday) continue;
      if (t.notifyAtStart && t.startTime === now) {
        this.fire(`${t.id}:start:${now}`, `Time to start: ${t.title}`,
          `Scheduled ${t.startTime}–${t.endTime ?? ''}`);
      }
      if (t.notifyAtEnd && t.endTime === now) {
        this.fire(`${t.id}:end:${now}`, `Time's up: ${t.title}`,
          'Wrap it up and mark it done.');
      }
    }
  }

  private fire(key: string, title: string, body: string): void {
    if (this.fired.has(key)) return;
    this.fired.add(key);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  }

  private ensurePermission(): void {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
}
