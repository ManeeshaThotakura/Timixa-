import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Reminder } from '../models/reminder.model';

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private http = inject(HttpClient);

  private _reminders = signal<Reminder[]>([]);
  readonly reminders = this._reminders.asReadonly();
  readonly activeCount = computed(() => this._reminders().filter(r => !r.dismissed).length);

  load(): void {
    if (this._reminders().length) return;
    this.http.get<Reminder[]>('assets/mock/reminders.json').subscribe(data => {
      this._reminders.set(data);
    });
  }

  dismiss(id: string): void {
    this._reminders.update(rs =>
      rs.map(r => (r.id === id ? { ...r, dismissed: true } : r))
    );
  }

  snooze(id: string): void {
    this._reminders.update(rs =>
      rs.map(r => (r.id === id ? { ...r, time: 'In 30 min' } : r))
    );
  }
}
