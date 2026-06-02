import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Project, Task, ProjectStats } from '../models/project.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  private _projects = signal<Project[]>([]);
  private _tasks = signal<Task[]>([]);
  private _loaded = signal(false);

  readonly projects = this._projects.asReadonly();
  readonly tasks = this._tasks.asReadonly();

  readonly stats = computed<ProjectStats>(() => {
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

  getKanbanByProject(projectId: string): { todo: Task[]; inProgress: Task[]; done: Task[] } {
    const all = this._tasks().filter(t => t.projectId === projectId);
    return {
      todo: all.filter(t => t.status === 'todo'),
      inProgress: all.filter(t => t.status === 'in-progress'),
      done: all.filter(t => t.status === 'done'),
    };
  }

  updateTaskStatus(taskId: string, status: Task['status']): void {
    // Optimistic update for snappy kanban drag
    this._tasks.update(tasks => tasks.map(t => (t.id === taskId ? { ...t, status } : t)));
    this.http
      .patch<Task>(`${this.apiUrl}/tasks/${taskId}/status`, { status })
      .subscribe({
        next: updated => this._tasks.update(ts => ts.map(t => (t.id === taskId ? updated : t))),
        error: () => this.refreshTasks(),
      });
  }

  addTask(task: Task): void {
    const { id, ...payload } = task;
    this.http.post<Task>(`${this.apiUrl}/tasks`, payload).subscribe(t => {
      this._tasks.update(ts => [...ts, t]);
    });
  }

  private refreshTasks(): void {
    this.http.get<Task[]>(`${this.apiUrl}/tasks`).subscribe(t => this._tasks.set(t));
  }
}
