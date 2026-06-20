import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Project, Task, ProjectStats, TeamMember, Comment } from '../models/project.model';
import { environment } from '../../../environments/environment';
import { MOCK_PROJECTS, MOCK_TASKS, MOCK_STATS, MOCK_TEAM, MOCK_COMMENTS } from '../mocks/projects.mock';

/** Fields collected by the "New Project" form. */
export interface NewProjectInput {
  title: string;
  description: string;
  priority: Project['priority'];
  startDate: string;
  dueDate: string;
  assigneeIds: string[];
  tags: string[];
  color: string;
}

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  private _projects = signal<Project[]>([]);
  private _tasks = signal<Task[]>([]);
  private _comments = signal<Comment[]>([]);
  private _loaded = signal(false);

  readonly projects = this._projects.asReadonly();
  readonly tasks = this._tasks.asReadonly();
  readonly comments = this._comments.asReadonly();

  /** Team members available to assign to projects (mock directory for now). */
  readonly teamMembers: TeamMember[] = MOCK_TEAM;

  /** The signed-in member, used as the author for new comments (mock). */
  readonly currentMember: TeamMember = MOCK_TEAM[0];

  // ── Mock persistence (localStorage) ──────────────────────────────────
  private readonly STORAGE_KEY = 'timixa_projects_state';
  /** Bump when the stored shape changes so stale data is discarded. */
  private readonly STATE_VERSION = 1;
  private _hydrated = signal(false);

  constructor() {
    // In mock mode, persist any change to projects/tasks/comments so they
    // survive a page refresh. Runs only after the initial hydration in load().
    if (environment.useMock) {
      effect(() => {
        if (!this._hydrated()) return;
        const state = {
          v: this.STATE_VERSION,
          projects: this._projects(),
          tasks: this._tasks(),
          comments: this._comments(),
        };
        try {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
        } catch {
          /* storage full or unavailable — ignore */
        }
      });
    }
  }

  readonly stats = computed<ProjectStats>(() => {
    if (environment.useMock) return MOCK_STATS;
    const projects = this._projects();
    const today = new Date();
    const soonMs = 7 * 24 * 60 * 60 * 1000;
    return {
      activeCount: projects.filter(p => p.status === 'active').length,
      velocity: 84,
      dueSoonCount: projects.filter(p => {
        const due = new Date(p.dueDate);
        return due.getTime() - today.getTime() <= soonMs && p.status === 'active';
      }).length,
    };
  });

  load(): void {
    if (this._loaded()) return;
    this._loaded.set(true);

    if (environment.useMock) {
      const saved = this.readState();
      if (saved) {
        this._projects.set(saved.projects);
        this._tasks.set(saved.tasks);
        this._comments.set(saved.comments);
      } else {
        this._projects.set(MOCK_PROJECTS);
        this._tasks.set(MOCK_TASKS);
        this._comments.set(MOCK_COMMENTS);
      }
      this._hydrated.set(true); // enables the persistence effect
      return;
    }

    this.http.get<Project[]>(`${this.apiUrl}/projects`).subscribe({
      next: p => this._projects.set(p),
      error: () => this._loaded.set(false),
    });
    this.http.get<Task[]>(`${this.apiUrl}/tasks`).subscribe({
      next: t => this._tasks.set(t),
      error: () => {},
    });
  }

  getProjectById(id: string): Project | undefined {
    return this._projects().find(p => p.id === id);
  }

  /**
   * Creates a project from the New Project form and adds it to the list.
   * In mock mode it's added locally; otherwise it's POSTed to the API.
   */
  createProject(input: NewProjectInput): void {
    const assignees = this.teamMembers.filter(m => input.assigneeIds.includes(m.id));
    const visible = assignees.slice(0, 3);

    const project: Project = {
      id: `p${Date.now()}`,
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority,
      status: 'active',
      progress: 0,
      startDate: input.startDate,
      dueDate: input.dueDate,
      tags: input.tags,
      color: input.color,
      members: visible.map(m => m.initials),
      moreMembers: Math.max(0, assignees.length - visible.length),
    };

    if (environment.useMock) {
      this._projects.update(ps => [...ps, project]);
      return;
    }

    const { id, ...payload } = project;
    this.http.post<Project>(`${this.apiUrl}/projects`, payload).subscribe(p => {
      this._projects.update(ps => [...ps, p]);
    });
  }

  getTaskById(taskId: string): Task | undefined {
    return this._tasks().find(t => t.id === taskId);
  }

  /** Patches arbitrary fields on a task (description, assignee, dates, etc.). */
  updateTask(taskId: string, patch: Partial<Task>): void {
    this._tasks.update(ts => ts.map(t => (t.id === taskId ? { ...t, ...patch } : t)));
    if (environment.useMock) return;
    this.http.patch<Task>(`${this.apiUrl}/tasks/${taskId}`, patch).subscribe({
      next: updated => this._tasks.update(ts => ts.map(t => (t.id === taskId ? updated : t))),
      error: () => this.refreshTasks(),
    });
  }

  getCommentsByTask(taskId: string): Comment[] {
    return this._comments().filter(c => c.taskId === taskId);
  }

  addComment(taskId: string, text: string): void {
    const me = this.currentMember;
    const comment: Comment = {
      id: `c${Date.now()}`,
      taskId,
      authorId: me.id,
      authorName: me.name,
      authorInitials: me.initials,
      authorColor: me.color,
      authorAvatarUrl: me.avatarUrl,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    this._comments.update(cs => [...cs, comment]);
    if (environment.useMock) return;
    this.http.post<Comment>(`${this.apiUrl}/tasks/${taskId}/comments`, { text }).subscribe({
      next: saved => this._comments.update(cs => cs.map(c => (c.id === comment.id ? saved : c))),
      error: () => {},
    });
  }

  updateComment(commentId: string, text: string): void {
    this._comments.update(cs => cs.map(c => (c.id === commentId ? { ...c, text: text.trim() } : c)));
    if (environment.useMock) return;
    this.http.patch<Comment>(`${this.apiUrl}/comments/${commentId}`, { text }).subscribe({ error: () => {} });
  }

  deleteComment(commentId: string): void {
    this._comments.update(cs => cs.filter(c => c.id !== commentId));
    if (environment.useMock) return;
    this.http.delete(`${this.apiUrl}/comments/${commentId}`).subscribe({ error: () => {} });
  }

  getKanbanByProject(projectId: string): { todo: Task[]; inProgress: Task[]; done: Task[] } {
    const all = this._tasks().filter(t => t.projectId === projectId);
    return {
      todo: all.filter(t => t.status === 'todo'),
      inProgress: all.filter(t => t.status === 'in-progress'),
      done: all.filter(t => t.status === 'done'),
    };
  }

  updateTaskStatus(taskId: string, status: Task['status'], resolution?: Task['resolution']): void {
    // Optimistic update for snappy kanban drag. Resolution only sticks on 'done'.
    this._tasks.update(tasks =>
      tasks.map(t =>
        t.id === taskId
          ? { ...t, status, resolution: status === 'done' ? resolution : undefined }
          : t,
      ),
    );
    if (environment.useMock) return;
    this.http
      .patch<Task>(`${this.apiUrl}/tasks/${taskId}/status`, { status, resolution })
      .subscribe({
        next: updated => this._tasks.update(ts => ts.map(t => (t.id === taskId ? updated : t))),
        error: () => this.refreshTasks(),
      });
  }

  addTask(task: Task): void {
    if (environment.useMock) {
      this._tasks.update(ts => [...ts, { ...task, id: task.id || `t${Date.now()}` }]);
      return;
    }
    const { id, ...payload } = task;
    this.http.post<Task>(`${this.apiUrl}/tasks`, payload).subscribe(t => {
      this._tasks.update(ts => [...ts, t]);
    });
  }

  /** Forces dependent computeds to recompute — used to revert a cancelled drag. */
  touchTasks(): void {
    this._tasks.update(ts => [...ts]);
  }

  /** Clears persisted mock state and reseeds from the original mock data. */
  resetMockState(): void {
    try { localStorage.removeItem(this.STORAGE_KEY); } catch { /* ignore */ }
    this._projects.set(MOCK_PROJECTS);
    this._tasks.set(MOCK_TASKS);
    this._comments.set(MOCK_COMMENTS);
  }

  private readState(): { projects: Project[]; tasks: Task[]; comments: Comment[] } | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.v !== this.STATE_VERSION || !parsed.projects || !parsed.tasks || !parsed.comments) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private refreshTasks(): void {
    this.http.get<Task[]>(`${this.apiUrl}/tasks`).subscribe(t => this._tasks.set(t));
  }
}
