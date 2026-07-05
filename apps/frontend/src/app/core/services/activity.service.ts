import { Injectable, signal, effect } from '@angular/core';
import { Activity, ActivityVerb } from '../models/project.model';
import { MOCK_ACTIVITIES } from '../mocks/projects.mock';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly STORAGE_KEY = 'flowforge_activities';
  private _activities = signal<Activity[]>([]);
  readonly activities = this._activities.asReadonly();

  // Activity feed is a client-side, display-only feature for now (not part of the
  // Core CockroachDB scope), so it always loads/persists locally regardless of backend.
  constructor() {
    this._activities.set(this.read() ?? MOCK_ACTIVITIES);
    effect(() => {
      const data = this._activities();
      try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
    });
  }

  byProject(projectId: string): Activity[] {
    return this._activities()
      .filter(a => a.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  recent(limit = 8): Activity[] {
    return [...this._activities()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }

  log(entry: {
    projectId: string;
    actorId: string;
    actorName: string;
    verb: ActivityVerb;
    issueId?: string;
    issueKey?: string;
    issueTitle?: string;
    detail?: string;
  }): void {
    const activity: Activity = {
      id: `a${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...entry,
    };
    this._activities.update(list => [activity, ...list]);
  }

  private read(): Activity[] | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Activity[]) : null;
    } catch {
      return null;
    }
  }
}
