import { Injectable, signal, computed, effect } from '@angular/core';
import { AppNotification, NotificationType } from '../models/project.model';
import { environment } from '../../../environments/environment';
import { MOCK_NOTIFICATIONS } from '../mocks/projects.mock';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly STORAGE_KEY = 'flowforge_notifications';
  /** Current mock user; notifications are scoped to this id. */
  private readonly currentUserId = 'u1';

  private _notifications = signal<AppNotification[]>([]);
  readonly notifications = computed(() =>
    this._notifications()
      .filter(n => n.userId === this.currentUserId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
  readonly unreadCount = computed(() => this.notifications().filter(n => !n.read).length);

  constructor() {
    if (environment.useMock) {
      this._notifications.set(this.read() ?? MOCK_NOTIFICATIONS);
      effect(() => {
        const data = this._notifications();
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
      });
    }
  }

  push(entry: { type: NotificationType; text: string; actorName: string; issueId?: string; issueKey?: string; userId?: string }): void {
    const n: AppNotification = {
      id: `n${Date.now()}`,
      userId: entry.userId ?? this.currentUserId,
      read: false,
      createdAt: new Date().toISOString(),
      ...entry,
    };
    this._notifications.update(list => [n, ...list]);
  }

  markRead(id: string): void {
    this._notifications.update(list => list.map(n => (n.id === id ? { ...n, read: true } : n)));
  }

  markAllRead(): void {
    this._notifications.update(list => list.map(n => ({ ...n, read: true })));
  }

  private read(): AppNotification[] | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AppNotification[]) : null;
    } catch {
      return null;
    }
  }
}
