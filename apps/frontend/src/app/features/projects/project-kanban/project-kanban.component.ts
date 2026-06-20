import { Component, OnInit, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ProjectService } from '../../../core/services/project.service';
import { Task, TeamMember, TaskResolution } from '../../../core/models/project.model';
import { TaskDetailComponent } from '../task-detail/task-detail.component';
import { TASK_TYPES, RESOLUTIONS, STATUSES, TaskTypeDef, ResolutionDef } from '../task-meta';

@Component({
  selector: 'app-project-kanban',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, TaskDetailComponent],
  styles: [`
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `],
  template: `
    <!-- Project nav bar -->
    <div class="sticky top-0 z-40 flex items-center gap-4 px-6 py-4
                bg-white/80 backdrop-blur-xl
                shadow-[0px_8px_24px_rgba(94,67,251,0.04)]">
      <button (click)="goBack()"
              class="w-10 h-10 flex items-center justify-center rounded-full
                     hover:bg-surface-container-low transition-colors active:scale-95 duration-200">
        <span class="material-symbols-outlined text-on-surface">arrow_back</span>
      </button>
      <h1 class="text-lg font-extrabold text-on-surface tracking-tight font-manrope">
        {{ project()?.title || 'Project Board' }}
      </h1>
    </div>

    <!-- Main content -->
    <div class="mt-stack-lg px-margin-page pb-32 transition-all"
         [ngClass]="{ 'md:pr-[460px]': selectedTaskId() }">

      <!-- Summary Stats -->
      <div class="grid grid-cols-2 gap-gutter mb-stack-lg">
        <div class="bg-surface-container-lowest p-stack-md rounded-xl
                    shadow-[0px_8px_24px_rgba(94,67,251,0.04)]">
          <p class="text-[11px] font-semibold tracking-widest uppercase text-outline mb-1">Completion</p>
          <p class="text-[24px] font-bold text-primary font-manrope">{{ project()?.progress ?? 0 }}%</p>
          <div class="w-full h-2 bg-surface-container rounded-full mt-2 overflow-hidden">
            <div class="h-full rounded-full bg-gradient-to-r from-primary to-secondary-container transition-all duration-500"
                 [style.width.%]="project()?.progress ?? 0"></div>
          </div>
        </div>
        <div class="bg-surface-container-lowest p-stack-md rounded-xl
                    shadow-[0px_8px_24px_rgba(94,67,251,0.04)]">
          <p class="text-[11px] font-semibold tracking-widest uppercase text-outline mb-1">Estimated Time</p>
          <p class="text-[24px] font-bold text-on-surface font-manrope">{{ totalTimeHours }}h</p>
          <p class="text-[10px] text-on-surface-variant mt-2">
            {{ remainingCount }} task{{ remainingCount === 1 ? '' : 's' }} remaining
          </p>
        </div>
      </div>

      <!-- Assignee filter -->
      <div class="flex items-center gap-2 mb-stack-md overflow-x-auto no-scrollbar">
        <button (click)="filterAssignee.set('all')"
                class="flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full border flex-shrink-0 transition-all"
                [class]="filterAssignee() === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant'">
          <span class="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center">
            <span class="material-symbols-outlined text-[15px]">groups</span>
          </span>
          <span class="text-[12px] font-bold">All</span>
        </button>

        <button *ngFor="let m of projectMembers()" (click)="filterAssignee.set(m.id)"
                class="flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full border flex-shrink-0 transition-all"
                [class]="filterAssignee() === m.id ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant'">
          <span class="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-white text-[9px] font-bold"
                [style.background]="m.color">
            <img *ngIf="m.avatarUrl; else filterInit" [src]="m.avatarUrl" [alt]="m.name" class="w-full h-full object-cover" />
            <ng-template #filterInit>{{ m.initials }}</ng-template>
          </span>
          <span class="text-[12px] font-bold">{{ m.name.split(' ')[0] }}</span>
        </button>

        <button (click)="filterAssignee.set('unassigned')"
                class="flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full border flex-shrink-0 transition-all"
                [class]="filterAssignee() === 'unassigned' ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant'">
          <span class="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
            <span class="material-symbols-outlined text-[15px]">person_off</span>
          </span>
          <span class="text-[12px] font-bold">Unassigned</span>
        </button>
      </div>

      <!-- Kanban Board -->
      <div class="-mx-margin-page px-margin-page flex overflow-x-auto gap-gutter pb-8 no-scrollbar"
           cdkDropListGroup>

        <!-- ── OPEN (To Do) ─────────────────────────────────────────── -->
        <div class="min-w-[280px] flex-shrink-0">
          <div class="flex items-center justify-between mb-stack-md">
            <h3 class="font-bold text-on-surface flex items-center gap-2 font-manrope">
              Open
              <span class="bg-surface-container px-2 py-0.5 rounded-full text-[12px] font-semibold text-on-surface-variant">
                {{ filteredKanban().todo.length }}
              </span>
            </h3>
          </div>
          <div cdkDropList id="todo-list"
               [cdkDropListData]="filteredKanban().todo"
               [cdkDropListConnectedTo]="['inprogress-list','done-list']"
               (cdkDropListDropped)="onDrop($event, 'todo')"
               class="space-y-gutter min-h-[60px]">
            <div *ngFor="let task of filteredKanban().todo" cdkDrag (click)="openTask(task)"
                 class="bg-surface-container-lowest p-4 rounded-xl cursor-grab
                        shadow-[0px_8px_24px_rgba(94,67,251,0.04)]
                        active:scale-95 transition-transform duration-200">
              <div class="flex justify-between items-start mb-3">
                <ng-container *ngTemplateOutlet="typeBadge; context: { task: task }"></ng-container>
                <span class="material-symbols-outlined text-outline text-[18px]">drag_indicator</span>
              </div>
              <h4 class="font-semibold text-on-surface mb-4 leading-tight font-manrope">{{ task.title }}</h4>
              <div class="flex items-center justify-between">
                <ng-container *ngTemplateOutlet="taskAvatar; context: { task: task }"></ng-container>
                <div class="flex items-center gap-1 text-outline text-[12px] font-medium">
                  <span class="material-symbols-outlined text-[14px]">schedule</span>{{ task.estimateHours }}h
                </div>
              </div>
            </div>
          </div>
          <button (click)="openAddTask('todo')"
                  class="mt-3 w-full py-2.5 rounded-xl text-[12px] font-semibold text-on-surface-variant
                         flex items-center justify-center gap-1 active:scale-95 transition-all hover:bg-surface-container-low"
                  style="border:1.5px dashed rgba(200,196,217,0.6);">
            <span class="material-symbols-outlined text-[16px]">add</span>Add task
          </button>
        </div>

        <!-- ── IN PROGRESS ──────────────────────────────────────────── -->
        <div class="min-w-[280px] flex-shrink-0">
          <div class="flex items-center justify-between mb-stack-md">
            <h3 class="font-bold text-on-surface flex items-center gap-2 font-manrope">
              In Progress
              <span class="px-2 py-0.5 rounded-full text-[12px] font-semibold text-white" style="background:#5e43fb;">
                {{ filteredKanban().inProgress.length }}
              </span>
            </h3>
          </div>
          <div cdkDropList id="inprogress-list"
               [cdkDropListData]="filteredKanban().inProgress"
               [cdkDropListConnectedTo]="['todo-list','done-list']"
               (cdkDropListDropped)="onDrop($event, 'in-progress')"
               class="space-y-gutter min-h-[60px]">
            <div *ngFor="let task of filteredKanban().inProgress" cdkDrag (click)="openTask(task)"
                 class="bg-surface-container-lowest p-4 rounded-xl cursor-grab
                        shadow-[0px_8px_24px_rgba(94,67,251,0.04)] border-l-4 border-primary
                        active:scale-95 transition-transform duration-200">
              <div class="flex justify-between items-start mb-3">
                <ng-container *ngTemplateOutlet="typeBadge; context: { task: task }"></ng-container>
                <span class="material-symbols-outlined text-outline text-[18px]">drag_indicator</span>
              </div>
              <h4 class="font-semibold text-on-surface mb-4 leading-tight font-manrope">{{ task.title }}</h4>
              <div class="flex items-center justify-between">
                <ng-container *ngTemplateOutlet="taskAvatar; context: { task: task }"></ng-container>
                <div class="flex items-center gap-1 text-[12px] font-bold text-primary">
                  <span class="material-symbols-outlined text-[14px]">pending</span>{{ task.estimateHours }}h
                </div>
              </div>
            </div>
          </div>
          <button (click)="openAddTask('in-progress')"
                  class="mt-3 w-full py-2.5 rounded-xl text-[12px] font-semibold text-on-surface-variant
                         flex items-center justify-center gap-1 active:scale-95 transition-all hover:bg-surface-container-low"
                  style="border:1.5px dashed rgba(200,196,217,0.6);">
            <span class="material-symbols-outlined text-[16px]">add</span>Add task
          </button>
        </div>

        <!-- ── CLOSED (Done) ────────────────────────────────────────── -->
        <div class="min-w-[280px] flex-shrink-0 pr-margin-page">
          <div class="flex items-center justify-between mb-stack-md">
            <h3 class="font-bold text-on-surface flex items-center gap-2 font-manrope">
              Closed
              <span class="bg-surface-container-high px-2 py-0.5 rounded-full text-[12px] font-semibold text-on-surface-variant">
                {{ filteredKanban().done.length }}
              </span>
            </h3>
          </div>
          <div cdkDropList id="done-list"
               [cdkDropListData]="filteredKanban().done"
               [cdkDropListConnectedTo]="['todo-list','inprogress-list']"
               (cdkDropListDropped)="onDrop($event, 'done')"
               class="space-y-gutter min-h-[60px]">
            <div *ngFor="let task of filteredKanban().done" cdkDrag (click)="openTask(task)"
                 class="bg-surface-container-lowest p-4 rounded-xl cursor-grab
                        shadow-[0px_8px_24px_rgba(94,67,251,0.04)]
                        active:scale-95 transition-transform duration-200">
              <div class="flex justify-between items-center mb-3">
                <ng-container *ngTemplateOutlet="typeBadge; context: { task: task }"></ng-container>
                <span class="text-[10px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1"
                      [style.background]="resolutionInfo(task.resolution).color + '22'"
                      [style.color]="resolutionInfo(task.resolution).color">
                  <span class="material-symbols-outlined text-[12px]">{{ resolutionInfo(task.resolution).icon }}</span>
                  {{ resolutionInfo(task.resolution).label }}
                </span>
              </div>
              <h4 class="font-semibold text-on-surface mb-4 leading-tight line-through font-manrope">{{ task.title }}</h4>
              <div class="flex items-center justify-between">
                <ng-container *ngTemplateOutlet="taskAvatar; context: { task: task }"></ng-container>
                <div class="flex items-center gap-1 text-outline text-[12px] font-medium">
                  <span class="material-symbols-outlined text-[14px]">schedule</span>{{ task.estimateHours }}h
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Reusable: type badge -->
    <ng-template #typeBadge let-task="task">
      <span class="text-[10px] px-2 py-0.5 rounded font-bold inline-flex items-center gap-1"
            [style.background]="typeInfo(task).bg" [style.color]="typeInfo(task).color">
        <span class="material-symbols-outlined text-[12px]">{{ typeInfo(task).icon }}</span>
        {{ typeInfo(task).short }}
      </span>
    </ng-template>

    <!-- Reusable: assignee avatar -->
    <ng-template #taskAvatar let-task="task">
      <ng-container *ngIf="memberOf(task) as m; else unassignedAvatar">
        <div class="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-white text-[9px] font-bold"
             [style.background]="m.color" [title]="m.name">
          <img *ngIf="m.avatarUrl; else memberInitial" [src]="m.avatarUrl" [alt]="m.name" class="w-full h-full object-cover" />
          <ng-template #memberInitial>{{ m.initials }}</ng-template>
        </div>
      </ng-container>
      <ng-template #unassignedAvatar>
        <div class="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant" title="Unassigned">
          <span class="material-symbols-outlined text-[14px]">person_off</span>
        </div>
      </ng-template>
    </ng-template>

    <!-- FAB -->
    <button (click)="openAddTask('todo')"
            class="fixed right-6 bottom-32 w-14 h-14 rounded-full text-white shadow-lg
                   bg-gradient-to-tr from-primary to-secondary-container
                   flex items-center justify-center active:scale-90 duration-300 ease-out z-[9999]">
      <span class="material-symbols-outlined text-[28px]">add</span>
    </button>

    <!-- ── Add Task Modal ───────────────────────────────────────────── -->
    <div *ngIf="showAddModal" class="fixed inset-0 z-[9999] flex items-end justify-center" (click)="showAddModal = false">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
      <div class="relative bg-white rounded-t-[28px] w-full max-h-[90vh] overflow-y-auto p-6 pb-10"
           style="box-shadow:0 -8px 40px rgba(0,0,0,0.12);" (click)="$event.stopPropagation()">
        <div class="w-12 h-1 rounded-full bg-outline-variant mx-auto mb-6"></div>
        <h3 class="font-bold text-[22px] text-on-surface mb-5 font-manrope">New Task</h3>

        <!-- Type -->
        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-2 block">Type</label>
          <div class="flex flex-wrap gap-2">
            <button *ngFor="let t of taskTypes" (click)="taskForm.type = t.id"
                    class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all border"
                    [style.background]="taskForm.type === t.id ? t.bg : 'transparent'"
                    [style.borderColor]="taskForm.type === t.id ? t.color : '#e0e3e6'"
                    [style.color]="taskForm.type === t.id ? t.color : '#43474a'">
              <span class="material-symbols-outlined text-[16px]">{{ t.icon }}</span>{{ t.label }}
            </button>
          </div>
        </div>

        <!-- Title -->
        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Task Title</label>
          <input type="text" [(ngModel)]="taskForm.title" placeholder="What needs to be done?"
                 class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[16px] font-medium
                        outline-none border border-transparent focus:border-primary/30 transition-all" />
        </div>

        <!-- Description -->
        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Description</label>
          <textarea [(ngModel)]="taskForm.description" rows="2" placeholder="Add more detail…"
                    class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[15px] font-medium
                           outline-none border border-transparent focus:border-primary/30 transition-all resize-none"></textarea>
        </div>

        <!-- Status -->
        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-2 block">Status</label>
          <div class="bg-surface-container p-1 rounded-2xl flex gap-1">
            <button *ngFor="let s of statuses" (click)="taskForm.status = s.id"
                    class="flex-1 py-2.5 rounded-xl font-semibold text-[13px] transition-all"
                    [class]="taskForm.status === s.id ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant'">
              {{ s.label }}
            </button>
          </div>
        </div>

        <!-- Priority -->
        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-2 block">Priority</label>
          <div class="bg-surface-container p-1 rounded-2xl flex gap-1">
            <button *ngFor="let p of priorities" (click)="taskForm.priority = p"
                    class="flex-1 py-2.5 rounded-xl capitalize font-semibold text-[13px] transition-all"
                    [class]="taskForm.priority === p ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant'">
              {{ p }}
            </button>
          </div>
        </div>

        <!-- Assignee -->
        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-2 block">Assignee</label>
          <div *ngIf="selectedMember() as m" class="flex items-center gap-2 mb-2">
            <span class="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-primary/10 border border-primary">
              <span class="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-white text-[10px] font-bold"
                    [style.background]="m.color">
                <img *ngIf="m.avatarUrl; else selInit" [src]="m.avatarUrl" [alt]="m.name" class="w-full h-full object-cover" />
                <ng-template #selInit>{{ m.initials }}</ng-template>
              </span>
              <span class="text-[13px] font-semibold text-on-surface">{{ m.name }}</span>
              <button (click)="clearAssignee()" class="material-symbols-outlined text-[16px] text-on-surface-variant hover:text-error">close</button>
            </span>
          </div>
          <div *ngIf="!selectedMember()" class="relative">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">search</span>
            <input type="text" [(ngModel)]="assigneeQuery" placeholder="Search a person to assign…"
                   class="w-full pl-10 pr-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[15px] font-medium
                          outline-none border border-transparent focus:border-primary/30 transition-all" />
            <div *ngIf="assigneeQuery.trim()" class="absolute z-20 mt-1 w-full bg-white rounded-2xl overflow-hidden max-h-52 overflow-y-auto"
                 style="box-shadow:0 8px 30px rgba(0,0,0,0.12);">
              <button *ngFor="let m of filteredMembers()" (click)="setAssignee(m.id)"
                      class="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-surface-container transition-colors text-left">
                <span class="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      [style.background]="m.color">
                  <img *ngIf="m.avatarUrl; else resInit" [src]="m.avatarUrl" [alt]="m.name" class="w-full h-full object-cover" />
                  <ng-template #resInit>{{ m.initials }}</ng-template>
                </span>
                <span class="text-[14px] font-semibold text-on-surface">{{ m.name }}</span>
              </button>
              <p *ngIf="!filteredMembers().length" class="px-3 py-3 text-[13px] text-on-surface-variant">No people found.</p>
            </div>
            <p class="text-[12px] text-on-surface-variant mt-2">Leave empty to keep it unassigned.</p>
          </div>
        </div>

        <!-- Dates + estimate -->
        <div class="flex gap-3 mb-4">
          <div class="flex-1">
            <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Start Date</label>
            <input type="date" [(ngModel)]="taskForm.startDate"
                   class="w-full px-3 py-3 rounded-2xl bg-surface-container text-on-surface text-[14px] font-medium
                          outline-none border border-transparent focus:border-primary/30 transition-all" />
          </div>
          <div class="flex-1">
            <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">End Date</label>
            <input type="date" [(ngModel)]="taskForm.dueDate" [min]="taskForm.startDate"
                   class="w-full px-3 py-3 rounded-2xl bg-surface-container text-on-surface text-[14px] font-medium
                          outline-none border border-transparent focus:border-primary/30 transition-all" />
          </div>
        </div>
        <div class="mb-6">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Estimate (hours)</label>
          <input type="number" min="0" step="0.5" [(ngModel)]="taskForm.estimateHours"
                 class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[16px] font-medium
                        outline-none border border-transparent focus:border-primary/30 transition-all" />
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
          <button (click)="showAddModal = false"
                  class="flex-1 py-3.5 rounded-2xl bg-surface-container text-on-surface-variant text-[14px] font-bold active:scale-95 transition-all">
            Cancel
          </button>
          <button (click)="saveTask()" [disabled]="!taskForm.title.trim()"
                  class="flex-1 py-3.5 rounded-2xl text-white text-[14px] font-bold
                         bg-gradient-to-tr from-primary to-secondary-container active:scale-95 transition-all disabled:opacity-40">
            Create Task
          </button>
        </div>
      </div>
    </div>

    <!-- ── Resolution Modal (closing a task) ────────────────────────── -->
    <div *ngIf="showResolutionModal" class="fixed inset-0 z-[9999] flex items-end justify-center" (click)="cancelResolution()">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
      <div class="relative bg-white rounded-t-[28px] w-full p-6 pb-10" style="box-shadow:0 -8px 40px rgba(0,0,0,0.12);"
           (click)="$event.stopPropagation()">
        <div class="w-12 h-1 rounded-full bg-outline-variant mx-auto mb-6"></div>
        <h3 class="font-bold text-[22px] text-on-surface mb-1 font-manrope">Close task</h3>
        <p class="text-[14px] text-on-surface-variant mb-5">How was this resolved?</p>
        <div class="flex flex-col gap-2 mb-2">
          <button *ngFor="let r of resolutions" (click)="confirmResolution(r.id)"
                  class="flex items-center gap-3 p-3 rounded-2xl border border-outline-variant
                         hover:border-primary/40 hover:bg-surface-container-low transition-all text-left active:scale-[0.98]">
            <span class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  [style.background]="r.color + '22'">
              <span class="material-symbols-outlined text-[20px]" [style.color]="r.color">{{ r.icon }}</span>
            </span>
            <span class="flex-1">
              <span class="block text-[15px] font-bold text-on-surface">{{ r.label }}</span>
              <span class="block text-[12px] text-on-surface-variant">{{ r.desc }}</span>
            </span>
            <span class="material-symbols-outlined text-outline">chevron_right</span>
          </button>
        </div>
        <button (click)="cancelResolution()"
                class="w-full mt-3 py-3.5 rounded-2xl bg-surface-container text-on-surface-variant text-[14px] font-bold active:scale-95 transition-all">
          Cancel
        </button>
      </div>
    </div>

    <!-- Task detail -->
    <app-task-detail *ngIf="selectedTaskId() as id" [taskId]="id" (close)="selectedTaskId.set(null)"></app-task-detail>
  `,
})
export class ProjectKanbanComponent implements OnInit {
  private route          = inject(ActivatedRoute);
  private router         = inject(Router);
  private projectService = inject(ProjectService);

  private _projectId = signal('');

  project = computed(() => this.projectService.getProjectById(this._projectId()));
  kanban  = computed(() => this.projectService.getKanbanByProject(this._projectId()));

  teamMembers = this.projectService.teamMembers;

  // Assignee filter: 'all' | 'unassigned' | memberId
  filterAssignee = signal<string>('all');

  /** Members that actually have tasks in this project (for the filter bar). */
  projectMembers = computed<TeamMember[]>(() => {
    const k = this.kanban();
    const ids = new Set<string>();
    [...k.todo, ...k.inProgress, ...k.done].forEach(t => { if (t.assigneeId) ids.add(t.assigneeId); });
    return this.teamMembers.filter(m => ids.has(m.id));
  });

  filteredKanban = computed(() => {
    const k = this.kanban();
    const f = this.filterAssignee();
    if (f === 'all') return k;
    const match = (t: Task) => (f === 'unassigned' ? !t.assigneeId : t.assigneeId === f);
    return { todo: k.todo.filter(match), inProgress: k.inProgress.filter(match), done: k.done.filter(match) };
  });

  selectedTaskId = signal<string | null>(null);

  readonly taskTypes   = TASK_TYPES;
  readonly resolutions = RESOLUTIONS;
  readonly statuses    = STATUSES;
  readonly priorities: Task['priority'][] = ['low', 'medium', 'high'];

  showAddModal = false;
  taskForm = this.emptyTaskForm();
  assigneeQuery = '';

  showResolutionModal = false;
  private pendingCloseTaskId: string | null = null;

  get totalTimeHours(): number {
    const k = this.kanban();
    return [...k.todo, ...k.inProgress, ...k.done].reduce((sum, t) => sum + (t.estimateHours || 0), 0);
  }

  get remainingCount(): number {
    const k = this.kanban();
    return k.todo.length + k.inProgress.length;
  }

  ngOnInit(): void {
    this._projectId.set(this.route.snapshot.paramMap.get('id') || '');
    this.projectService.load();
  }

  openTask(task: Task): void {
    this.selectedTaskId.set(task.id);
  }

  // ── Add task ───────────────────────────────────────────────────────
  openAddTask(column: Task['status']): void {
    this.taskForm = this.emptyTaskForm();
    this.taskForm.status = column;
    this.assigneeQuery = '';
    this.showAddModal = true;
  }

  saveTask(): void {
    if (!this.taskForm.title.trim()) return;
    const status = this.taskForm.status;
    this.projectService.addTask({
      id:            'new-' + Date.now(),
      projectId:     this._projectId(),
      title:         this.taskForm.title.trim(),
      description:   this.taskForm.description.trim(),
      type:          this.taskForm.type,
      status,
      priority:      this.taskForm.priority,
      startDate:     this.taskForm.startDate,
      dueDate:       this.taskForm.dueDate,
      estimateHours: Number(this.taskForm.estimateHours) || 0,
      assigneeId:    this.taskForm.assigneeId || undefined,
      resolution:    status === 'done' ? 'done' : undefined,
    });
    this.showAddModal = false;
  }

  // ── Assignee search ────────────────────────────────────────────────
  filteredMembers(): TeamMember[] {
    const q = this.assigneeQuery.trim().toLowerCase();
    if (!q) return [];
    return this.teamMembers.filter(
      m => m.id !== this.taskForm.assigneeId &&
           (m.name.toLowerCase().includes(q) || m.initials.toLowerCase().includes(q)),
    );
  }

  selectedMember(): TeamMember | undefined {
    return this.teamMembers.find(m => m.id === this.taskForm.assigneeId);
  }

  setAssignee(id: string): void {
    this.taskForm.assigneeId = id;
    this.assigneeQuery = '';
  }

  clearAssignee(): void {
    this.taskForm.assigneeId = '';
  }

  // ── Drag & drop ────────────────────────────────────────────────────
  onDrop(event: CdkDragDrop<Task[]>, targetStatus: Task['status']): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }

    const moved = event.previousContainer.data[event.previousIndex];

    // Closing a task (moving into Done) asks for a resolution first.
    if (targetStatus === 'done') {
      this.pendingCloseTaskId = moved.id;
      this.showResolutionModal = true;
      return; // don't transfer yet — commit happens on confirm
    }

    transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    this.projectService.updateTaskStatus(moved.id, targetStatus);
  }

  confirmResolution(resolution: TaskResolution): void {
    if (this.pendingCloseTaskId) {
      this.projectService.updateTaskStatus(this.pendingCloseTaskId, 'done', resolution);
    }
    this.showResolutionModal = false;
    this.pendingCloseTaskId = null;
  }

  cancelResolution(): void {
    this.showResolutionModal = false;
    this.pendingCloseTaskId = null;
    this.projectService.touchTasks(); // rebuild board so the card returns to its column
  }

  // ── Display helpers ────────────────────────────────────────────────
  typeInfo(task: Task): TaskTypeDef {
    return TASK_TYPES.find(t => t.id === task.type) ?? TASK_TYPES[0];
  }

  resolutionInfo(resolution: Task['resolution']): ResolutionDef {
    return RESOLUTIONS.find(r => r.id === resolution) ?? RESOLUTIONS[0];
  }

  memberOf(task: Task): TeamMember | undefined {
    return this.teamMembers.find(m => m.id === task.assigneeId);
  }

  goBack(): void { this.router.navigate(['/projects']); }

  private emptyTaskForm() {
    return {
      type: 'development' as Task['type'],
      title: '',
      description: '',
      status: 'todo' as Task['status'],
      priority: 'medium' as Task['priority'],
      assigneeId: '' as string,
      startDate: '',
      dueDate: '',
      estimateHours: 4,
    };
  }
}
