import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../../core/services/project.service';
import { Project } from '../../../core/models/project.model';

const AVATAR_COLORS = ['#451de3', '#006688', '#4b4f52', '#00c1fd', '#ba1a1a'];

@Component({
  selector: 'app-projects-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="px-margin-page pt-stack-md pb-4">

      <!-- Header -->
      <section class="flex flex-col gap-unit mb-stack-lg">
        <div class="flex justify-between items-end">
          <div>
            <h1 class="font-bold text-[32px] text-on-surface leading-tight tracking-tight" style="font-family:Manrope;">
              Projects
            </h1>
            <p class="text-[16px] text-on-surface-variant">Manage your active workflows</p>
          </div>
          <!-- View toggle -->
          <div class="bg-surface-container-high p-1 rounded-xl flex gap-1">
            <button (click)="viewMode = 'list'"
                    class="px-4 py-2 rounded-lg flex items-center gap-2 font-semibold text-[12px] transition-all"
                    [class]="viewMode === 'list'
                      ? 'bg-surface-container-lowest shadow-sm text-primary'
                      : 'text-on-surface-variant hover:bg-surface-container-lowest/50'">
              <span class="material-symbols-outlined text-[18px]">list</span>List
            </button>
            <button (click)="viewMode = 'grid'"
                    class="px-4 py-2 rounded-lg flex items-center gap-2 font-semibold text-[12px] transition-all"
                    [class]="viewMode === 'grid'
                      ? 'bg-surface-container-lowest shadow-sm text-primary'
                      : 'text-on-surface-variant hover:bg-surface-container-lowest/50'">
              <span class="material-symbols-outlined text-[18px]">grid_view</span>Board
            </button>
          </div>
        </div>
      </section>

      <!-- Stats Bento -->
      <section class="grid grid-cols-2 gap-4 mb-stack-lg">

        <!-- Active Projects — spans full width -->
        <div class="col-span-2 p-6 rounded-[24px] border border-white/50 flex flex-col justify-between min-h-[140px]"
             style="background:rgba(255,255,255,0.7); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
                    box-shadow:0 8px 24px rgba(94,67,251,0.04);">
          <div class="flex justify-between items-start">
            <div class="w-10 h-10 rounded-full flex items-center justify-center"
                 style="background:rgba(69,29,227,0.1);">
              <span class="material-symbols-outlined text-primary">rocket_launch</span>
            </div>
            <span class="font-bold text-[24px] text-primary" style="font-family:Manrope;">
              {{ stats().activeCount }}
            </span>
          </div>
          <div>
            <p class="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Active Projects</p>
            <p class="text-[16px] text-primary font-semibold">+2 this week</p>
          </div>
        </div>

        <!-- Velocity -->
        <div class="p-6 rounded-[24px] border border-white/50 flex flex-col justify-between"
             style="background:rgba(255,255,255,0.7); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
                    box-shadow:0 8px 24px rgba(94,67,251,0.04);">
          <div class="w-10 h-10 rounded-full flex items-center justify-center"
               style="background:rgba(0,193,253,0.2);">
            <span class="material-symbols-outlined text-secondary">done_all</span>
          </div>
          <div>
            <p class="font-bold text-[24px] text-on-surface" style="font-family:Manrope;">
              {{ stats().velocity }}%
            </p>
            <p class="text-[12px] font-semibold text-on-surface-variant">Velocity</p>
          </div>
        </div>

        <!-- Due Soon -->
        <div class="p-6 rounded-[24px] border border-white/50 flex flex-col justify-between"
             style="background:rgba(255,255,255,0.7); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
                    box-shadow:0 8px 24px rgba(94,67,251,0.04);">
          <div class="w-10 h-10 rounded-full flex items-center justify-center"
               style="background:rgba(255,218,214,0.5);">
            <span class="material-symbols-outlined text-error">schedule</span>
          </div>
          <div>
            <p class="font-bold text-[24px] text-on-surface" style="font-family:Manrope;">
              {{ stats().dueSoonCount }}
            </p>
            <p class="text-[12px] font-semibold text-on-surface-variant">Due Soon</p>
          </div>
        </div>

      </section>

      <!-- Project Cards -->
      <section class="flex flex-col gap-4">
        <div *ngFor="let project of projects(); let i = index"
             (click)="openKanban(project.id)"
             class="bg-white p-6 rounded-[24px] relative overflow-hidden cursor-pointer transition-all duration-300"
             [style.opacity]="project.status === 'paused' ? '0.85' : '1'"
             style="box-shadow:0 8px 24px rgba(94,67,251,0.04);">

          <!-- Badge top-right -->
          <div class="absolute top-0 right-0 p-4">
            <span class="px-3 py-1 rounded-full font-semibold text-[12px]"
                  [style.background]="badgeBg(project)"
                  [style.color]="badgeColor(project)">
              {{ badgeLabel(project) }}
            </span>
          </div>

          <div class="flex flex-col gap-6">

            <!-- Title + meta -->
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <div class="w-2 h-8 rounded-full flex-shrink-0" [style.background]="project.color"></div>
                <h3 class="font-bold text-[24px] text-on-surface" style="font-family:Manrope;">
                  {{ project.title }}
                </h3>
              </div>
              <p class="text-[16px] text-on-surface-variant mb-4">{{ project.description }}</p>

              <div class="flex items-center gap-4 text-on-surface-variant">
                <div class="flex items-center gap-1">
                  <span class="material-symbols-outlined text-[18px]">calendar_today</span>
                  <span class="text-[12px] font-semibold">{{ project.dueDate | date:'MMM d, y' }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <span class="material-symbols-outlined text-[18px]">task_alt</span>
                  <span class="text-[12px] font-semibold">{{ taskSummary(project.id) }}</span>
                </div>
              </div>
            </div>

            <!-- Progress + avatars -->
            <div class="flex flex-col gap-4">
              <div class="flex justify-between items-center">
                <span class="text-[12px] font-bold text-on-surface">Progress</span>
                <span class="text-[12px] font-bold" [style.color]="progressTextColor(project)">
                  {{ project.progress }}%
                </span>
              </div>
              <div class="w-full h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500"
                     [style.width.%]="project.progress"
                     [style.background]="progressGradient(project)">
                </div>
              </div>

              <!-- Avatar stack -->
              <div class="flex -space-x-3 mt-2">
                <div *ngFor="let c of avatarColors(i); let ai = index"
                     class="w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                     [style.background]="c"
                     [style.zIndex]="10 - ai">
                  {{ avatarInitials[ai] }}
                </div>
                <div class="w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-[12px] font-semibold text-on-surface-variant flex-shrink-0"
                     style="background:#e8e8ea; z-index:1;">
                  +{{ overflowCount(i) }}
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Empty state -->
        <div *ngIf="projects().length === 0"
             class="text-center py-16 text-on-surface-variant text-sm">
          No projects yet. Tap + to create one.
        </div>
      </section>
    </div>

    <!-- FAB -->
    <button (click)="showModal = true"
            class="fixed bottom-28 right-6 w-16 h-16 rounded-full text-white flex items-center justify-center active:scale-90 transition-all duration-300 z-50"
            style="background:linear-gradient(135deg,#451de3,#00c1fd); box-shadow:0 12px 24px rgba(94,67,251,0.3);">
      <span class="material-symbols-outlined text-[32px]">add</span>
    </button>

    <!-- New Project Modal -->
    <div *ngIf="showModal"
         class="fixed inset-0 z-[9999] flex items-end justify-center"
         (click)="showModal = false">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
      <div class="relative bg-white rounded-t-[28px] w-full p-6 pb-10"
           style="box-shadow:0 -8px 40px rgba(0,0,0,0.12);"
           (click)="$event.stopPropagation()">
        <div class="w-12 h-1 rounded-full bg-outline-variant mx-auto mb-6"></div>
        <h3 class="font-bold text-[24px] text-on-surface mb-5" style="font-family:Manrope;">New Project</h3>
        <div class="mb-3">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Project Title</label>
          <input type="text" [(ngModel)]="newProjectTitle" placeholder="e.g., Website Redesign"
                 class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[16px] font-medium outline-none border border-transparent focus:border-primary/20 transition-all" />
        </div>
        <div class="mb-6">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Description</label>
          <input type="text" [(ngModel)]="newProjectDesc" placeholder="Short description"
                 class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[16px] font-medium outline-none border border-transparent focus:border-primary/20 transition-all" />
        </div>
        <div class="flex gap-3">
          <button (click)="showModal = false"
                  class="flex-1 py-3.5 rounded-2xl bg-surface-container text-on-surface-variant text-[14px] font-bold transition-all active:scale-95">
            Cancel
          </button>
          <button (click)="addProject()"
                  [disabled]="!newProjectTitle.trim()"
                  class="flex-1 py-3.5 rounded-2xl text-white text-[14px] font-bold transition-all active:scale-95 disabled:opacity-40"
                  style="background:linear-gradient(135deg,#451de3,#00c1fd);">
            Create
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ProjectsDashboardComponent implements OnInit {
  private projectService = inject(ProjectService);
  private router         = inject(Router);

  projects = this.projectService.projects;
  stats    = this.projectService.stats;

  viewMode: 'list' | 'grid' = 'list';
  showModal       = false;
  newProjectTitle = '';
  newProjectDesc  = '';

  readonly avatarInitials = ['A', 'B', 'C'];

  ngOnInit(): void { this.projectService.load(); }

  openKanban(id: string): void { this.router.navigate(['/projects', id, 'board']); }

  addProject(): void {
    if (!this.newProjectTitle.trim()) return;
    this.newProjectTitle = '';
    this.newProjectDesc  = '';
    this.showModal       = false;
  }

  taskSummary(projectId: string): string {
    const k = this.projectService.getKanbanByProject(projectId);
    const total = k.todo.length + k.inProgress.length + k.done.length;
    return total ? `${k.done.length}/${total} Tasks` : 'No tasks yet';
  }

  badgeLabel(project: Project): string {
    if (project.priority === 'high') return 'High Priority';
    if (project.status === 'paused') return 'Planning';
    return project.tags[0] ?? 'Active';
  }

  badgeBg(project: Project): string {
    if (project.priority === 'high') return 'rgba(69,29,227,0.1)';
    if (project.status === 'paused') return '#e0e3e6';
    return 'rgba(0,193,253,0.1)';
  }

  badgeColor(project: Project): string {
    if (project.priority === 'high') return '#451de3';
    if (project.status === 'paused') return '#43474a';
    return '#006688';
  }

  progressGradient(project: Project): string {
    if (project.priority === 'high')   return 'linear-gradient(90deg,#451de3,#00c1fd)';
    if (project.status === 'paused')   return '#4b4f52';
    return 'linear-gradient(90deg,#00c1fd,#e4dfff)';
  }

  progressTextColor(project: Project): string {
    if (project.priority === 'high') return '#451de3';
    if (project.status === 'paused') return '#787588';
    return '#006688';
  }

  avatarColors(idx: number): string[] {
    return [
      AVATAR_COLORS[idx % AVATAR_COLORS.length],
      AVATAR_COLORS[(idx + 1) % AVATAR_COLORS.length],
    ];
  }

  overflowCount(idx: number): number {
    return (idx % 3) + 1;
  }
}
