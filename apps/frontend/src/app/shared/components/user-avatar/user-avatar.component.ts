import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TeamMember } from '../../../core/models/project.model';

@Component({
  selector: 'app-user-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span *ngIf="member; else none"
          class="inline-flex items-center justify-center rounded-full overflow-hidden text-white font-bold flex-shrink-0"
          [style.background]="member.color" [style.width.px]="size" [style.height.px]="size"
          [style.fontSize.px]="size * 0.4" [title]="member.name">
      <img *ngIf="member.avatarUrl; else initials" [src]="member.avatarUrl" [alt]="member.name" class="w-full h-full object-cover" />
      <ng-template #initials>{{ member.initials }}</ng-template>
    </span>
    <ng-template #none>
      <span class="inline-flex items-center justify-center rounded-full bg-surface-container text-on-surface-variant flex-shrink-0"
            [style.width.px]="size" [style.height.px]="size" title="Unassigned">
        <span class="material-symbols-outlined" [style.fontSize.px]="size * 0.6">person</span>
      </span>
    </ng-template>
  `,
})
export class UserAvatarComponent {
  @Input() member?: TeamMember;
  @Input() size = 28;
}
