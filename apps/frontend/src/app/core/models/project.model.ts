export interface Project {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'completed' | 'paused';
  progress: number;
  dueDate: string;
  tags: string[];
  color: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
  dueDate: string;
  assignees: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface ProjectStats {
  activeCount: number;
  velocity: number;
  dueSoonCount: number;
}
