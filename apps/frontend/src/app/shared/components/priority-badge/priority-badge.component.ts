import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IssuePriority } from '../../../core/models/project.model';
import { priorityInfo } from '../../../features/projects/task-meta';

@Component({
  selector: 'app-priority-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold"
          [style.background]="info.bg" [style.color]="info.color" [title]="info.label">
      <span class="material-symbols-outlined text-[14px]">{{ info.icon }}</span>
      <span *ngIf="showLabel">{{ info.label }}</span>
    </span>
  `,
})
export class PriorityBadgeComponent {
  @Input({ required: true }) set priority(value: IssuePriority) { this.info = priorityInfo(value); }
  @Input() showLabel = true;
  info = priorityInfo('medium');
}
