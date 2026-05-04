import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task } from '../../../core/models/project.model';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-start gap-2 mb-3">
      <span class="material-symbols-outlined text-[16px] text-outline-variant cursor-grab mt-0.5 flex-shrink-0">
        drag_indicator
      </span>
      <div class="flex-1 min-w-0">
        <h4 class="font-manrope font-semibold text-sm text-on-surface leading-tight"
            [class.line-through]="done"
            [class.text-on-surface-variant]="done">
          {{ task.title }}
        </h4>
      </div>
      <span *ngIf="done"
            class="material-symbols-outlined text-[16px] text-green-500 filled flex-shrink-0">
        check_circle
      </span>
    </div>

    <div class="flex items-center justify-between">
      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
            [class]="priorityClass">
        {{ task.priority }}
      </span>
      <div class="flex items-center gap-1 text-on-surface-variant text-[11px]">
        <span class="material-symbols-outlined text-[12px]">schedule</span>
        <span>{{ task.dueDate | date:'MMM d' }}</span>
      </div>
    </div>
  `,
})
export class TaskCardComponent {
  @Input() task!: Task;
  @Input() done = false;

  get priorityClass(): string {
    return {
      high: 'bg-red-50 text-red-500',
      medium: 'bg-amber-50 text-amber-600',
      low: 'bg-green-50 text-green-600',
    }[this.task.priority] || '';
  }
}
