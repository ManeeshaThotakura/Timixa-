import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../../core/services/project.service';
import { Issue } from '../../../core/models/project.model';
import { BOARD_TYPES, PRIORITIES } from '../../projects/task-meta';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { PriorityBadgeComponent } from '../../../shared/components/priority-badge/priority-badge.component';
import { IssueTypeIconComponent } from '../../../shared/components/issue-type-icon/issue-type-icon.component';

@Component({
  selector: 'app-flowforge-my-work',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusBadgeComponent, PriorityBadgeComponent, IssueTypeIconComponent],
  template: `
    <div class="max-w-5xl mx-auto p-6">
      <h1 class="text-[24px] font-extrabold text-on-surface font-manrope mb-1">My Work</h1>
      <p class="text-[14px] text-on-surface-variant mb-5">Everything assigned to you across projects.</p>

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-2 mb-6">
        <select [ngModel]="projectFilter()" (ngModelChange)="projectFilter.set($event)" class="px-3 py-2 rounded-xl bg-white border border-surface-container text-[13px] font-medium">
          <option value="all">All projects</option>
          <option *ngFor="let p of projectService.projects()" [value]="p.id">{{ p.title }}</option>
        </select>
        <select [ngModel]="priorityFilter()" (ngModelChange)="priorityFilter.set($event)" class="px-3 py-2 rounded-xl bg-white border border-surface-container text-[13px] font-medium capitalize">
          <option value="all">All priorities</option>
          <option *ngFor="let p of priorities" [value]="p.id">{{ p.label }}</option>
        </select>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <section *ngFor="let group of groups()" class="bg-white rounded-2xl border border-surface-container p-4">
          <h2 class="text-[13px] font-bold text-on-surface mb-3 flex items-center justify-between">
            {{ group.label }}
            <span class="text-[11px] font-bold text-on-surface-variant bg-surface-container px-1.5 rounded-full">{{ group.items.length }}</span>
          </h2>
          <div class="flex flex-col gap-2">
            <button *ngFor="let s of group.items" (click)="open(s)"
                    class="text-left p-3 rounded-xl border border-surface-container hover:border-primary/40 hover:bg-surface-container-low transition-all">
              <div class="flex items-center gap-2 mb-1">
                <app-issue-type-icon [type]="s.type" [size]="18"></app-issue-type-icon>
                <span class="text-[11px] font-bold text-on-surface-variant">{{ s.key }}</span>
                <app-priority-badge class="ml-auto" [priority]="s.priority" [showLabel]="false"></app-priority-badge>
              </div>
              <p class="text-[13px] font-medium text-on-surface leading-tight mb-2">{{ s.title }}</p>
              <app-status-badge [status]="s.status"></app-status-badge>
            </button>
            <p *ngIf="!group.items.length" class="text-[12px] text-on-surface-variant italic py-2">Nothing here.</p>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class MyWorkComponent {
  readonly projectService = inject(ProjectService);
  private router = inject(Router);
  private me = this.projectService.currentMember;
  readonly priorities = PRIORITIES;

  projectFilter = signal<string>('all');
  priorityFilter = signal<string>('all');

  // ngModel writes to the signal via two-way? Use plain fields instead for template [(ngModel)].
  private mine = computed(() =>
    this.projectService.issues().filter(i => BOARD_TYPES.includes(i.type) && i.assigneeId === this.me.id),
  );

  groups = computed(() => {
    const pf = this.projectFilter();
    const prf = this.priorityFilter();
    const filtered = this.mine().filter(i =>
      (pf === 'all' || i.projectId === pf) && (prf === 'all' || i.priority === prf),
    );
    const inBucket = (i: Issue, bucket: 'todo' | 'progress' | 'done') =>
      bucket === 'todo' ? (i.status === 'backlog' || i.status === 'todo')
      : bucket === 'progress' ? (i.status === 'in-progress')
      : i.status === 'done';
    return [
      { label: 'To Do', items: filtered.filter(i => inBucket(i, 'todo')) },
      { label: 'In Progress', items: filtered.filter(i => inBucket(i, 'progress')) },
      { label: 'Done', items: filtered.filter(i => inBucket(i, 'done')) },
    ];
  });

  constructor() { this.projectService.load(); }

  open(issue: Issue): void {
    this.router.navigate(['/projects', issue.projectId, 'stories', issue.id]);
  }
}
