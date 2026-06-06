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
      { path: 'projects', loadComponent: () => import('./features/projects/projects-dashboard/projects-dashboard.component').then(m => m.ProjectsDashboardComponent) },
      { path: 'projects/:id/board', loadComponent: () => import('./features/projects/project-kanban/project-kanban.component').then(m => m.ProjectKanbanComponent) },
      { path: 'projects/:id/meeting', loadComponent: () => import('./features/projects/meeting-scheduler/meeting-scheduler.component').then(m => m.MeetingSchedulerComponent), canActivate: [adminGuard] },
      { path: 'schedule/calendar', loadComponent: () => import('./features/schedule/calendar/calendar.component').then(m => m.CalendarComponent) },
      { path: 'schedule', loadComponent: () => import('./features/schedule/schedule-day/schedule-day.component').then(m => m.ScheduleDayComponent) },
      { path: 'schedule/week', loadComponent: () => import('./features/schedule/schedule-week/schedule-week.component').then(m => m.ScheduleWeekComponent) },
      { path: 'schedule/month', loadComponent: () => import('./features/schedule/schedule-month/schedule-month.component').then(m => m.ScheduleMonthComponent) },
      { path: 'insights', loadComponent: () => import('./features/insights/insights-dashboard/insights-dashboard.component').then(m => m.InsightsDashboardComponent) },
      { path: 'reminders', loadComponent: () => import('./features/reminders/smart-reminders/smart-reminders.component').then(m => m.SmartRemindersComponent) },
      { path: 'new-task', loadComponent: () => import('./features/new-task/new-task.component').then(m => m.NewTaskComponent) },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'auth/login' },
];
