import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Habit } from '../../../core/models/habit.model';
import { ProgressBarComponent } from '../progress-bar/progress-bar.component';

@Component({
  selector: 'app-habit-card',
  standalone: true,
  imports: [CommonModule, ProgressBarComponent],
  template: `
    <div class="bg-surface-container-lowest rounded-[24px] p-5 shadow-card flex flex-col gap-4">
      <div class="flex justify-between items-start">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl flex items-center justify-center"
               [style.background]="habit.color">
            <span class="material-symbols-outlined text-primary">{{ habit.icon }}</span>
          </div>
          <div>
            <h4 class="font-manrope font-semibold text-[18px] text-on-surface leading-tight">{{ habit.title }}</h4>
            <p class="font-label-sm text-label-sm text-on-surface-variant mt-0.5">{{ habit.category }}</p>
          </div>
        </div>
        <button
          *ngIf="!isCompleted"
          (click)="start.emit(habit.id)"
          class="bg-primary-container text-white px-4 py-2 rounded-xl flex items-center gap-2
                 active:scale-95 transition-transform duration-200 text-sm font-semibold">
          <span class="material-symbols-outlined text-[18px] filled">play_arrow</span>
          Start
        </button>
        <button
          *ngIf="isCompleted"
          class="bg-green-100 text-green-600 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold">
          <span class="material-symbols-outlined text-[18px] filled">check_circle</span>
          Done
        </button>
      </div>

      <div class="space-y-2">
        <div class="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
          <span>{{ habit.currentCount }} / {{ habit.targetCount }} {{ habit.unit }}</span>
          <span class="text-primary font-bold">{{ progressPercent }}%</span>
        </div>
        <app-progress-bar [value]="progressPercent" />
      </div>

      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[16px] text-orange-400 filled">local_fire_department</span>
          <span class="font-label-sm text-label-sm text-on-surface-variant">{{ habit.streak }} day streak</span>
        </div>
        <button
          *ngIf="!isCompleted"
          (click)="increment.emit(habit.id)"
          class="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center
                 text-primary active:scale-90 transition-transform duration-200">
          <span class="material-symbols-outlined text-[20px] font-bold">add</span>
        </button>
      </div>
    </div>
  `,
})
export class HabitCardComponent {
  @Input() habit!: Habit;
  @Output() start = new EventEmitter<string>();
  @Output() increment = new EventEmitter<string>();

  get progressPercent(): number {
    return Math.min(100, Math.round((this.habit.currentCount / this.habit.targetCount) * 100));
  }

  get isCompleted(): boolean {
    return this.habit.currentCount >= this.habit.targetCount;
  }
}
