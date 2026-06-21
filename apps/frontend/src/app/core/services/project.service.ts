import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Project, Issue, IssueType, IssueStatus, Sprint, ProjectStats, TeamMember, Comment } from '../models/project.model';
import { environment } from '../../../environments/environment';
import { MOCK_PROJECTS, MOCK_ISSUES, MOCK_SPRINTS, MOCK_STATS, MOCK_TEAM, MOCK_COMMENTS } from '../mocks/projects.mock';

/** Issue types that show as cards on the board (epics group them, subtasks live in stories). */
const BOARD_TYPES: IssueType[] = ['story', 'task', 'bug'];

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
  /** Material symbol name for the project icon. */
  icon?: string;
  /** Explicit issue-key prefix (e.g. "WR"); auto-derived from the title when omitted. */
  keyPrefix?: string;
  /** Workspace the project belongs to. */
  workspaceId?: string;
}

/** Fields for creating an issue (epic / story / subtask). */
export interface NewIssueInput {
  projectId: string;
  type: IssueType;
  parentId?: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  status?: IssueStatus;
  priority?: Issue['priority'];
  assigneeId?: string;
  reporterId?: string;
  storyPoints?: number;
  estimateHours?: number;
  sprintId?: string;
  startDate?: string;
  dueDate?: string;
  color?: string;
}

/** Board grouped by the 5 FlowForge statuses. */
interface BoardColumns {
  backlog: Issue[];
  todo: Issue[];
  inProgress: Issue[];
  done: Issue[];
}

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  private _projects = signal<Project[]>([]);
  private _issues = signal<Issue[]>([]);
  private _sprints = signal<Sprint[]>([]);
  private _comments = signal<Comment[]>([]);
  private _loaded = signal(false);

  readonly projects = this._projects.asReadonly();
  readonly issues = this._issues.asReadonly();
  readonly sprints = this._sprints.asReadonly();
  readonly comments = this._comments.asReadonly();

  /** Team members available to assign (mock directory for now). */
  readonly teamMembers: TeamMember[] = MOCK_TEAM;

  /** The signed-in member, used as the author for new comments (mock). */
  readonly currentMember: TeamMember = MOCK_TEAM[0];

  // ── Mock persistence (localStorage) ──────────────────────────────────
  private readonly STORAGE_KEY = 'timixa_projects_state';
  /** Bump when the stored shape changes so stale data is discarded. */
  private readonly STATE_VERSION = 4;
  private _hydrated = signal(false);

  constructor() {
    // In mock mode, persist any change so it survives a page refresh.
    if (environment.useMock) {
      effect(() => {
        if (!this._hydrated()) return;
        const state = {
          v: this.STATE_VERSION,
          projects: this._projects(),
          issues: this._issues(),
          sprints: this._sprints(),
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
        this._issues.set(saved.issues);
        this._sprints.set(saved.sprints);
        this._comments.set(saved.comments);
      } else {
        this._projects.set(MOCK_PROJECTS);
        this._issues.set(MOCK_ISSUES);
        this._sprints.set(MOCK_SPRINTS);
        this._comments.set(MOCK_COMMENTS);
      }
      this._hydrated.set(true); // enables the persistence effect
      return;
    }

    this.http.get<Project[]>(`${this.apiUrl}/projects`).subscribe({
      next: p => this._projects.set(p),
      error: () => this._loaded.set(false),
    });
    this.http.get<Issue[]>(`${this.apiUrl}/issues`).subscribe({ next: i => this._issues.set(i), error: () => {} });
    this.http.get<Sprint[]>(`${this.apiUrl}/sprints`).subscribe({ next: s => this._sprints.set(s), error: () => {} });
  }

  // ── Projects ─────────────────────────────────────────────────────────
  getProjectById(id: string): Project | undefined {
    return this._projects().find(p => p.id === id);
  }

  createProject(input: NewProjectInput): Project {
    const assignees = this.teamMembers.filter(m => input.assigneeIds.includes(m.id));
    const visible = assignees.slice(0, 3);

    const project: Project = {
      id: `p${Date.now()}`,
      title: input.title.trim(),
      workspaceId: input.workspaceId,
      keyPrefix: (input.keyPrefix?.trim().toUpperCase() || this.deriveKeyPrefix(input.title)).slice(0, 4),
      description: input.description.trim(),
      priority: input.priority,
      status: 'active',
      progress: 0,
      startDate: input.startDate,
      dueDate: input.dueDate,
      tags: input.tags,
      color: input.color,
      icon: input.icon,
      members: visible.map(m => m.initials),
      moreMembers: Math.max(0, assignees.length - visible.length),
    };

    this._projects.update(ps => [...ps, project]);
    if (!environment.useMock) {
      const { id, ...payload } = project;
      this.http.post<Project>(`${this.apiUrl}/projects`, payload).subscribe(p =>
        this._projects.update(ps => ps.map(x => (x.id === id ? p : x))),
      );
    }
    return project;
  }

  private deriveKeyPrefix(title: string): string {
    const letters = title.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').join('');
    return (letters || title.slice(0, 2).toUpperCase()).slice(0, 4) || 'IS';
  }

  // ── Issues (epics / stories / subtasks) ──────────────────────────────
  getIssueById(id: string): Issue | undefined {
    return this._issues().find(i => i.id === id);
  }

  issuesByProject(projectId: string): Issue[] {
    return this._issues().filter(i => i.projectId === projectId);
  }

  childrenOf(parentId: string): Issue[] {
    return this._issues().filter(i => i.parentId === parentId);
  }

  epicsOf(projectId: string): Issue[] {
    return this._issues().filter(i => i.projectId === projectId && i.type === 'epic');
  }

  /** Board issues (stories/tasks/bugs) grouped by the 5 FlowForge statuses. */
  boardColumns(projectId: string): BoardColumns {
    const all = this._issues().filter(i => i.projectId === projectId && BOARD_TYPES.includes(i.type));
    return {
      backlog: all.filter(i => i.status === 'backlog'),
      todo: all.filter(i => i.status === 'todo'),
      inProgress: all.filter(i => i.status === 'in-progress'),
      done: all.filter(i => i.status === 'done'),
    };
  }

  subtaskCount(storyId: string): { done: number; total: number } {
    const subs = this.childrenOf(storyId);
    return { done: subs.filter(s => s.status === 'done').length, total: subs.length };
  }

  nextKey(projectId: string): string {
    const prefix = this.getProjectById(projectId)?.keyPrefix ?? 'IS';
    const nums = this._issues()
      .filter(i => i.projectId === projectId)
      .map(i => parseInt(i.key.split('-')[1] ?? '0', 10) || 0);
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${prefix}-${next}`;
  }

  createIssue(input: NewIssueInput): Issue {
    const project = this.getProjectById(input.projectId);
    const issue: Issue = {
      id: `${input.projectId}-i${Date.now()}`,
      projectId: input.projectId,
      key: this.nextKey(input.projectId),
      type: input.type,
      parentId: input.parentId,
      title: input.title.trim(),
      description: (input.description ?? '').trim(),
      acceptanceCriteria: input.acceptanceCriteria,
      status: input.status ?? 'backlog',
      priority: input.priority ?? 'medium',
      assigneeId: input.assigneeId || undefined,
      reporterId: input.reporterId ?? this.currentMember.id,
      storyPoints: input.storyPoints,
      estimateHours: input.estimateHours,
      sprintId: input.sprintId,
      startDate: input.startDate ?? project?.startDate ?? '',
      dueDate: input.dueDate ?? project?.dueDate ?? '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      color: input.color,
    };

    if (environment.useMock) {
      this._issues.update(is => [...is, issue]);
    } else {
      const { id, ...payload } = issue;
      this.http.post<Issue>(`${this.apiUrl}/issues`, payload).subscribe(i => this._issues.update(is => [...is, i]));
    }
    return issue;
  }

  updateIssue(id: string, patch: Partial<Issue>): void {
    const stamped = { ...patch, updatedAt: new Date().toISOString() };
    this._issues.update(is => is.map(i => (i.id === id ? { ...i, ...stamped } : i)));
    if (environment.useMock) return;
    this.http.patch<Issue>(`${this.apiUrl}/issues/${id}`, patch).subscribe({
      next: updated => this._issues.update(is => is.map(i => (i.id === id ? updated : i))),
      error: () => this.refreshIssues(),
    });
  }

  updateIssueStatus(id: string, status: IssueStatus, resolution?: Issue['resolution']): void {
    this._issues.update(is =>
      is.map(i => (i.id === id ? { ...i, status, resolution: status === 'done' ? resolution : undefined } : i)),
    );
    if (environment.useMock) return;
    this.http.patch<Issue>(`${this.apiUrl}/issues/${id}/status`, { status, resolution }).subscribe({
      next: updated => this._issues.update(is => is.map(i => (i.id === id ? updated : i))),
      error: () => this.refreshIssues(),
    });
  }

  /** Forces dependent computeds to recompute — used to revert a cancelled drag. */
  touchIssues(): void {
    this._issues.update(is => [...is]);
  }

  // ── Sprints ──────────────────────────────────────────────────────────
  sprintsOf(projectId: string): Sprint[] {
    return this._sprints().filter(s => s.projectId === projectId);
  }

  activeSprint(projectId: string): Sprint | undefined {
    return this._sprints().find(s => s.projectId === projectId && s.status === 'active');
  }

  // ── Comments ─────────────────────────────────────────────────────────
  getCommentsByIssue(issueId: string): Comment[] {
    return this._comments().filter(c => c.issueId === issueId);
  }

  addComment(issueId: string, text: string): void {
    const me = this.currentMember;
    const comment: Comment = {
      id: `c${Date.now()}`,
      issueId,
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
    this.http.post<Comment>(`${this.apiUrl}/issues/${issueId}/comments`, { text }).subscribe({
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

  // ── Mock state helpers ───────────────────────────────────────────────
  resetMockState(): void {
    try { localStorage.removeItem(this.STORAGE_KEY); } catch { /* ignore */ }
    this._projects.set(MOCK_PROJECTS);
    this._issues.set(MOCK_ISSUES);
    this._sprints.set(MOCK_SPRINTS);
    this._comments.set(MOCK_COMMENTS);
  }

  private readState(): { projects: Project[]; issues: Issue[]; sprints: Sprint[]; comments: Comment[] } | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.v !== this.STATE_VERSION || !parsed.projects || !parsed.issues || !parsed.comments) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private refreshIssues(): void {
    this.http.get<Issue[]>(`${this.apiUrl}/issues`).subscribe(i => this._issues.set(i));
  }
}
