import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HabitService } from '../../../core/services/habit.service';
import { AuthService } from '../../../core/services/auth.service';
import { HabitCardComponent } from '../../../shared/components/habit-card/habit-card.component';
import { ProgressBarComponent } from '../../../shared/components/progress-bar/progress-bar.component';
import { FabComponent } from '../../../shared/components/fab/fab.component';

@Component({
  selector: 'app-today-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, HabitCardComponent, ProgressBarComponent, FabComponent],
  template: `
    <div class="px-margin-page pt-stack-lg pb-4">

      <!-- Greeting -->
      <section class="mb-stack-lg">
        <h2 class="font-manrope font-bold text-h1 text-on-surface">Good {{ greeting }},</h2>
        <p class="text-on-surface-variant text-body-lg mt-1">{{ user()?.name || 'Friend' }}</p>
        <p class="text-on-surface-variant text-sm mt-0.5">let's make progress.</p>
      </section>

      <!-- Overall Progress Card -->
      <section class="mb-stack-lg">
        <div class="bg-surface-container-lowest rounded-[32px] p-6 shadow-card">
          <p class="font-label-sm text-label-sm text-primary uppercase mb-2">Overall Daily Goal</p>
          <div class="flex justify-between items-end mb-stack-md">
            <h3 class="font-manrope font-bold text-h2 text-on-surface">
              {{ progress().percentage }}% Completed
            </h3>
            <div class="text-right">
              <span class="text-primary-container font-bold text-h2">
                {{ progress().completedHabits }}/{{ progress().totalHabits }}
              </span>
              <p class="font-label-sm text-label-sm text-on-surface-variant">Habits done</p>
            </div>
          </div>
          <app-progress-bar [value]="progress().percentage" />

          <div class="grid grid-cols-3 gap-3 mt-5">
            <div class="text-center">
              <p class="font-manrope font-bold text-[20px] text-primary">{{ progress().completedHabits }}</p>
              <p class="font-label-sm text-label-sm text-on-surface-variant">Completed</p>
            </div>
            <div class="text-center border-x border-outline-variant">
              <p class="font-manrope font-bold text-[20px] text-on-surface">
                {{ progress().totalHabits - progress().completedHabits }}
              </p>
              <p class="font-label-sm text-label-sm text-on-surface-variant">Remaining</p>
            </div>
            <div class="text-center">
              <p class="font-manrope font-bold text-[20px] text-secondary">{{ bestStreak }}</p>
              <p class="font-label-sm text-label-sm text-on-surface-variant">Best Streak</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Habit Cards -->
      <section>
        <div class="flex items-center justify-between mb-stack-md">
          <h3 class="font-manrope font-bold text-[18px] text-on-surface">Today's Habits</h3>
          <span class="font-label-sm text-label-sm text-primary">{{ today }}</span>
        </div>
        <div class="grid gap-stack-md">
          <app-habit-card
            *ngFor="let habit of habits()"
            [habit]="habit"
            (start)="onStart($event)"
            (increment)="onIncrement($event)"
          />
        </div>
      </section>
    </div>

    <!-- FAB -->
    <div class="fixed bottom-28 right-6 z-40">
      <app-fab (clicked)="showModal = true" />
    </div>

    <!-- Create Task Modal -->
    <div *ngIf="showModal"
         class="fixed inset-0 z-50 flex items-end justify-center"
         (click)="showModal = false">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
      <div class="relative bg-surface-container-lowest rounded-t-[28px] w-full p-6 pb-10 shadow-card-active"
           (click)="$event.stopPropagation()">
        <div class="w-12 h-1 rounded-full bg-outline-variant mx-auto mb-6"></div>
        <h3 class="font-manrope font-bold text-h2 text-on-surface mb-5">Quick Add</h3>
        <input type="text" [(ngModel)]="newTaskTitle" placeholder="What do you want to accomplish?"
               class="input-ghost mb-4" />
        <div class="flex gap-3">
          <button (click)="showModal = false" class="btn-ghost flex-1">Cancel</button>
          <button (click)="addTask()" class="btn-primary flex-1">Add Task</button>
        </div>
      </div>
    </div>
  `,
})
export class TodayDashboardComponent implements OnInit {
  private habitService = inject(HabitService);
  private authService = inject(AuthService);

  habits = this.habitService.habits;
  progress = this.habitService.todayProgress;
  user = this.authService.currentUser;
  showModal = false;
  newTaskTitle = '';

  get greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  }

  get today(): string {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  get bestStreak(): number {
    return Math.max(...(this.habits().map(h => h.streak) || [0]), 0);
  }

  ngOnInit(): void {
    this.habitService.load();
  }

  onStart(id: string): void {
    this.habitService.startHabit(id);
  }

  onIncrement(id: string): void {
    this.habitService.incrementHabit(id);
  }

  addTask(): void {
    this.newTaskTitle = '';
    this.showModal = false;
  }
}
