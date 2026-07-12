/** Top-level container that groups projects (like a Jira/Atlassian workspace). */
export interface Workspace {
  id: string;
  name: string;
  /** Material symbol name for the workspace icon. */
  icon?: string;
  color: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  /** Workspace this project belongs to. */
  workspaceId?: string;
  /** Short prefix used to mint issue keys, e.g. "WR" → WR-12. */
  keyPrefix: string;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'completed' | 'paused';
  progress: number;
  startDate: string;
  dueDate: string;
  tags: string[];
  color: string;
  /** Material symbol name for the project icon. */
  icon?: string;
  /** Initials of team members shown as avatar bubbles on the card. */
  members: string[];
  /** Count of additional members beyond the visible avatars (the "+N" bubble). */
  moreMembers: number;
}

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  color: string;
  /** Optional profile photo; falls back to the colored initials when absent. */
  avatarUrl?: string;
}

/** The issue levels — epic > (story|task|bug) > subtask. */
export type IssueType = 'epic' | 'story' | 'task' | 'bug' | 'subtask';

/** Workflow: Backlog → To Do → In Progress → Done. */
export type IssueStatus = 'backlog' | 'todo' | 'in-progress' | 'done';

/** FlowForge priorities (lowest → critical). */
export type IssuePriority = 'lowest' | 'low' | 'medium' | 'high' | 'critical';

/** Jira-style resolution captured when an issue is closed (moved to Done). */
export type TaskResolution =
  | 'done'
  | 'wont-do'
  | 'duplicate'
  | 'cannot-reproduce'
  | 'incomplete';

/**
 * A single node in the project hierarchy. `type` + `parentId` express the tree:
 *   epic        → parentId: undefined
 *   story/task/bug → parentId: <epicId>
 *   subtask     → parentId: <storyId>
 */
export interface Issue {
  id: string;
  projectId: string;
  key: string;
  type: IssueType;
  parentId?: string;
  title: string;
  description: string;
  /** Acceptance criteria (stories). */
  acceptanceCriteria?: string;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeId?: string;
  /** "Created By" — the reporter. */
  reporterId?: string;
  /** Story points (stories/tasks/bugs). */
  storyPoints?: number;
  /** Time estimate in hours (subtasks). */
  estimateHours?: number;
  /** Sprint the issue belongs to; undefined = backlog. */
  sprintId?: string;
  startDate: string;
  dueDate: string;
  createdAt?: string;
  updatedAt?: string;
  /** Set only when status is 'done'. */
  resolution?: TaskResolution;
  /** Accent color, used for epics. */
  color?: string;
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string;
  status: 'active' | 'future' | 'completed';
  startDate: string;
  endDate: string;
}

export interface ProjectStats {
  activeCount: number;
  velocity: number;
  dueSoonCount: number;
}

export interface Comment {
  id: string;
  /** Id of the issue (epic, story, or subtask) this comment belongs to. */
  issueId: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorColor: string;
  authorAvatarUrl?: string;
  text: string;
  createdAt: string;
}

export type ActivityVerb =
  | 'created' | 'updated' | 'completed' | 'commented' | 'assigned' | 'status_changed';

export interface Activity {
  id: string;
  projectId: string;
  issueId?: string;
  issueKey?: string;
  issueTitle?: string;
  actorId: string;
  actorName: string;
  verb: ActivityVerb;
  detail?: string;
  createdAt: string;
}

export type NotificationType =
  | 'assigned' | 'completed' | 'updated' | 'commented' | 'subtask_completed';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  issueId?: string;
  issueKey?: string;
  actorName: string;
  text: string;
  read: boolean;
  createdAt: string;
}
