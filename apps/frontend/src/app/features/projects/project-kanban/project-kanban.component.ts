import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ProjectService } from '../../../core/services/project.service';
import { AuthService } from '../../../core/services/auth.service';
import { Task } from '../../../core/models/project.model';
import { TaskCardComponent } from '../../../shared/components/task-card/task-card.component';

@Component({
  selector: 'app-project-kanban',
  standalone: true,
  imports: [CommonModule, FormsModule, TaskCardComponent, DragDropModule],
  template: `
    <div class="px-margin-page pt-stack-md pb-4">

      <!-- Back + Header -->
      <div class="flex items-center gap-3 mb-stack-lg">
        <button (click)="goBack()"
                class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center
                       active:scale-90 transition-transform">
          <span class="material-symbols-outlined text-on-surface">arrow_back</span>
        </button>
        <div class="flex-1">
          <h1 class="font-manrope font-bold text-h2 text-on-surface leading-tight">
            {{ project?.title || 'Project Board' }}
          </h1>
          <p class="text-on-surface-variant text-xs mt-0.5">{{ project?.description }}</p>
        </div>

        <!-- Admin: Schedule Meeting -->
        <button *ngIf="isAdmin()"
                (click)="goToMeeting()"
                class="flex items-center gap-1.5 px-4 py-2 bg-secondary-fixed/30 text-secondary
                       rounded-xl font-semibold text-sm active:scale-95 transition-transform">
          <span class="material-symbols-outlined text-[18px]">video_call</span>
          <span>Schedule Meeting</span>
        </button>
      </div>

      <!-- Progress Bar -->
      <div *ngIf="project" class="mb-stack-lg">
        <div class="flex justify-between font-label-sm text-label-sm text-on-surface-variant mb-2">
          <span>Overall Progress</span>
          <span class="text-primary font-bold">{{ project.progress }}%</span>
        </div>
        <div class="w-full bg-surface-container h-2 rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all duration-500"
               style="background: linear-gradient(90deg, #451de3, #00c1fd)"
               [style.width.%]="project.progress"></div>
        </div>
      </div>

      <!-- Kanban Columns -->
      <div class="flex gap-4 overflow-x-auto pb-4 no-scrollbar" cdkDropListGroup>

        <!-- Todo -->
        <div class="flex-shrink-0 w-72">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-outline"></div>
              <h3 class="font-manrope font-bold text-sm text-on-surface">Todo</h3>
              <span class="w-5 h-5 rounded-full bg-surface-container text-xs flex items-center justify-center text-on-surface-variant font-semibold">
                {{ kanban.todo.length }}
              </span>
            </div>
            <button (click)="openAddTask('todo')"
                    class="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center
                           hover:bg-surface-container-high transition-colors">
              <span class="material-symbols-outlined text-[16px] text-on-surface-variant">add</span>
            </button>
          </div>

          <div cdkDropList
               id="todo-list"
               [cdkDropListData]="kanban.todo"
               [cdkDropListConnectedTo]="['inprogress-list','done-list']"
               (cdkDropListDropped)="onDrop($event, 'todo')"
               class="flex flex-col gap-3 min-h-[80px]">
            <div *ngFor="let task of kanban.todo"
                 cdkDrag
                 class="bg-surface-container-lowest rounded-[16px] p-4 shadow-card
                        hover:shadow-card-hover transition-all cursor-grab active:cursor-grabbing">
              <app-task-card [task]="task" [done]="false" />
            </div>
          </div>
        </div>

        <!-- In Progress -->
        <div class="flex-shrink-0 w-72">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-primary-container"></div>
              <h3 class="font-manrope font-bold text-sm text-on-surface">In Progress</h3>
              <span class="w-5 h-5 rounded-full bg-primary/10 text-xs flex items-center justify-center text-primary font-semibold">
                {{ kanban.inProgress.length }}
              </span>
            </div>
          </div>

          <div cdkDropList
               id="inprogress-list"
               [cdkDropListData]="kanban.inProgress"
               [cdkDropListConnectedTo]="['todo-list','done-list']"
               (cdkDropListDropped)="onDrop($event, 'in-progress')"
               class="flex flex-col gap-3 min-h-[80px]">
            <div *ngFor="let task of kanban.inProgress"
                 cdkDrag
                 class="bg-surface-container-lowest rounded-[16px] p-4 shadow-card
                        border-l-4 border-primary hover:shadow-card-hover transition-all cursor-grab active:cursor-grabbing">
              <app-task-card [task]="task" [done]="false" />
            </div>
          </div>
        </div>

        <!-- Done -->
        <div class="flex-shrink-0 w-72">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-green-500"></div>
              <h3 class="font-manrope font-bold text-sm text-on-surface">Done</h3>
              <span class="w-5 h-5 rounded-full bg-green-50 text-xs flex items-center justify-center text-green-600 font-semibold">
                {{ kanban.done.length }}
              </span>
            </div>
          </div>

          <div cdkDropList
               id="done-list"
               [cdkDropListData]="kanban.done"
               [cdkDropListConnectedTo]="['todo-list','inprogress-list']"
               (cdkDropListDropped)="onDrop($event, 'done')"
               class="flex flex-col gap-3 min-h-[80px]">
            <div *ngFor="let task of kanban.done"
                 cdkDrag
                 class="bg-surface-container-lowest rounded-[16px] p-4 shadow-card opacity-75 cursor-grab active:cursor-grabbing">
              <app-task-card [task]="task" [done]="true" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Task Modal -->
    <div *ngIf="showAddModal"
         class="fixed inset-0 z-50 flex items-end justify-center"
         (click)="showAddModal = false">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
      <div class="relative bg-surface-container-lowest rounded-t-[28px] w-full p-6 pb-10"
           (click)="$event.stopPropagation()">
        <div class="w-12 h-1 rounded-full bg-outline-variant mx-auto mb-6"></div>
        <h3 class="font-manrope font-bold text-h2 text-on-surface mb-5">Add Task to {{ addingToColumn }}</h3>
        <input type="text" [(ngModel)]="newTaskTitle" placeholder="Task title" class="input-ghost mb-4" />
        <div class="flex gap-3">
          <button (click)="showAddModal = false" class="btn-ghost flex-1">Cancel</button>
          <button (click)="saveTask()" class="btn-primary flex-1">Add Task</button>
        </div>
      </div>
    </div>
  `,
})
export class ProjectKanbanComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private authService = inject(AuthService);

  projectId = '';
  kanban = { todo: [] as Task[], inProgress: [] as Task[], done: [] as Task[] };
  showAddModal = false;
  addingToColumn: Task['status'] = 'todo';
  newTaskTitle = '';

  get project() {
    return this.projectService.getProjectById(this.projectId);
  }

  isAdmin = this.authService.currentUser;

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id') || '';
    this.projectService.load();
    this.loadKanban();
  }

  loadKanban(): void {
    this.kanban = this.projectService.getKanbanByProject(this.projectId);
  }

  moveTask(task: Task, newStatus: Task['status']): void {
    this.projectService.updateTaskStatus(task.id, newStatus);
    this.loadKanban();
  }

  openAddTask(column: Task['status']): void {
    this.addingToColumn = column;
    this.showAddModal = true;
  }

  saveTask(): void {
    if (!this.newTaskTitle.trim()) return;
    const task: Task = {
      id: 'new-' + Date.now(),
      projectId: this.projectId,
      title: this.newTaskTitle,
      status: this.addingToColumn,
      dueDate: new Date().toISOString().split('T')[0],
      assignees: [],
      priority: 'medium',
    };
    this.projectService.addTask(task);
    this.loadKanban();
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
      const movedTask = event.container.data[event.currentIndex];
      this.projectService.updateTaskStatus(movedTask.id, targetStatus);
    }
  }

  goBack(): void {
    this.router.navigate(['/projects']);
  }

  goToMeeting(): void {
    this.router.navigate(['/projects', this.projectId, 'meeting']);
  }

}
