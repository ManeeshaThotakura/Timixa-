import { Project, Task, ProjectStats, TeamMember, Comment } from '../models/project.model';

/**
 * Frontend-first mock data for the Projects module.
 * Shapes mirror the eventual API responses so swapping `environment.useMock`
 * to `false` is the only change needed once the backend is ready.
 */

export const MOCK_TEAM: TeamMember[] = [
  { id: 'u1', name: 'Chandra Teja',  initials: 'CT', color: '#451de3', avatarUrl: 'assets/avatars/chandra-teja.jpeg' },
  { id: 'u2', name: 'Eswar Aditya',  initials: 'EA', color: '#006688' },
  { id: 'u3', name: 'Maneesha',      initials: 'MA', color: '#15803d' },
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1',
    title: 'Website Redesign',
    description: 'Revamping the core landing pages and design system integration.',
    priority: 'high',
    status: 'active',
    progress: 75,
    startDate: '2023-09-01',
    dueDate: '2023-10-24',
    tags: ['Design'],
    color: '#451de3',
    members: ['CT', 'EA', 'MA'],
    moreMembers: 0,
  },
  {
    id: 'p2',
    title: 'Marketing Campaign',
    description: 'Q4 social media blitz and influencer outreach program.',
    priority: 'medium',
    status: 'active',
    progress: 42,
    startDate: '2023-10-01',
    dueDate: '2023-11-12',
    tags: ['Marketing'],
    color: '#006688',
    members: ['CT', 'MA'],
    moreMembers: 0,
  },
  {
    id: 'p3',
    title: 'Client Onboarding',
    description: 'Initial documentation and kick-off meeting scheduling.',
    priority: 'low',
    status: 'paused',
    progress: 10,
    startDate: '2023-11-15',
    dueDate: '2023-12-01',
    tags: ['Planning'],
    color: '#4b4f52',
    members: ['EA'],
    moreMembers: 0,
  },
];

/**
 * Generates `total` tasks for a project with `done` completed and
 * `inProgress` in progress (the remainder land in the To Do column).
 * This keeps the dashboard task counts (e.g. "18/24") and the kanban
 * board consistent from a single source.
 */
const TASK_TYPE_CYCLE: Task['type'][] = ['development', 'bug', 'task', 'design', 'research'];
const ASSIGNEE_CYCLE = ['u1', 'u2', 'u3'];

function buildTasks(projectId: string, total: number, done: number, inProgress: number): Task[] {
  const tasks: Task[] = [];
  for (let i = 0; i < total; i++) {
    const status: Task['status'] = i < done ? 'done' : i < done + inProgress ? 'in-progress' : 'todo';
    tasks.push({
      id: `${projectId}-t${i + 1}`,
      projectId,
      title: `Task ${i + 1}`,
      description: '',
      type: TASK_TYPE_CYCLE[i % TASK_TYPE_CYCLE.length],
      status,
      priority: 'medium',
      startDate: '2023-11-01',
      dueDate: '2023-11-30',
      estimateHours: 4,
      assigneeId: ASSIGNEE_CYCLE[i % ASSIGNEE_CYCLE.length],
      resolution: status === 'done' ? 'done' : undefined,
    });
  }
  return tasks;
}

export const MOCK_TASKS: Task[] = [
  ...buildTasks('p1', 24, 18, 3), // 18/24 Tasks
  ...buildTasks('p2', 12, 5, 4), //  5/12 Tasks
  ...buildTasks('p3', 10, 1, 2), //  1/10 Tasks
];

export const MOCK_STATS: ProjectStats = {
  activeCount: 12,
  velocity: 84,
  dueSoonCount: 3,
};

export const MOCK_COMMENTS: Comment[] = [
  {
    id: 'c1', taskId: 'p1-t1', authorId: 'u2', authorName: 'Eswar Aditya',
    authorInitials: 'EA', authorColor: '#006688',
    text: 'Started on the landing hero — pushing a draft for review shortly.',
    createdAt: '2023-10-02T09:15:00Z',
  },
  {
    id: 'c2', taskId: 'p1-t1', authorId: 'u1', authorName: 'Chandra Teja',
    authorInitials: 'CT', authorColor: '#451de3', authorAvatarUrl: 'assets/avatars/chandra-teja.jpeg',
    text: 'Looks good. Make sure the CTA uses the primary gradient.',
    createdAt: '2023-10-02T11:40:00Z',
  },
];
