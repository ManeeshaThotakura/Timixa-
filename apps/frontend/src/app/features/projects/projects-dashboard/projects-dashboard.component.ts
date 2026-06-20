import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../../core/services/project.service';
import { Project, TeamMember, Task } from '../../../core/models/project.model';
import { typeInfo, TaskTypeDef } from '../task-meta';

const AVATAR_COLORS = ['#451de3', '#006688', '#4b4f52', '#00c1fd', '#ba1a1a'];
const PROJECT_COLORS = ['#451de3', '#00c1fd', '#006688', '#15803d', '#ba1a1a', '#4b4f52'];

const STATUS_STYLE: Record<Task['status'], { label: string; bg: string; color: string }> = {
  'todo':        { label: 'Open',        bg: '#e2e2e5', color: '#43474a' },
  'in-progress': { label: 'In Progress', bg: '#e4dfff', color: '#3c03dd' },
  'done':        { label: 'Closed',      bg: '#dcfce7', color: '#16a34a' },
};

@Component({
  selector: 'app-projects-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `],
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

      <!-- Project Cards (List view) -->
      <section *ngIf="viewMode === 'list'" class="flex flex-col gap-4">
        <div *ngFor="let project of projects()"
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

              <!-- Avatar stack / unassigned -->
              <div class="mt-2">
                <div *ngIf="!isUnassigned(project); else unassigned" class="flex -space-x-3">
                  <div *ngFor="let m of project.members; let ai = index"
                       class="w-9 h-9 rounded-full border-2 border-white overflow-hidden flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                       [style.background]="avatarColor(ai)"
                       [style.zIndex]="10 - ai">
                    <img *ngIf="avatarPhoto(m) as url; else cardInitial" [src]="url" [alt]="m"
                         class="w-full h-full object-cover" />
                    <ng-template #cardInitial>{{ m }}</ng-template>
                  </div>
                  <div *ngIf="project.moreMembers > 0"
                       class="w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-[12px] font-semibold text-on-surface-variant flex-shrink-0"
                       style="background:#e8e8ea; z-index:1;">
                    +{{ project.moreMembers }}
                  </div>
                </div>
                <ng-template #unassigned>
                  <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant text-[12px] font-semibold">
                    <span class="material-symbols-outlined text-[16px]">person_off</span>
                    Unassigned
                  </span>
                </ng-template>
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

      <!-- Board view (expandable projects → tasks, Jira-style) -->
      <section *ngIf="viewMode === 'grid'" class="flex flex-col gap-3">
        <div class="flex items-center justify-end gap-3 mb-1">
          <button (click)="expandAll()" class="text-[12px] font-bold text-primary">Expand all</button>
          <button (click)="collapseAll()" class="text-[12px] font-bold text-on-surface-variant">Collapse all</button>
        </div>

        <div *ngFor="let project of projects()"
             class="bg-white rounded-[20px] overflow-hidden"
             style="box-shadow:0 8px 24px rgba(94,67,251,0.04);">

          <!-- Project header row -->
          <button (click)="toggleExpand(project.id)"
                  class="w-full flex items-center gap-3 p-4 text-left active:scale-[0.99] transition-transform">
            <span class="material-symbols-outlined text-outline transition-transform duration-200"
                  [class.rotate-90]="isExpanded(project.id)">chevron_right</span>
            <div class="w-1.5 h-9 rounded-full flex-shrink-0" [style.background]="project.color"></div>
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-[16px] text-on-surface truncate font-manrope">{{ project.title }}</h3>
              <p class="text-[12px] text-on-surface-variant">{{ taskSummary(project.id) }}</p>
            </div>
            <div class="flex flex-col items-end gap-1 flex-shrink-0">
              <span class="text-[13px] font-bold" [style.color]="progressTextColor(project)">{{ project.progress }}%</span>
              <div class="w-16 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                <div class="h-full rounded-full" [style.width.%]="project.progress" [style.background]="progressGradient(project)"></div>
              </div>
            </div>
          </button>

          <!-- Mini board: Open | In Progress | Closed columns (Jira-style) -->
          <div *ngIf="isExpanded(project.id)" class="border-t border-surface-container bg-surface-container-low/40 p-4">
            <div class="flex gap-3 overflow-x-auto no-scrollbar pb-1">

              <div *ngFor="let group of taskGroups(project.id)" class="min-w-[220px] w-[220px] flex-shrink-0">
                <!-- Column header -->
                <div class="flex items-center gap-2 mb-3 px-1">
                  <span class="w-2 h-2 rounded-full" [style.background]="group.color"></span>
                  <span class="text-[12px] font-bold uppercase tracking-wider" [style.color]="group.color">{{ group.label }}</span>
                  <span class="text-[11px] font-bold text-on-surface-variant bg-surface-container px-1.5 rounded-full">{{ group.tasks.length }}</span>
                </div>

                <!-- Cards -->
                <div class="flex flex-col gap-2">
                  <div *ngFor="let task of group.tasks"
                       (click)="openKanban(project.id)"
                       class="bg-white p-3 rounded-xl cursor-pointer active:scale-95 transition-transform"
                       style="box-shadow:0 8px 24px rgba(94,67,251,0.04);"
                       [class.border-l-4]="task.status === 'in-progress'"
                       [class.border-primary]="task.status === 'in-progress'">
                    <div class="mb-2">
                      <span class="text-[10px] px-2 py-0.5 rounded font-bold inline-flex items-center gap-1"
                            [style.background]="typeOf(task).bg" [style.color]="typeOf(task).color">
                        <span class="material-symbols-outlined text-[12px]">{{ typeOf(task).icon }}</span>{{ typeOf(task).short }}
                      </span>
                    </div>
                    <h4 class="text-[13px] font-semibold text-on-surface mb-3 leading-tight"
                        [class.line-through]="task.status === 'done'"
                        [class.text-on-surface-variant]="task.status === 'done'">
                      {{ task.title }}
                    </h4>
                    <div class="flex items-center justify-between">
                      <span class="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                            *ngIf="memberOf(task) as m; else taskUnassigned" [style.background]="m.color" [title]="m.name">
                        <img *ngIf="m.avatarUrl; else tmi" [src]="m.avatarUrl" [alt]="m.name" class="w-full h-full object-cover" />
                        <ng-template #tmi>{{ m.initials }}</ng-template>
                      </span>
                      <ng-template #taskUnassigned>
                        <span class="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant flex-shrink-0" title="Unassigned">
                          <span class="material-symbols-outlined text-[14px]">person</span>
                        </span>
                      </ng-template>
                      <span class="text-[11px] text-on-surface-variant font-medium flex items-center gap-1">
                        <span class="material-symbols-outlined text-[13px]">schedule</span>{{ task.estimateHours }}h
                      </span>
                    </div>
                  </div>

                  <!-- Empty column -->
                  <div *ngIf="!group.tasks.length"
                       class="text-[12px] text-on-surface-variant italic py-4 text-center rounded-xl"
                       style="border:1.5px dashed rgba(200,196,217,0.6);">
                    No tasks
                  </div>
                </div>
              </div>

            </div>

            <button (click)="openKanban(project.id)"
                    class="w-full mt-3 py-2.5 text-[13px] font-bold text-primary flex items-center justify-center gap-1 hover:bg-surface-container-low rounded-xl transition-colors">
              Open full board <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>

        <div *ngIf="projects().length === 0" class="text-center py-16 text-on-surface-variant text-sm">
          No projects yet. Tap + to create one.
        </div>
      </section>
    </div>

    <!-- FAB -->
    <button (click)="openCreate()"
            class="fixed bottom-28 right-6 w-16 h-16 rounded-full text-white flex items-center justify-center active:scale-90 transition-all duration-300 z-50"
            style="background:linear-gradient(135deg,#451de3,#00c1fd); box-shadow:0 12px 24px rgba(94,67,251,0.3);">
      <span class="material-symbols-outlined text-[32px]">add</span>
    </button>

    <!-- New Project Modal -->
    <div *ngIf="showModal"
         class="fixed inset-0 z-[9999] flex items-end justify-center"
         (click)="showModal = false">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
      <div class="relative bg-white rounded-t-[28px] w-full max-h-[88vh] overflow-y-auto p-6 pb-10"
           style="box-shadow:0 -8px 40px rgba(0,0,0,0.12);"
           (click)="$event.stopPropagation()">
        <div class="w-12 h-1 rounded-full bg-outline-variant mx-auto mb-6 sticky top-0"></div>
        <h3 class="font-bold text-[24px] text-on-surface mb-5" style="font-family:Manrope;">New Project</h3>

        <!-- Title -->
        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Project Title</label>
          <input type="text" [(ngModel)]="form.title" placeholder="e.g., Website Redesign"
                 class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[16px] font-medium outline-none border border-transparent focus:border-primary/20 transition-all" />
        </div>

        <!-- Description -->
        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Description</label>
          <textarea [(ngModel)]="form.description" placeholder="What is this project about?" rows="2"
                    class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[16px] font-medium outline-none border border-transparent focus:border-primary/20 transition-all resize-none"></textarea>
        </div>

        <!-- Priority -->
        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-2 block">Priority</label>
          <div class="bg-surface-container p-1 rounded-2xl flex gap-1">
            <button *ngFor="let p of priorities" (click)="form.priority = p"
                    class="flex-1 py-2.5 rounded-xl capitalize font-semibold text-[13px] transition-all"
                    [class]="form.priority === p
                      ? 'bg-white shadow-sm text-primary'
                      : 'text-on-surface-variant'">
              {{ p }}
            </button>
          </div>
        </div>

        <!-- Dates -->
        <div class="flex gap-3 mb-4">
          <div class="flex-1">
            <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Start Date</label>
            <input type="date" [(ngModel)]="form.startDate"
                   class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[14px] font-medium outline-none border border-transparent focus:border-primary/20 transition-all" />
          </div>
          <div class="flex-1">
            <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Due Date</label>
            <input type="date" [(ngModel)]="form.dueDate" [min]="form.startDate"
                   class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[14px] font-medium outline-none border border-transparent focus:border-primary/20 transition-all" />
          </div>
        </div>

        <!-- Assignees -->
        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-2 block">Assignees</label>

          <!-- Selected assignees -->
          <div *ngIf="selectedMembers().length" class="flex flex-wrap gap-2 mb-2">
            <span *ngFor="let m of selectedMembers()"
                  class="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-primary/10 border border-primary">
              <span class="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-white text-[10px] font-bold"
                    [style.background]="m.color">
                <img *ngIf="m.avatarUrl; else chipInit" [src]="m.avatarUrl" [alt]="m.name" class="w-full h-full object-cover" />
                <ng-template #chipInit>{{ m.initials }}</ng-template>
              </span>
              <span class="text-[13px] font-semibold text-on-surface">{{ m.name }}</span>
              <button (click)="removeAssignee(m.id)"
                      class="material-symbols-outlined text-[16px] text-on-surface-variant hover:text-error">close</button>
            </span>
          </div>

          <!-- Search -->
          <div class="relative">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">search</span>
            <input type="text" [(ngModel)]="assigneeQuery" placeholder="Search people to assign..."
                   class="w-full pl-10 pr-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[15px] font-medium outline-none border border-transparent focus:border-primary/20 transition-all" />

            <!-- Results -->
            <div *ngIf="assigneeQuery.trim()"
                 class="absolute z-20 mt-1 w-full bg-white rounded-2xl overflow-hidden max-h-52 overflow-y-auto"
                 style="box-shadow:0 8px 30px rgba(0,0,0,0.12);">
              <button *ngFor="let m of filteredMembers()" (click)="addAssignee(m.id)"
                      class="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-surface-container transition-colors text-left">
                <span class="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      [style.background]="m.color">
                  <img *ngIf="m.avatarUrl; else resultInit" [src]="m.avatarUrl" [alt]="m.name" class="w-full h-full object-cover" />
                  <ng-template #resultInit>{{ m.initials }}</ng-template>
                </span>
                <span class="text-[14px] font-semibold text-on-surface">{{ m.name }}</span>
              </button>
              <p *ngIf="!filteredMembers().length"
                 class="px-3 py-3 text-[13px] text-on-surface-variant">No people found.</p>
            </div>
          </div>

          <p *ngIf="!selectedMembers().length"
             class="text-[12px] text-on-surface-variant mt-2 flex items-center gap-1">
            <span class="material-symbols-outlined text-[16px]">info</span>
            Leave empty to create an unassigned project.
          </p>
        </div>

        <!-- Tags -->
        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Tags</label>
          <input type="text" [(ngModel)]="form.tagsInput" placeholder="Comma separated, e.g. Design, Q4"
                 class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[16px] font-medium outline-none border border-transparent focus:border-primary/20 transition-all" />
        </div>

        <!-- Color -->
        <div class="mb-6">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-2 block">Accent Color</label>
          <div class="flex gap-3">
            <button *ngFor="let c of projectColors" (click)="form.color = c"
                    class="w-9 h-9 rounded-full transition-all"
                    [style.background]="c"
                    [class]="form.color === c ? 'ring-2 ring-offset-2 ring-on-surface scale-110' : ''">
            </button>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
          <button (click)="showModal = false"
                  class="flex-1 py-3.5 rounded-2xl bg-surface-container text-on-surface-variant text-[14px] font-bold transition-all active:scale-95">
            Cancel
          </button>
          <button (click)="createProject()"
                  [disabled]="!canCreate()"
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

  teamMembers = this.projectService.teamMembers;

  viewMode: 'list' | 'grid' = 'list';
  showModal = false;
  assigneeQuery = '';

  readonly priorities: Project['priority'][] = ['low', 'medium', 'high'];
  readonly projectColors = PROJECT_COLORS;

  form = this.emptyForm();

  ngOnInit(): void { this.projectService.load(); }

  openKanban(id: string): void { this.router.navigate(['/projects', id, 'board']); }

  // ── Board view (expandable projects → tasks) ───────────────────────
  expandedProjects = signal<Set<string>>(new Set<string>());

  toggleExpand(id: string): void {
    this.expandedProjects.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  isExpanded(id: string): boolean { return this.expandedProjects().has(id); }
  expandAll(): void { this.expandedProjects.set(new Set(this.projects().map(p => p.id))); }
  collapseAll(): void { this.expandedProjects.set(new Set<string>()); }

  /** Tasks grouped into Open / In Progress / Closed sections for the board view. */
  taskGroups(projectId: string): { label: string; bg: string; color: string; tasks: Task[] }[] {
    const k = this.projectService.getKanbanByProject(projectId);
    return [
      { ...STATUS_STYLE['todo'], tasks: k.todo },
      { ...STATUS_STYLE['in-progress'], tasks: k.inProgress },
      { ...STATUS_STYLE['done'], tasks: k.done },
    ];
  }

  typeOf(task: Task): TaskTypeDef { return typeInfo(task); }
  statusOf(task: Task): { label: string; bg: string; color: string } { return STATUS_STYLE[task.status]; }
  memberOf(task: Task): TeamMember | undefined {
    return this.teamMembers.find(m => m.id === task.assigneeId);
  }

  openCreate(): void {
    this.form = this.emptyForm();
    this.assigneeQuery = '';
    this.showModal = true;
  }

  /** Members matching the search query that aren't already assigned. */
  filteredMembers(): TeamMember[] {
    const q = this.assigneeQuery.trim().toLowerCase();
    if (!q) return [];
    return this.teamMembers.filter(
      m => !this.form.assigneeIds.includes(m.id) &&
           (m.name.toLowerCase().includes(q) || m.initials.toLowerCase().includes(q)),
    );
  }

  selectedMembers(): TeamMember[] {
    return this.teamMembers.filter(m => this.form.assigneeIds.includes(m.id));
  }

  addAssignee(id: string): void {
    if (!this.form.assigneeIds.includes(id)) {
      this.form.assigneeIds = [...this.form.assigneeIds, id];
    }
    this.assigneeQuery = '';
  }

  removeAssignee(id: string): void {
    this.form.assigneeIds = this.form.assigneeIds.filter(x => x !== id);
  }

  isUnassigned(project: Project): boolean {
    return project.members.length === 0 && project.moreMembers === 0;
  }

  canCreate(): boolean {
    return this.form.title.trim().length > 0;
  }

  createProject(): void {
    if (!this.canCreate()) return;
    this.projectService.createProject({
      title: this.form.title,
      description: this.form.description,
      priority: this.form.priority,
      startDate: this.form.startDate,
      dueDate: this.form.dueDate,
      assigneeIds: this.form.assigneeIds,
      tags: this.form.tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      color: this.form.color,
    });
    this.showModal = false;
  }

  private emptyForm() {
    return {
      title: '',
      description: '',
      priority: 'medium' as Project['priority'],
      startDate: '',
      dueDate: '',
      assigneeIds: [] as string[],
      tagsInput: '',
      color: PROJECT_COLORS[0],
    };
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

  avatarColor(idx: number): string {
    return AVATAR_COLORS[idx % AVATAR_COLORS.length];
  }

  /** Resolves a card's avatar initials to a team member's profile photo, if any. */
  avatarPhoto(initials: string): string | undefined {
    return this.teamMembers.find(m => m.initials === initials)?.avatarUrl;
  }
}
