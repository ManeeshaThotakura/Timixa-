import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProjectService } from '../../../core/services/project.service';
import { ActivityService } from '../../../core/services/activity.service';
import { Issue } from '../../../core/models/project.model';
import { BOARD_TYPES } from '../../projects/task-meta';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { PriorityBadgeComponent } from '../../../shared/components/priority-badge/priority-badge.component';
import { IssueTypeIconComponent } from '../../../shared/components/issue-type-icon/issue-type-icon.component';

@Component({
  selector: 'app-flowforge-dashboard',
  standalone: true,
  imports: [CommonModule, StatusBadgeComponent, PriorityBadgeComponent, IssueTypeIconComponent],
  template: `
    <div class="max-w-6xl mx-auto p-6">
      <h1 class="text-[26px] font-extrabold text-on-surface font-manrope mb-1">Good to see you, {{ me.name.split(' ')[0] }}</h1>
      <p class="text-[14px] text-on-surface-variant mb-6">Here's what's happening across your work.</p>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <!-- My Assigned Stories -->
        <section class="bg-white rounded-2xl p-5 border border-surface-container">
          <h2 class="text-[14px] font-bold text-on-surface mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px] text-primary">assignment_ind</span>My Assigned Stories
          </h2>
          <div class="flex flex-col">
            <button *ngFor="let s of myStories()" (click)="open(s)"
                    class="flex items-center gap-3 py-2.5 border-b border-surface-container last:border-b-0 text-left hover:bg-surface-container-low rounded-lg px-2 -mx-2">
              <app-issue-type-icon [type]="s.type" [size]="22"></app-issue-type-icon>
              <span class="text-[11px] font-bold text-on-surface-variant w-14 flex-shrink-0">{{ s.key }}</span>
              <span class="flex-1 min-w-0 text-[13px] font-medium text-on-surface truncate">{{ s.title }}</span>
              <app-priority-badge [priority]="s.priority" [showLabel]="false"></app-priority-badge>
              <app-status-badge [status]="s.status"></app-status-badge>
            </button>
            <p *ngIf="!myStories().length" class="text-[13px] text-on-surface-variant italic py-3">Nothing assigned to you. 🎉</p>
          </div>
        </section>

        <!-- Project Summary -->
        <section class="bg-white rounded-2xl p-5 border border-surface-container">
          <h2 class="text-[14px] font-bold text-on-surface mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px] text-primary">insights</span>Project Summary
          </h2>
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-xl bg-surface-container-low p-4">
              <p class="text-[24px] font-bold text-on-surface font-manrope">{{ summary().projects }}</p>
              <p class="text-[12px] text-on-surface-variant">Total Projects</p>
            </div>
            <div class="rounded-xl bg-surface-container-low p-4">
              <p class="text-[24px] font-bold text-on-surface font-manrope">{{ summary().epics }}</p>
              <p class="text-[12px] text-on-surface-variant">Active Epics</p>
            </div>
            <div class="rounded-xl bg-surface-container-low p-4">
              <p class="text-[24px] font-bold text-on-surface font-manrope">{{ summary().stories }}</p>
              <p class="text-[12px] text-on-surface-variant">Active Stories</p>
            </div>
            <div class="rounded-xl bg-surface-container-low p-4">
              <p class="text-[24px] font-bold text-primary font-manrope">{{ summary().done }}</p>
              <p class="text-[12px] text-on-surface-variant">Completed Stories</p>
            </div>
          </div>
        </section>

        <!-- Recent Activity -->
        <section class="bg-white rounded-2xl p-5 border border-surface-container">
          <h2 class="text-[14px] font-bold text-on-surface mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px] text-primary">history</span>Recent Activity
          </h2>
          <div class="flex flex-col gap-3">
            <div *ngFor="let a of activity.recent(6)" class="flex items-start gap-2 text-[13px]">
              <span class="material-symbols-outlined text-[16px] text-on-surface-variant mt-0.5">{{ verbIcon(a.verb) }}</span>
              <span class="text-on-surface">
                <b>{{ a.actorName }}</b> {{ a.detail || a.verb }}
                <b *ngIf="a.issueKey" class="text-primary">{{ a.issueKey }}</b>
                <span class="block text-[11px] text-on-surface-variant">{{ a.createdAt | date:'MMM d, h:mm a' }}</span>
              </span>
            </div>
            <p *ngIf="!activity.recent(6).length" class="text-[13px] text-on-surface-variant italic">No recent activity.</p>
          </div>
        </section>

        <!-- Upcoming Deadlines -->
        <section class="bg-white rounded-2xl p-5 border border-surface-container">
          <h2 class="text-[14px] font-bold text-on-surface mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px] text-primary">event</span>Upcoming Deadlines
          </h2>
          <div class="flex flex-col">
            <button *ngFor="let s of upcoming()" (click)="open(s)"
                    class="flex items-center gap-3 py-2.5 border-b border-surface-container last:border-b-0 text-left hover:bg-surface-container-low rounded-lg px-2 -mx-2">
              <span class="text-[11px] font-bold text-on-surface-variant w-14 flex-shrink-0">{{ s.key }}</span>
              <span class="flex-1 min-w-0 text-[13px] font-medium text-on-surface truncate">{{ s.title }}</span>
              <span class="text-[12px] font-semibold text-error">{{ s.dueDate | date:'MMM d' }}</span>
            </button>
            <p *ngIf="!upcoming().length" class="text-[13px] text-on-surface-variant italic py-3">No upcoming deadlines.</p>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class DashboardComponent {
  private projectService = inject(ProjectService);
  private router = inject(Router);
  readonly activity = inject(ActivityService);
  readonly me = this.projectService.currentMember;

  private boardIssues = computed(() => this.projectService.issues().filter(i => BOARD_TYPES.includes(i.type)));

  myStories = computed(() =>
    this.boardIssues().filter(i => i.assigneeId === this.me.id && i.status !== 'done').slice(0, 8),
  );

  summary = computed(() => {
    const issues = this.projectService.issues();
    const stories = issues.filter(i => BOARD_TYPES.includes(i.type));
    return {
      projects: this.projectService.projects().length,
      epics: issues.filter(i => i.type === 'epic').length,
      stories: stories.filter(i => i.status !== 'done').length,
      done: stories.filter(i => i.status === 'done').length,
    };
  });

  upcoming = computed(() =>
    this.boardIssues()
      .filter(i => i.status !== 'done' && i.dueDate)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 6),
  );

  constructor() { this.projectService.load(); }

  open(issue: Issue): void {
    this.router.navigate(['/projects', issue.projectId, 'stories', issue.id]);
  }

  verbIcon(verb: string): string {
    return verb === 'completed' ? 'check_circle'
      : verb === 'commented' ? 'chat_bubble'
      : verb === 'created' ? 'add_circle'
      : verb === 'status_changed' ? 'swap_horiz'
      : verb === 'assigned' ? 'person_add' : 'edit';
  }
}
