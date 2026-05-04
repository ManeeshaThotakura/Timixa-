import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Project } from '../../../core/models/project.model';
import { ProgressBarComponent } from '../progress-bar/progress-bar.component';

@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [CommonModule, ProgressBarComponent],
  template: `
    <div
      class="bg-surface-container-lowest rounded-[24px] p-6 shadow-card hover:shadow-card-hover
             transition-all duration-300 cursor-pointer relative overflow-hidden"
      (click)="clicked.emit(project.id)">

      <div class="absolute top-0 right-0 p-4">
        <span class="px-3 py-1 rounded-full font-label-sm text-label-sm"
              [class]="priorityClass">
          {{ project.priority | titlecase }} Priority
        </span>
      </div>

      <div class="flex items-start gap-3 mb-3 pr-24">
        <div class="w-2 h-8 rounded-full flex-shrink-0" [style.background]="project.color"></div>
        <div>
          <h3 class="font-manrope font-bold text-[18px] text-on-surface leading-tight">{{ project.title }}</h3>
          <p class="font-body-md text-sm text-on-surface-variant mt-1">{{ project.description }}</p>
        </div>
      </div>

      <div class="space-y-2 mb-4">
        <div class="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
          <span>Progress</span>
          <span class="font-bold text-primary">{{ project.progress }}%</span>
        </div>
        <app-progress-bar [value]="project.progress" />
      </div>

      <div class="flex items-center justify-between">
        <div class="flex gap-2 flex-wrap">
          <span *ngFor="let tag of project.tags"
                class="px-2 py-0.5 bg-surface-container rounded-full font-label-sm text-label-sm text-on-surface-variant">
            {{ tag }}
          </span>
        </div>
        <div class="flex items-center gap-1 text-on-surface-variant text-xs">
          <span class="material-symbols-outlined text-[14px]">calendar_today</span>
          <span>{{ project.dueDate | date:'MMM d' }}</span>
        </div>
      </div>
    </div>
  `,
})
export class ProjectCardComponent {
  @Input() project!: Project;
  @Output() clicked = new EventEmitter<string>();

  get priorityClass(): string {
    return {
      high: 'bg-red-50 text-red-500',
      medium: 'bg-amber-50 text-amber-600',
      low: 'bg-green-50 text-green-600',
    }[this.project.priority];
  }
}
