import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Project, Task, ProjectStats } from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private http = inject(HttpClient);

  private _projects = signal<Project[]>([]);
  private _tasks = signal<Task[]>([]);

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
    if (this._projects().length) return;
    this.http.get<Project[]>('assets/mock/projects.json').subscribe(p => this._projects.set(p));
    this.http.get<Task[]>('assets/mock/tasks.json').subscribe(t => this._tasks.set(t));
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
    this._tasks.update(tasks =>
      tasks.map(t => (t.id === taskId ? { ...t, status } : t))
    );
  }

  addTask(task: Task): void {
    this._tasks.update(tasks => [...tasks, task]);
  }
}
