import { Issue, IssueType, IssueStatus, IssuePriority, TaskResolution } from '../../core/models/project.model';

export interface IssueTypeDef {
  id: IssueType;
  label: string;
  short: string;
  icon: string;
  color: string;
  bg: string;
}

export interface StatusDef {
  id: IssueStatus;
  label: string;
  icon: string;
  color: string;
  bg: string;
}

export interface PriorityDef {
  id: IssuePriority;
  label: string;
  icon: string;
  color: string;
  bg: string;
}

export interface ResolutionDef {
  id: TaskResolution;
  label: string;
  desc: string;
  icon: string;
  color: string;
}

export const ISSUE_TYPES: IssueTypeDef[] = [
  { id: 'epic',    label: 'Epic',    short: 'EPIC',  icon: 'bolt',       color: '#7c3aed', bg: '#ede9fe' },
  { id: 'story',   label: 'Story',   short: 'STORY', icon: 'bookmark',   color: '#16a34a', bg: '#dcfce7' },
  { id: 'task',    label: 'Task',    short: 'TASK',  icon: 'task_alt',   color: '#0891b2', bg: '#cffafe' },
  { id: 'bug',     label: 'Bug',     short: 'BUG',   icon: 'bug_report', color: '#dc2626', bg: '#fee2e2' },
  { id: 'subtask', label: 'Subtask', short: 'SUB',   icon: 'check_box',  color: '#2563eb', bg: '#dbeafe' },
];

/** Issue types that show as cards on the board (epics group them, subtasks live in stories). */
export const BOARD_TYPES: IssueType[] = ['story', 'task', 'bug'];
export const SUBTASK_TYPES: IssueType[] = ['subtask'];

/** FlowForge workflow columns, left → right. */
export const STATUSES: StatusDef[] = [
  { id: 'backlog',     label: 'Backlog',     icon: 'inventory_2',            color: '#6b7280', bg: '#f1f1f3' },
  { id: 'todo',        label: 'To Do',       icon: 'radio_button_unchecked', color: '#475569', bg: '#e2e8f0' },
  { id: 'in-progress', label: 'In Progress', icon: 'timelapse',              color: '#2563eb', bg: '#dbeafe' },
  { id: 'done',        label: 'Done',        icon: 'check_circle',           color: '#16a34a', bg: '#dcfce7' },
];

/** Priorities lowest → critical, with colored badges. */
export const PRIORITIES: PriorityDef[] = [
  { id: 'lowest',   label: 'Lowest',   icon: 'keyboard_double_arrow_down', color: '#6b7280', bg: '#f1f1f3' },
  { id: 'low',      label: 'Low',      icon: 'keyboard_arrow_down',        color: '#2563eb', bg: '#dbeafe' },
  { id: 'medium',   label: 'Medium',   icon: 'drag_handle',                color: '#ca8a04', bg: '#fef9c3' },
  { id: 'high',     label: 'High',     icon: 'keyboard_arrow_up',          color: '#ea580c', bg: '#ffedd5' },
  { id: 'critical', label: 'Critical', icon: 'keyboard_double_arrow_up',   color: '#dc2626', bg: '#fee2e2' },
];

export const RESOLUTIONS: ResolutionDef[] = [
  { id: 'done',             label: 'Done',             desc: 'Work completed successfully',       icon: 'check_circle',      color: '#16a34a' },
  { id: 'incomplete',       label: 'Incomplete',       desc: 'Closed without finishing the work', icon: 'pending',           color: '#ca8a04' },
  { id: 'wont-do',          label: "Won't Do",         desc: 'Decided this work won’t proceed',   icon: 'do_not_disturb_on', color: '#6b7280' },
  { id: 'duplicate',        label: 'Duplicate',        desc: 'Already covered by another issue',   icon: 'content_copy',     color: '#d97706' },
  { id: 'cannot-reproduce', label: 'Cannot Reproduce', desc: 'Issue could not be reproduced',      icon: 'help',             color: '#dc2626' },
];

export function issueTypeInfo(type: IssueType): IssueTypeDef {
  return ISSUE_TYPES.find(t => t.id === type) ?? ISSUE_TYPES[1];
}
export function typeInfo(issue: Issue): IssueTypeDef {
  return issueTypeInfo(issue.type);
}
export function statusInfo(status: IssueStatus): StatusDef {
  return STATUSES.find(s => s.id === status) ?? STATUSES[0];
}
export function priorityInfo(priority: IssuePriority): PriorityDef {
  return PRIORITIES.find(p => p.id === priority) ?? PRIORITIES[2];
}
export function resolutionInfo(res: TaskResolution | undefined): ResolutionDef {
  return RESOLUTIONS.find(r => r.id === res) ?? RESOLUTIONS[0];
}
