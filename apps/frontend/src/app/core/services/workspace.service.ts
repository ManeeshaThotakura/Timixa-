import { Injectable, computed, effect, signal } from '@angular/core';
import { Workspace } from '../models/project.model';
import { MOCK_WORKSPACES } from '../mocks/projects.mock';

/**
 * The top layer above projects (like a Jira/Atlassian workspace).
 * Holds the list of workspaces and which one is currently selected; projects
 * are filtered by the current workspace across the app.
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly STORAGE_KEY = 'timixa_workspaces_state';

  private _workspaces = signal<Workspace[]>([]);
  private _currentId = signal<string>('');
  private _loaded = false;
  private _hydrated = signal(false);

  readonly workspaces = this._workspaces.asReadonly();
  readonly currentId = this._currentId.asReadonly();
  readonly current = computed(() =>
    this._workspaces().find(w => w.id === this._currentId()) ?? this._workspaces()[0],
  );

  // Workspaces live as a column on projects (no dedicated table in the Core scope),
  // so the workspace list stays client-side and its selection persists locally.
  constructor() {
    effect(() => {
      if (!this._hydrated()) return;
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ workspaces: this._workspaces(), currentId: this._currentId() }));
      } catch { /* ignore */ }
    });
  }

  load(): void {
    if (this._loaded) return;
    this._loaded = true;
    const saved = this.read();
    if (saved && saved.workspaces.length) {
      this._workspaces.set(saved.workspaces);
      this._currentId.set(saved.currentId || saved.workspaces[0].id);
    } else {
      this._workspaces.set(MOCK_WORKSPACES);
      this._currentId.set(MOCK_WORKSPACES[0].id);
    }
    this._hydrated.set(true);
  }

  setCurrent(id: string): void { this._currentId.set(id); }

  create(input: { name: string; color: string; icon?: string }): Workspace {
    const ws: Workspace = { id: `w${Date.now()}`, name: input.name.trim(), color: input.color, icon: input.icon };
    this._workspaces.update(list => [...list, ws]);
    this._currentId.set(ws.id);
    return ws;
  }

  /** Id used for projects that have no workspace set (treated as the first/default workspace). */
  private defaultId(): string { return this._workspaces()[0]?.id ?? ''; }

  /** Whether a project (by its workspaceId) belongs to the currently selected workspace. */
  isInCurrent(workspaceId: string | undefined): boolean {
    return (workspaceId ?? this.defaultId()) === this._currentId();
  }

  private read(): { workspaces: Workspace[]; currentId: string } | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.workspaces) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}
