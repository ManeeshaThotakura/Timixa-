import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Project, Issue, IssueType, IssueStatus, Sprint, ProjectStats, TeamMember, Comment } from '../models/project.model';
import { environment } from '../../../environments/environment';

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

/**
 * Backend-first store for the Projects module. Data is loaded from and persisted to
 * the Spring Boot API (`/api/projects`, `/api/issues`, `/api/sprints`, `/api/comments`,
 * `/api/team`), which is scoped to the signed-in user and backed by CockroachDB.
 *
 * Mutations update the in-memory signals optimistically and reconcile with the server
 * response. New entities are given a client-generated UUID that is sent to the server,
 * so their ids stay stable (routing/navigation) without any id-swapping.
 */
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

  /**
   * Assignable members, loaded from `/api/team`. Kept as a stable array reference and
   * filled in place on load, so components that capture it keep seeing updates.
   */
  readonly teamMembers: TeamMember[] = [];

  /**
   * The signed-in member (comment author). Stable object reference; its fields are
   * filled in place once `/api/team/me` resolves.
   */
  readonly currentMember: TeamMember = { id: '', name: 'You', initials: '?', color: '#451de3' };

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

    this.http.get<TeamMember[]>(`${this.apiUrl}/team`).subscribe({
      next: t => this.teamMembers.splice(0, this.teamMembers.length, ...t),
      error: () => {},
    });
    this.http.get<TeamMember>(`${this.apiUrl}/team/me`).subscribe({
      next: m => Object.assign(this.currentMember, m),
      error: () => {},
    });
    this.http.get<Project[]>(`${this.apiUrl}/projects`).subscribe({
      next: p => this._projects.set(p),
      error: () => this._loaded.set(false),
    });
    this.http.get<Issue[]>(`${this.apiUrl}/issues`).subscribe({ next: i => this._issues.set(i), error: () => {} });
    this.http.get<Sprint[]>(`${this.apiUrl}/sprints`).subscribe({ next: s => this._sprints.set(s), error: () => {} });
    this.http.get<Comment[]>(`${this.apiUrl}/comments`).subscribe({ next: c => this._comments.set(c), error: () => {} });
  }

  // ── Team ─────────────────────────────────────────────────────────────
  /**
   * Adds a person who has no account yet to the shared directory, so they can be
   * assigned to projects/issues immediately. Optimistic: the new member is given a
   * client UUID (also sent to the server) and appears in `teamMembers` right away.
   */
  createTeamMember(name: string, color?: string): TeamMember {
    const id = crypto.randomUUID();
    const trimmed = name.trim();
    const member: TeamMember = {
      id,
      name: trimmed,
      initials: this.deriveInitials(trimmed),
      color: color ?? '#0891b2',
    };
    this.teamMembers.push(member);
    this.http.post<TeamMember>(`${this.apiUrl}/team`, { id, name: trimmed, color }).subscribe({
      next: saved => {
        const idx = this.teamMembers.findIndex(m => m.id === id);
        if (idx >= 0) this.teamMembers[idx] = saved;
      },
      error: () => {
        const idx = this.teamMembers.findIndex(m => m.id === id);
        if (idx >= 0) this.teamMembers.splice(idx, 1);
      },
    });
    return member;
  }

  private deriveInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const s = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.trim().slice(0, 2);
    return s.toUpperCase() || '?';
  }

  // ── Projects ─────────────────────────────────────────────────────────
  getProjectById(id: string): Project | undefined {
    return this._projects().find(p => p.id === id);
  }

  createProject(input: NewProjectInput): Project {
    const id = crypto.randomUUID();
    const assignees = this.teamMembers.filter(m => input.assigneeIds.includes(m.id));
    const visible = assignees.slice(0, 3);
    const keyPrefix = (input.keyPrefix?.trim().toUpperCase() || this.deriveKeyPrefix(input.title)).slice(0, 4);

    const project: Project = {
      id,
      title: input.title.trim(),
      workspaceId: input.workspaceId,
      keyPrefix,
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
    this.http.post<Project>(`${this.apiUrl}/projects`, {
      id,
      title: project.title,
      description: project.description,
      workspaceId: input.workspaceId,
      keyPrefix,
      priority: input.priority,
      startDate: input.startDate,
      dueDate: input.dueDate,
      tags: input.tags,
      color: input.color,
      icon: input.icon,
      memberIds: input.assigneeIds,
    }).subscribe({
      next: saved => this._projects.update(ps => ps.map(x => (x.id === id ? saved : x))),
      error: () => this._projects.update(ps => ps.filter(x => x.id !== id)),
    });
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
    const id = crypto.randomUUID();
    const project = this.getProjectById(input.projectId);
    const issue: Issue = {
      id,
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

    this._issues.update(is => [...is, issue]);
    this.http.post<Issue>(`${this.apiUrl}/issues`, {
      id,
      projectId: input.projectId,
      type: input.type,
      parentId: input.parentId,
      title: issue.title,
      description: issue.description,
      acceptanceCriteria: input.acceptanceCriteria,
      status: issue.status,
      priority: issue.priority,
      assigneeId: input.assigneeId || undefined,
      reporterId: issue.reporterId,
      storyPoints: input.storyPoints,
      estimateHours: input.estimateHours,
      sprintId: input.sprintId,
      startDate: issue.startDate,
      dueDate: issue.dueDate,
      color: input.color,
    }).subscribe({
      next: saved => this._issues.update(is => is.map(i => (i.id === id ? saved : i))),
      error: () => this._issues.update(is => is.filter(i => i.id !== id)),
    });
    return issue;
  }

  updateIssue(id: string, patch: Partial<Issue>): void {
    const stamped = { ...patch, updatedAt: new Date().toISOString() };
    this._issues.update(is => is.map(i => (i.id === id ? { ...i, ...stamped } : i)));
    this.http.patch<Issue>(`${this.apiUrl}/issues/${id}`, patch).subscribe({
      next: updated => this._issues.update(is => is.map(i => (i.id === id ? updated : i))),
      error: () => this.refreshIssues(),
    });
  }

  updateIssueStatus(id: string, status: IssueStatus, resolution?: Issue['resolution']): void {
    this._issues.update(is =>
      is.map(i => (i.id === id ? { ...i, status, resolution: status === 'done' ? resolution : undefined } : i)),
    );
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
    const tempId = crypto.randomUUID();
    const comment: Comment = {
      id: tempId,
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
    this.http.post<Comment>(`${this.apiUrl}/issues/${issueId}/comments`, { text }).subscribe({
      next: saved => this._comments.update(cs => cs.map(c => (c.id === tempId ? saved : c))),
      error: () => this._comments.update(cs => cs.filter(c => c.id !== tempId)),
    });
  }

  updateComment(commentId: string, text: string): void {
    this._comments.update(cs => cs.map(c => (c.id === commentId ? { ...c, text: text.trim() } : c)));
    this.http.patch<Comment>(`${this.apiUrl}/comments/${commentId}`, { text }).subscribe({
      next: updated => this._comments.update(cs => cs.map(c => (c.id === commentId ? updated : c))),
      error: () => {},
    });
  }

  deleteComment(commentId: string): void {
    this._comments.update(cs => cs.filter(c => c.id !== commentId));
    this.http.delete(`${this.apiUrl}/comments/${commentId}`).subscribe({ error: () => {} });
  }

  private refreshIssues(): void {
    this.http.get<Issue[]>(`${this.apiUrl}/issues`).subscribe(i => this._issues.set(i));
  }
}
