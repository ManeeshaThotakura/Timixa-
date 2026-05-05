import { Component, OnInit, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ProjectService } from '../../../core/services/project.service';
import { AuthService } from '../../../core/services/auth.service';
import { Task } from '../../../core/models/project.model';

const AVATAR_COLORS = ['#451de3', '#006688', '#4b4f52', '#00c1fd'];

@Component({
  selector: 'app-project-kanban',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
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
    <div class="mt-stack-lg px-margin-page pb-32">

      <!-- Summary Stats -->
      <div class="grid grid-cols-2 gap-gutter mb-stack-lg">

        <div class="bg-surface-container-lowest p-stack-md rounded-xl
                    shadow-[0px_8px_24px_rgba(94,67,251,0.04)]">
          <p class="text-[11px] font-semibold tracking-widest uppercase text-outline mb-1">
            Completion
          </p>
          <p class="text-[24px] font-bold text-primary font-manrope">
            {{ project()?.progress ?? 0 }}%
          </p>
          <div class="w-full h-2 bg-surface-container rounded-full mt-2 overflow-hidden">
            <div class="h-full rounded-full bg-gradient-to-r from-primary to-secondary-container
                        transition-all duration-500"
                 [style.width.%]="project()?.progress ?? 0">
            </div>
          </div>
        </div>

        <div class="bg-surface-container-lowest p-stack-md rounded-xl
                    shadow-[0px_8px_24px_rgba(94,67,251,0.04)]">
          <p class="text-[11px] font-semibold tracking-widest uppercase text-outline mb-1">
            Total Time
          </p>
          <p class="text-[24px] font-bold text-on-surface font-manrope">
            {{ totalTimeHours }}h
          </p>
          <p class="text-[10px] text-on-surface-variant mt-2">
            {{ remainingCount }} task{{ remainingCount === 1 ? '' : 's' }} remaining
          </p>
        </div>

      </div>

      <!-- Kanban Board — breaks out of padding so horizontal scroll reaches edges -->
      <div class="-mx-margin-page px-margin-page flex overflow-x-auto gap-gutter pb-8 no-scrollbar"
           cdkDropListGroup>

        <!-- ── TO DO ──────────────────────────────────────────────── -->
        <div class="min-w-[280px] flex-shrink-0">

          <div class="flex items-center justify-between mb-stack-md">
            <h3 class="font-bold text-on-surface flex items-center gap-2 font-manrope">
              To Do
              <span class="bg-surface-container px-2 py-0.5 rounded-full text-[12px]
                           font-semibold text-on-surface-variant">
                {{ kanban().todo.length }}
              </span>
            </h3>
            <span class="material-symbols-outlined text-outline cursor-pointer">more_horiz</span>
          </div>

          <div cdkDropList
               id="todo-list"
               [cdkDropListData]="kanban().todo"
               [cdkDropListConnectedTo]="['inprogress-list','done-list']"
               (cdkDropListDropped)="onDrop($event, 'todo')"
               class="space-y-gutter min-h-[60px]">

            <div *ngFor="let task of kanban().todo"
                 cdkDrag
                 class="bg-surface-container-lowest p-4 rounded-xl cursor-grab
                        shadow-[0px_8px_24px_rgba(94,67,251,0.04)]
                        active:scale-95 transition-transform duration-200">
              <div class="flex justify-between items-start mb-3">
                <span class="text-[10px] px-2 py-0.5 rounded font-bold"
                      [style.background]="categoryBg(task)"
                      [style.color]="categoryColor(task)">
                  {{ categoryLabel(task) }}
                </span>
                <span class="material-symbols-outlined text-outline text-[18px]">drag_indicator</span>
              </div>
              <h4 class="font-semibold text-on-surface mb-4 leading-tight font-manrope">
                {{ task.title }}
              </h4>
              <div class="flex items-center justify-between">
                <div class="flex -space-x-2">
                  <div *ngFor="let c of taskAvatars(task)"
                       class="w-6 h-6 rounded-full border-2 border-white flex items-center
                              justify-center text-white text-[9px] font-bold"
                       [style.background]="c">
                    {{ avatarInitial(task) }}
                  </div>
                </div>
                <div class="flex items-center gap-1 text-outline text-[12px] font-medium">
                  <span class="material-symbols-outlined text-[14px]">schedule</span>
                  {{ timeEstimate(task) }}
                </div>
              </div>
            </div>

          </div>

          <button (click)="openAddTask('todo')"
                  class="mt-3 w-full py-2.5 rounded-xl text-[12px] font-semibold
                         text-on-surface-variant flex items-center justify-center gap-1
                         active:scale-95 transition-all hover:bg-surface-container-low"
                  style="border:1.5px dashed rgba(200,196,217,0.6);">
            <span class="material-symbols-outlined text-[16px]">add</span>Add task
          </button>
        </div>

        <!-- ── IN PROGRESS ────────────────────────────────────────── -->
        <div class="min-w-[280px] flex-shrink-0">

          <div class="flex items-center justify-between mb-stack-md">
            <h3 class="font-bold text-on-surface flex items-center gap-2 font-manrope">
              In Progress
              <span class="px-2 py-0.5 rounded-full text-[12px] font-semibold text-white"
                    style="background:#5e43fb;">
                {{ kanban().inProgress.length }}
              </span>
            </h3>
            <span class="material-symbols-outlined text-outline cursor-pointer">more_horiz</span>
          </div>

          <div cdkDropList
               id="inprogress-list"
               [cdkDropListData]="kanban().inProgress"
               [cdkDropListConnectedTo]="['todo-list','done-list']"
               (cdkDropListDropped)="onDrop($event, 'in-progress')"
               class="space-y-gutter min-h-[60px]">

            <div *ngFor="let task of kanban().inProgress"
                 cdkDrag
                 class="bg-surface-container-lowest p-4 rounded-xl cursor-grab
                        shadow-[0px_8px_24px_rgba(94,67,251,0.04)] border-l-4 border-primary
                        active:scale-95 transition-transform duration-200">
              <div class="flex justify-between items-start mb-3">
                <span class="text-[10px] px-2 py-0.5 rounded font-bold"
                      [style.background]="categoryBg(task)"
                      [style.color]="categoryColor(task)">
                  {{ categoryLabel(task) }}
                </span>
              </div>
              <h4 class="font-semibold text-on-surface mb-4 leading-tight font-manrope">
                {{ task.title }}
              </h4>
              <div class="flex items-center justify-between">
                <div class="flex -space-x-2">
                  <div *ngFor="let c of taskAvatars(task)"
                       class="w-6 h-6 rounded-full border-2 border-white flex items-center
                              justify-center text-white text-[9px] font-bold"
                       [style.background]="c">
                    {{ avatarInitial(task) }}
                  </div>
                </div>
                <div class="flex items-center gap-1 text-[12px] font-bold text-primary">
                  <span class="material-symbols-outlined text-[14px]">pending</span>
                  {{ timeEstimate(task) }}
                </div>
              </div>
            </div>

          </div>

          <button (click)="openAddTask('in-progress')"
                  class="mt-3 w-full py-2.5 rounded-xl text-[12px] font-semibold
                         text-on-surface-variant flex items-center justify-center gap-1
                         active:scale-95 transition-all hover:bg-surface-container-low"
                  style="border:1.5px dashed rgba(200,196,217,0.6);">
            <span class="material-symbols-outlined text-[16px]">add</span>Add task
          </button>
        </div>

        <!-- ── DONE ───────────────────────────────────────────────── -->
        <div class="min-w-[280px] flex-shrink-0 pr-margin-page">

          <div class="flex items-center justify-between mb-stack-md">
            <h3 class="font-bold text-on-surface flex items-center gap-2 font-manrope">
              Done
              <span class="bg-surface-container-high px-2 py-0.5 rounded-full text-[12px]
                           font-semibold text-on-surface-variant">
                {{ kanban().done.length }}
              </span>
            </h3>
            <span class="material-symbols-outlined text-outline cursor-pointer">more_horiz</span>
          </div>

          <div cdkDropList
               id="done-list"
               [cdkDropListData]="kanban().done"
               [cdkDropListConnectedTo]="['todo-list','inprogress-list']"
               (cdkDropListDropped)="onDrop($event, 'done')"
               class="space-y-gutter min-h-[60px] opacity-60">

            <div *ngFor="let task of kanban().done"
                 cdkDrag
                 class="bg-surface-container-lowest p-4 rounded-xl cursor-grab
                        shadow-[0px_8px_24px_rgba(94,67,251,0.04)]
                        active:scale-95 transition-transform duration-200">
              <div class="flex justify-between items-start mb-3">
                <span class="text-[10px] px-2 py-0.5 rounded font-bold"
                      style="background:#e2e2e5; color:#474556;">
                  SETUP
                </span>
                <span class="material-symbols-outlined text-[18px] text-primary"
                      style="font-variation-settings:'FILL' 1;">check_circle</span>
              </div>
              <h4 class="font-semibold text-on-surface mb-4 leading-tight line-through font-manrope">
                {{ task.title }}
              </h4>
              <div class="flex items-center justify-between">
                <div class="flex -space-x-2">
                  <div *ngFor="let c of taskAvatars(task)"
                       class="w-6 h-6 rounded-full border-2 border-white flex items-center
                              justify-center text-white text-[9px] font-bold"
                       [style.background]="c">
                    {{ avatarInitial(task) }}
                  </div>
                </div>
                <div class="flex items-center gap-1 text-outline text-[12px] font-medium">
                  <span class="material-symbols-outlined text-[14px]">schedule</span>
                  {{ timeEstimate(task) }}
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>

    <!-- FAB -->
    <button (click)="openAddTask('todo')"
            class="fixed right-6 bottom-32 w-14 h-14 rounded-full text-white shadow-lg
                   bg-gradient-to-tr from-primary to-secondary-container
                   flex items-center justify-center active:scale-90 duration-300 ease-out z-[9999]">
      <span class="material-symbols-outlined text-[28px]">add</span>
    </button>

    <!-- Add Task Modal -->
    <div *ngIf="showAddModal"
         class="fixed inset-0 z-[9999] flex items-end justify-center"
         (click)="showAddModal = false">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
      <div class="relative bg-white rounded-t-[28px] w-full p-6 pb-10"
           style="box-shadow:0 -8px 40px rgba(0,0,0,0.12);"
           (click)="$event.stopPropagation()">
        <div class="w-12 h-1 rounded-full bg-outline-variant mx-auto mb-6"></div>
        <h3 class="font-bold text-[22px] text-on-surface mb-5 font-manrope">
          Add Task
          <span class="text-[14px] font-semibold text-on-surface-variant ml-2">→ {{ colLabel }}</span>
        </h3>
        <div class="mb-5">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">
            Task Title
          </label>
          <input type="text"
                 [(ngModel)]="newTaskTitle"
                 placeholder="What needs to be done?"
                 class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface
                        text-[16px] font-medium outline-none border border-transparent
                        focus:border-primary/30 transition-all"
                 (keyup.enter)="saveTask()" />
        </div>
        <div class="flex gap-3">
          <button (click)="showAddModal = false"
                  class="flex-1 py-3.5 rounded-2xl bg-surface-container text-on-surface-variant
                         text-[14px] font-bold active:scale-95 transition-all">
            Cancel
          </button>
          <button (click)="saveTask()"
                  [disabled]="!newTaskTitle.trim()"
                  class="flex-1 py-3.5 rounded-2xl text-white text-[14px] font-bold
                         bg-gradient-to-tr from-primary to-secondary-container
                         active:scale-95 transition-all disabled:opacity-40">
            Add Task
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ProjectKanbanComponent implements OnInit {
  private route          = inject(ActivatedRoute);
  private router         = inject(Router);
  private projectService = inject(ProjectService);
  private authService    = inject(AuthService);

  private _projectId = signal('');

  project = computed(() => this.projectService.getProjectById(this._projectId()));
  kanban  = computed(() => this.projectService.getKanbanByProject(this._projectId()));

  showAddModal   = false;
  addingToColumn: Task['status'] = 'todo';
  newTaskTitle   = '';

  get userInitial(): string {
    const name = this.authService.currentUser()?.name ?? 'U';
    return name.charAt(0).toUpperCase();
  }

  get totalTimeHours(): number {
    const k = this.kanban();
    return k.done.length * 6 + k.inProgress.length * 8 + k.todo.length * 5;
  }

  get remainingCount(): number {
    const k = this.kanban();
    return k.todo.length + k.inProgress.length;
  }

  get colLabel(): string {
    if (this.addingToColumn === 'todo')        return 'To Do';
    if (this.addingToColumn === 'in-progress') return 'In Progress';
    return 'Done';
  }

  ngOnInit(): void {
    this._projectId.set(this.route.snapshot.paramMap.get('id') || '');
    this.projectService.load();
  }

  openAddTask(column: Task['status']): void {
    this.addingToColumn = column;
    this.newTaskTitle   = '';
    this.showAddModal   = true;
  }

  saveTask(): void {
    if (!this.newTaskTitle.trim()) return;
    this.projectService.addTask({
      id:        'new-' + Date.now(),
      projectId: this._projectId(),
      title:     this.newTaskTitle.trim(),
      status:    this.addingToColumn,
      dueDate:   new Date().toISOString().split('T')[0],
      assignees: [],
      priority:  'medium',
    });
    this.newTaskTitle = '';
    this.showAddModal = false;
  }

  onDrop(event: CdkDragDrop<Task[]>, targetStatus: Task['status']): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
      const moved = event.container.data[event.currentIndex];
      this.projectService.updateTaskStatus(moved.id, targetStatus);
    }
  }

  goBack(): void { this.router.navigate(['/projects']); }

  categoryLabel(task: Task): string {
    if (task.status === 'done') return 'SETUP';
    const t = task.title.toLowerCase();
    if (t.includes('interview') || t.includes('research'))                           return 'RESEARCH';
    if (t.includes('design') || t.includes('prototype') || t.includes('wireframe')) return 'DESIGN';
    if (t.includes('copy') || t.includes('content') || t.includes('write'))         return 'CONTENT';
    if (task.priority === 'high') return 'RESEARCH';
    return 'DESIGN';
  }

  categoryBg(task: Task): string {
    const l = this.categoryLabel(task);
    if (l === 'RESEARCH') return '#e4dfff';
    if (l === 'DESIGN')   return '#c2e8ff';
    if (l === 'CONTENT')  return '#e4dfff';
    return '#e2e2e5';
  }

  categoryColor(task: Task): string {
    const l = this.categoryLabel(task);
    if (l === 'RESEARCH') return '#3c03dd';
    if (l === 'DESIGN')   return '#004d67';
    if (l === 'CONTENT')  return '#3c03dd';
    return '#474556';
  }

  timeEstimate(task: Task): string {
    if (task.priority === 'high')   return '5h';
    if (task.priority === 'medium') return '3h';
    return '1h';
  }

  taskAvatars(task: Task): string[] {
    const seed = task.id.charCodeAt(task.id.length - 1);
    return [AVATAR_COLORS[seed % AVATAR_COLORS.length]];
  }

  avatarInitial(task: Task): string {
    return task.assignees?.[0]?.charAt(0).toUpperCase() || 'U';
  }
}
