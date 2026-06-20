import { Task, TaskResolution } from '../../core/models/project.model';

export interface TaskTypeDef {
  id: Task['type'];
  label: string;
  short: string;
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

export const TASK_TYPES: TaskTypeDef[] = [
  { id: 'development', label: 'Development', short: 'DEV',      icon: 'code',        color: '#2563eb', bg: '#dbeafe' },
  { id: 'bug',         label: 'Bug',         short: 'BUG',      icon: 'bug_report',  color: '#dc2626', bg: '#fee2e2' },
  { id: 'task',        label: 'Task',        short: 'TASK',     icon: 'task_alt',    color: '#0891b2', bg: '#cffafe' },
  { id: 'design',      label: 'Design',      short: 'DESIGN',   icon: 'palette',     color: '#7c3aed', bg: '#ede9fe' },
  { id: 'research',    label: 'Research',    short: 'RESEARCH', icon: 'science',     color: '#16a34a', bg: '#dcfce7' },
];

export const RESOLUTIONS: ResolutionDef[] = [
  { id: 'done',             label: 'Done',             desc: 'Work completed successfully',       icon: 'check_circle',      color: '#16a34a' },
  { id: 'incomplete',       label: 'Incomplete',       desc: 'Closed without finishing the work', icon: 'pending',           color: '#ca8a04' },
  { id: 'wont-do',          label: "Won't Do",         desc: 'Decided this work won’t proceed',   icon: 'do_not_disturb_on', color: '#6b7280' },
  { id: 'duplicate',        label: 'Duplicate',        desc: 'Already covered by another task',    icon: 'content_copy',     color: '#d97706' },
  { id: 'cannot-reproduce', label: 'Cannot Reproduce', desc: 'Issue could not be reproduced',      icon: 'help',             color: '#dc2626' },
];

export const STATUSES: { id: Task['status']; label: string; icon: string }[] = [
  { id: 'todo',        label: 'Open',        icon: 'radio_button_unchecked' },
  { id: 'in-progress', label: 'In Progress', icon: 'timelapse' },
  { id: 'done',        label: 'Closed',      icon: 'check_circle' },
];

export function typeInfo(task: Task): TaskTypeDef {
  return TASK_TYPES.find(t => t.id === task.type) ?? TASK_TYPES[0];
}

export function resolutionInfo(res: Task['resolution']): ResolutionDef {
  return RESOLUTIONS.find(r => r.id === res) ?? RESOLUTIONS[0];
}
