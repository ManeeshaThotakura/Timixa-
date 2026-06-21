import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IssueType } from '../../../core/models/project.model';
import { issueTypeInfo } from '../../../features/projects/task-meta';

@Component({
  selector: 'app-issue-type-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="inline-flex items-center justify-center rounded"
          [style.background]="info.bg" [style.width.px]="size" [style.height.px]="size" [title]="info.label">
      <span class="material-symbols-outlined" [style.color]="info.color" [style.fontSize.px]="size - 8">{{ info.icon }}</span>
    </span>
  `,
})
export class IssueTypeIconComponent {
  @Input({ required: true }) set type(value: IssueType) { this.info = issueTypeInfo(value); }
  @Input() size = 24;
  info = issueTypeInfo('story');
}
