import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { onboardingGuard } from './core/guards/onboarding.guard';

export const routes: Routes = [
  {
    path: 'auth',
    children: [
      { path: 'login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
      { path: 'register', loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent) },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./features/auth/onboarding/onboarding.component').then(m => m.OnboardingComponent),
    canActivate: [authGuard, onboardingGuard],
  },
  {
    path: '',
    loadComponent: () => import('./shared/layout/app-shell/app-shell.component').then(m => m.AppShellComponent),
    canActivate: [authGuard, onboardingGuard],
    children: [
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/today-dashboard/today-dashboard.component').then(m => m.TodayDashboardComponent) },
      { path: 'projects', loadComponent: () => import('./features/projects/project-kanban/project-kanban.component').then(m => m.ProjectKanbanComponent) },
      { path: 'projects/all', loadComponent: () => import('./features/projects/projects-page/projects-page.component').then(m => m.ProjectsPageComponent) },
      { path: 'projects/workspaces', loadComponent: () => import('./features/projects/workspaces-page/workspaces-page.component').then(m => m.WorkspacesPageComponent) },
      { path: 'projects/dashboard', loadComponent: () => import('./features/flowforge/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'projects/my-work', loadComponent: () => import('./features/flowforge/my-work/my-work.component').then(m => m.MyWorkComponent) },
      { path: 'projects/search', loadComponent: () => import('./features/flowforge/search/search.component').then(m => m.SearchComponent) },
      { path: 'projects/:pid/board', loadComponent: () => import('./features/projects/project-kanban/project-kanban.component').then(m => m.ProjectKanbanComponent) },
      { path: 'projects/:pid/epics', loadComponent: () => import('./features/projects/epics-page/epics-page.component').then(m => m.EpicsPageComponent) },
      { path: 'projects/:pid/epics/:issueId', loadComponent: () => import('./features/projects/issue-detail/issue-detail.component').then(m => m.IssueDetailComponent) },
      { path: 'projects/:pid/stories/:issueId', loadComponent: () => import('./features/projects/issue-detail/issue-detail.component').then(m => m.IssueDetailComponent) },
      { path: 'projects/:pid/stories/:storyId/subtasks/:issueId', loadComponent: () => import('./features/projects/issue-detail/issue-detail.component').then(m => m.IssueDetailComponent) },
      { path: 'projects/:id/meeting', loadComponent: () => import('./features/projects/meeting-scheduler/meeting-scheduler.component').then(m => m.MeetingSchedulerComponent), canActivate: [adminGuard] },
      { path: 'schedule/calendar', loadComponent: () => import('./features/schedule/calendar/calendar.component').then(m => m.CalendarComponent) },
      { path: 'schedule', loadComponent: () => import('./features/schedule/schedule-day/schedule-day.component').then(m => m.ScheduleDayComponent) },
      { path: 'schedule/week', loadComponent: () => import('./features/schedule/schedule-week/schedule-week.component').then(m => m.ScheduleWeekComponent) },
      { path: 'schedule/month', loadComponent: () => import('./features/schedule/schedule-month/schedule-month.component').then(m => m.ScheduleMonthComponent) },
      { path: 'insights', loadComponent: () => import('./features/insights/insights-dashboard/insights-dashboard.component').then(m => m.InsightsDashboardComponent) },
      { path: 'reminders', loadComponent: () => import('./features/reminders/smart-reminders/smart-reminders.component').then(m => m.SmartRemindersComponent) },
      { path: 'new-task', loadComponent: () => import('./features/new-task/new-task.component').then(m => m.NewTaskComponent) },
      { path: 'bedtime-summary', loadComponent: () => import('./features/bedtime/bedtime-summary.component').then(m => m.BedtimeSummaryComponent) },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'auth/login' },
];
