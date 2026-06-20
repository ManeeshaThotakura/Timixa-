export interface Project {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'completed' | 'paused';
  progress: number;
  startDate: string;
  dueDate: string;
  tags: string[];
  color: string;
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

export type TaskType = 'development' | 'bug' | 'task' | 'design' | 'research';

export type TaskStatus = 'todo' | 'in-progress' | 'done';

/** Jira-style resolution captured when a task is closed (moved to Done). */
export type TaskResolution =
  | 'done'
  | 'wont-do'
  | 'duplicate'
  | 'cannot-reproduce'
  | 'incomplete';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: 'high' | 'medium' | 'low';
  startDate: string;
  dueDate: string;
  estimateHours: number;
  /** Id of the assigned TeamMember; empty/undefined means unassigned. */
  assigneeId?: string;
  /** Set only when status is 'done'. */
  resolution?: TaskResolution;
}

export interface ProjectStats {
  activeCount: number;
  velocity: number;
  dueSoonCount: number;
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorColor: string;
  authorAvatarUrl?: string;
  text: string;
  createdAt: string;
}
