import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IssueStatus } from '../../../core/models/project.model';
import { statusInfo } from '../../../features/projects/task-meta';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
          [style.background]="info.bg" [style.color]="info.color">
      <span class="material-symbols-outlined text-[13px]">{{ info.icon }}</span>{{ info.label }}
    </span>
  `,
})
export class StatusBadgeComponent {
  @Input({ required: true }) set status(value: IssueStatus) { this.info = statusInfo(value); }
  info = statusInfo('backlog');
}
