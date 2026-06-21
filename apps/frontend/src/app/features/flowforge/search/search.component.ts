import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProjectService } from '../../../core/services/project.service';
import { Issue } from '../../../core/models/project.model';
import { IssueTypeIconComponent } from '../../../shared/components/issue-type-icon/issue-type-icon.component';

@Component({
  selector: 'app-flowforge-search',
  standalone: true,
  imports: [CommonModule, IssueTypeIconComponent],
  template: `
    <div class="max-w-4xl mx-auto p-6">
      <h1 class="text-[22px] font-extrabold text-on-surface font-manrope mb-1">Search</h1>
      <p class="text-[14px] text-on-surface-variant mb-6">Results for "<b>{{ query() }}</b>"</p>

      <section class="mb-6" *ngIf="projects().length">
        <h2 class="text-[12px] font-bold text-outline uppercase tracking-wider mb-2">Projects</h2>
        <button *ngFor="let p of projects()" (click)="openProject(p.id)"
                class="w-full flex items-center gap-3 p-3 bg-white rounded-xl border border-surface-container mb-2 hover:border-primary/40 text-left">
          <span class="w-8 h-8 rounded-lg flex items-center justify-center text-white" [style.background]="p.color">
            <span class="material-symbols-outlined text-[18px]">{{ p.icon || 'folder' }}</span>
          </span>
          <span class="font-semibold text-on-surface text-[14px]">{{ p.title }}</span>
          <span class="text-[11px] font-bold text-on-surface-variant ml-auto">{{ p.keyPrefix }}</span>
        </button>
      </section>

      <section class="mb-6" *ngIf="issues().length">
        <h2 class="text-[12px] font-bold text-outline uppercase tracking-wider mb-2">Epics, Stories & Subtasks</h2>
        <button *ngFor="let i of issues()" (click)="openIssue(i)"
                class="w-full flex items-center gap-3 p-3 bg-white rounded-xl border border-surface-container mb-2 hover:border-primary/40 text-left">
          <app-issue-type-icon [type]="i.type" [size]="22"></app-issue-type-icon>
          <span class="text-[11px] font-bold text-on-surface-variant w-14">{{ i.key }}</span>
          <span class="flex-1 min-w-0 text-[14px] font-medium text-on-surface truncate">{{ i.title }}</span>
        </button>
      </section>

      <section class="mb-6" *ngIf="users().length">
        <h2 class="text-[12px] font-bold text-outline uppercase tracking-wider mb-2">People</h2>
        <div *ngFor="let u of users()" class="flex items-center gap-3 p-3 bg-white rounded-xl border border-surface-container mb-2">
          <span class="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white text-[11px] font-bold" [style.background]="u.color">
            <img *ngIf="u.avatarUrl" [src]="u.avatarUrl" [alt]="u.name" class="w-full h-full object-cover" />
            <span *ngIf="!u.avatarUrl">{{ u.initials }}</span>
          </span>
          <span class="font-semibold text-on-surface text-[14px]">{{ u.name }}</span>
        </div>
      </section>

      <p *ngIf="empty()" class="text-[14px] text-on-surface-variant italic">No results found.</p>
    </div>
  `,
})
export class SearchComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);

  query = signal('');

  private match = (text: string) => text.toLowerCase().includes(this.query().toLowerCase());

  projects = computed(() => {
    if (!this.query()) return [];
    return this.projectService.projects().filter(p => this.match(p.title) || this.match(p.keyPrefix));
  });
  issues = computed(() => {
    if (!this.query()) return [];
    return this.projectService.issues().filter(i => this.match(i.title) || this.match(i.key)).slice(0, 25);
  });
  users = computed(() => {
    if (!this.query()) return [];
    return this.projectService.teamMembers.filter(u => this.match(u.name));
  });
  empty = computed(() => !!this.query() && !this.projects().length && !this.issues().length && !this.users().length);

  constructor() {
    this.projectService.load();
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(q => this.query.set(q.get('q') ?? ''));
  }

  openProject(id: string): void { this.router.navigate(['/projects', id, 'board']); }
  openIssue(i: Issue): void {
    if (i.type === 'epic') this.router.navigate(['/projects', i.projectId, 'epics', i.id]);
    else if (i.type === 'subtask') this.router.navigate(['/projects', i.projectId, 'stories', i.parentId, 'subtasks', i.id]);
    else this.router.navigate(['/projects', i.projectId, 'stories', i.id]);
  }
}
