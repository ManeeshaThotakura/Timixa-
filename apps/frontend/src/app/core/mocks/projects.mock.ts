import {
  Project, Workspace, Issue, IssueStatus, IssuePriority, Sprint, ProjectStats, TeamMember, Comment,
  Activity, AppNotification,
} from '../models/project.model';

export const MOCK_WORKSPACES: Workspace[] = [
  { id: 'w1', name: 'Acme Inc',      icon: 'apartment',     color: '#451de3' },
  { id: 'w2', name: 'Side Projects', icon: 'rocket_launch', color: '#15803d' },
];

/**
 * Frontend-first mock data for the Projects module.
 * Shapes mirror the eventual API responses so swapping `environment.useMock`
 * to `false` is the only change needed once the backend is ready.
 *
 * Hierarchy: Project → Epic → Story/Task/Bug → Subtask (a single `Issue` model).
 */

export const MOCK_TEAM: TeamMember[] = [
  { id: 'u1', name: 'Chandra Teja',  initials: 'CT', color: '#451de3', avatarUrl: 'assets/avatars/chandra-teja.jpeg' },
  { id: 'u2', name: 'Eswar Aditya',  initials: 'EA', color: '#006688' },
  { id: 'u3', name: 'Maneesha',      initials: 'MA', color: '#15803d' },
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1', title: 'Website Redesign', keyPrefix: 'WR', workspaceId: 'w1',
    description: 'Revamping the core landing pages and design system integration.',
    priority: 'high', status: 'active', progress: 75,
    startDate: '2023-09-01', dueDate: '2023-10-24',
    tags: ['Design'], color: '#451de3', icon: 'web', members: ['CT', 'EA', 'MA'], moreMembers: 0,
  },
  {
    id: 'p2', title: 'Marketing Campaign', keyPrefix: 'MC', workspaceId: 'w1',
    description: 'Q4 social media blitz and influencer outreach program.',
    priority: 'medium', status: 'active', progress: 42,
    startDate: '2023-10-01', dueDate: '2023-11-12',
    tags: ['Marketing'], color: '#006688', icon: 'campaign', members: ['CT', 'MA'], moreMembers: 0,
  },
  {
    id: 'p3', title: 'Client Onboarding', keyPrefix: 'CO', workspaceId: 'w2',
    description: 'Initial documentation and kick-off meeting scheduling.',
    priority: 'low', status: 'paused', progress: 10,
    startDate: '2023-11-15', dueDate: '2023-12-01',
    tags: ['Planning'], color: '#4b4f52', icon: 'handshake', members: ['EA'], moreMembers: 0,
  },
];

const ASSIGNEE_CYCLE = ['u1', 'u2', 'u3'];
const PRIORITY_CYCLE: IssuePriority[] = ['low', 'medium', 'high', 'critical', 'lowest'];
const CREATED_AT = '2023-09-05T10:00:00Z';
const UPDATED_AT = '2023-10-02T14:30:00Z';

interface StorySpec { title: string; status: IssueStatus; points: number; subtasks: number; priority?: IssuePriority; backlog?: boolean; }
interface EpicSpec { title: string; color: string; stories: StorySpec[]; }

/** Generates the full epic/story/subtask tree for one project with sequential keys. */
function buildProjectIssues(project: Project, activeSprintId: string, epics: EpicSpec[]): Issue[] {
  const issues: Issue[] = [];
  let n = 0;
  let assign = 0;
  let prio = 0;
  const nextAssignee = () => ASSIGNEE_CYCLE[assign++ % ASSIGNEE_CYCLE.length];
  const nextPriority = () => PRIORITY_CYCLE[prio++ % PRIORITY_CYCLE.length];

  for (const epicSpec of epics) {
    const en = ++n;
    const epicId = `${project.id}-i${en}`;
    issues.push({
      id: epicId, projectId: project.id, key: `${project.keyPrefix}-${en}`,
      type: 'epic', title: epicSpec.title, description: `${epicSpec.title} epic.`,
      status: 'in-progress', priority: 'high',
      reporterId: 'u1', createdAt: CREATED_AT, updatedAt: UPDATED_AT,
      startDate: project.startDate, dueDate: project.dueDate, color: epicSpec.color,
    });

    for (const s of epicSpec.stories) {
      const sn = ++n;
      const storyId = `${project.id}-i${sn}`;
      issues.push({
        id: storyId, projectId: project.id, key: `${project.keyPrefix}-${sn}`,
        type: 'story', parentId: epicId, title: s.title,
        description: `As a user, I want ${s.title.toLowerCase()} so that the product is more useful.`,
        acceptanceCriteria: `- ${s.title} is implemented\n- Reviewed and approved\n- Covered by tests`,
        status: s.status, priority: s.priority ?? nextPriority(),
        assigneeId: nextAssignee(), reporterId: 'u1', storyPoints: s.points,
        sprintId: s.backlog ? undefined : activeSprintId,
        startDate: project.startDate, dueDate: project.dueDate,
        createdAt: CREATED_AT, updatedAt: UPDATED_AT,
        resolution: s.status === 'done' ? 'done' : undefined,
      });

      for (let k = 0; k < s.subtasks; k++) {
        const tn = ++n;
        const st: IssueStatus =
          s.status === 'done' ? 'done' : k === 0 && s.status === 'in-progress' ? 'in-progress' : 'todo';
        issues.push({
          id: `${project.id}-i${tn}`, projectId: project.id, key: `${project.keyPrefix}-${tn}`,
          type: 'subtask', parentId: storyId, title: `${s.title} — part ${k + 1}`,
          description: '', status: st, priority: 'medium',
          assigneeId: nextAssignee(), reporterId: 'u1', estimateHours: 3,
          startDate: project.startDate, dueDate: project.dueDate,
          createdAt: CREATED_AT, updatedAt: UPDATED_AT,
          resolution: st === 'done' ? 'done' : undefined,
        });
      }
    }
  }
  return issues;
}

const EPICS_P1: EpicSpec[] = [
  { title: 'Design System', color: '#7c3aed', stories: [
    { title: 'Define color tokens',      status: 'done',        points: 5, subtasks: 3 },
    { title: 'Build component library',  status: 'in-progress', points: 8, subtasks: 4 },
    { title: 'Typography scale',         status: 'done',        points: 3, subtasks: 2 },
  ]},
  { title: 'Landing Pages', color: '#2563eb', stories: [
    { title: 'Hero section redesign',    status: 'in-progress', points: 5, subtasks: 3 },
    { title: 'Pricing page',             status: 'in-progress', points: 5, subtasks: 2, priority: 'high' },
    { title: 'Footer revamp',            status: 'backlog',     points: 2, subtasks: 0, backlog: true },
  ]},
  { title: 'Performance', color: '#16a34a', stories: [
    { title: 'Image optimization',       status: 'done',        points: 3, subtasks: 1 },
    { title: 'Lighthouse audit',         status: 'backlog',     points: 3, subtasks: 0, backlog: true, priority: 'critical' },
  ]},
];

const EPICS_P2: EpicSpec[] = [
  { title: 'Social Media', color: '#0891b2', stories: [
    { title: 'Content calendar',         status: 'done',        points: 5, subtasks: 2 },
    { title: 'Reels production',          status: 'in-progress', points: 8, subtasks: 3 },
    { title: 'Hashtag research',          status: 'in-progress', points: 2, subtasks: 0 },
  ]},
  { title: 'Influencers', color: '#dc2626', stories: [
    { title: 'Outreach shortlist',        status: 'in-progress', points: 5, subtasks: 2 },
    { title: 'Contract templates',        status: 'backlog',     points: 3, subtasks: 0, backlog: true },
  ]},
];

const EPICS_P3: EpicSpec[] = [
  { title: 'Documentation', color: '#7c3aed', stories: [
    { title: 'Welcome guide',             status: 'todo',        points: 3, subtasks: 2 },
    { title: 'API reference',             status: 'backlog',     points: 5, subtasks: 0, backlog: true },
  ]},
  { title: 'Kickoff', color: '#16a34a', stories: [
    { title: 'Schedule kickoff meeting',  status: 'in-progress', points: 2, subtasks: 1 },
  ]},
];

export const MOCK_ISSUES: Issue[] = [
  ...buildProjectIssues(MOCK_PROJECTS[0], 'p1-s2', EPICS_P1),
  ...buildProjectIssues(MOCK_PROJECTS[1], 'p2-s2', EPICS_P2),
  ...buildProjectIssues(MOCK_PROJECTS[2], 'p3-s2', EPICS_P3),
];

function buildSprints(p: Project): Sprint[] {
  return [
    { id: `${p.id}-s1`, projectId: p.id, name: `${p.keyPrefix} Sprint 1`, goal: 'Project foundations',      status: 'completed', startDate: p.startDate, endDate: p.dueDate },
    { id: `${p.id}-s2`, projectId: p.id, name: `${p.keyPrefix} Sprint 2`, goal: 'Core feature delivery',    status: 'active',    startDate: p.startDate, endDate: p.dueDate },
    { id: `${p.id}-s3`, projectId: p.id, name: `${p.keyPrefix} Sprint 3`, goal: 'Polish and launch prep',   status: 'future',    startDate: p.dueDate,   endDate: p.dueDate },
  ];
}

export const MOCK_SPRINTS: Sprint[] = MOCK_PROJECTS.flatMap(buildSprints);

export const MOCK_STATS: ProjectStats = {
  activeCount: 12,
  velocity: 84,
  dueSoonCount: 3,
};

// Seed comments on a story and one of its subtasks (Website Redesign).
const COMMENT_STORY = MOCK_ISSUES.find(i => i.projectId === 'p1' && i.title === 'Build component library');
const COMMENT_SUBTASK = MOCK_ISSUES.find(i => i.parentId === COMMENT_STORY?.id);

export const MOCK_COMMENTS: Comment[] = [
  {
    id: 'c1', issueId: COMMENT_STORY?.id ?? 'p1-i3', authorId: 'u2', authorName: 'Eswar Aditya',
    authorInitials: 'EA', authorColor: '#006688',
    text: 'Started on the base components — pushing a draft for review shortly.',
    createdAt: '2023-10-02T09:15:00Z',
  },
  {
    id: 'c2', issueId: COMMENT_STORY?.id ?? 'p1-i3', authorId: 'u1', authorName: 'Chandra Teja',
    authorInitials: 'CT', authorColor: '#451de3', authorAvatarUrl: 'assets/avatars/chandra-teja.jpeg',
    text: 'Looks good. Make sure the buttons use the primary gradient.',
    createdAt: '2023-10-02T11:40:00Z',
  },
  {
    id: 'c3', issueId: COMMENT_SUBTASK?.id ?? 'p1-i4', authorId: 'u3', authorName: 'Maneesha',
    authorInitials: 'MA', authorColor: '#15803d',
    text: 'Picking this subtask up now.',
    createdAt: '2023-10-03T08:05:00Z',
  },
];

const STORY_KEY = COMMENT_STORY?.key ?? 'WR-3';
const STORY_ID = COMMENT_STORY?.id ?? 'p1-i3';

export const MOCK_ACTIVITIES: Activity[] = [
  { id: 'a1', projectId: 'p1', issueId: STORY_ID, issueKey: STORY_KEY, issueTitle: 'Build component library',
    actorId: 'u2', actorName: 'Eswar Aditya', verb: 'commented', detail: 'left a comment', createdAt: '2023-10-02T09:15:00Z' },
  { id: 'a2', projectId: 'p1', issueId: STORY_ID, issueKey: STORY_KEY, issueTitle: 'Build component library',
    actorId: 'u1', actorName: 'Chandra Teja', verb: 'status_changed', detail: 'moved to In Progress', createdAt: '2023-10-01T16:20:00Z' },
  { id: 'a3', projectId: 'p1', issueId: 'p1-i2', issueKey: 'WR-2', issueTitle: 'Define color tokens',
    actorId: 'u1', actorName: 'Chandra Teja', verb: 'completed', detail: 'marked as Done', createdAt: '2023-09-28T12:00:00Z' },
  { id: 'a4', projectId: 'p2', issueId: 'p2-i2', issueKey: 'MC-2', issueTitle: 'Content calendar',
    actorId: 'u3', actorName: 'Maneesha', verb: 'created', detail: 'created the story', createdAt: '2023-09-25T10:00:00Z' },
];

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  { id: 'n1', userId: 'u1', type: 'commented', issueId: STORY_ID, issueKey: STORY_KEY,
    actorName: 'Eswar Aditya', text: 'Eswar Aditya commented on ' + STORY_KEY, read: false, createdAt: '2023-10-02T09:15:00Z' },
  { id: 'n2', userId: 'u1', type: 'assigned', issueId: 'p1-i6', issueKey: 'WR-6',
    actorName: 'Maneesha', text: 'You were assigned to WR-6', read: false, createdAt: '2023-10-01T14:00:00Z' },
  { id: 'n3', userId: 'u1', type: 'completed', issueId: 'p1-i2', issueKey: 'WR-2',
    actorName: 'Chandra Teja', text: 'WR-2 was completed', read: true, createdAt: '2023-09-28T12:00:00Z' },
];
