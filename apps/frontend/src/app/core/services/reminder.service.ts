import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Reminder } from '../models/reminder.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/reminders`;

  private _reminders = signal<Reminder[]>([]);
  private _loaded = signal(false);
  readonly reminders = this._reminders.asReadonly();
  readonly activeCount = computed(() => this._reminders().filter(r => !r.dismissed).length);

  load(): void {
    if (this._loaded()) return;
    this._loaded.set(true);
    this.http.get<Reminder[]>(this.api).subscribe({
      next: data => this._reminders.set(data),
      error: () => this._loaded.set(false),
    });
  }

  dismiss(id: string): void {
    // Optimistic
    this._reminders.update(rs =>
      rs.map(r => (r.id === id ? { ...r, dismissed: true } : r)),
    );
    this.http
      .patch<Reminder>(`${this.api}/${id}/dismiss`, {})
      .subscribe({
        next: updated =>
          this._reminders.update(rs => rs.map(r => (r.id === id ? updated : r))),
        error: () => this.refresh(),
      });
  }

  snooze(id: string): void {
    this._reminders.update(rs =>
      rs.map(r => (r.id === id ? { ...r, time: 'In 30 min' } : r)),
    );
    this.http
      .patch<Reminder>(`${this.api}/${id}/snooze`, {})
      .subscribe({
        next: updated =>
          this._reminders.update(rs => rs.map(r => (r.id === id ? updated : r))),
        error: () => this.refresh(),
      });
  }

  private refresh(): void {
    this.http.get<Reminder[]>(this.api).subscribe(data => this._reminders.set(data));
  }
}
