import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HabitService } from '../../../core/services/habit.service';
import { AuthService } from '../../../core/services/auth.service';
import { PlannedTaskService } from '../../../core/services/planned-task.service';
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

      <!-- Unscheduled banner -->
      <section *ngIf="unscheduledToday().length" class="mb-stack-lg" data-testid="unscheduled-banner">
        <button type="button"
                (click)="bannerOpen.set(!bannerOpen())"
                class="w-full flex items-center justify-between p-4 rounded-[20px]"
                style="background:rgba(255,209,102,0.18); border:1px solid rgba(255,179,0,0.4);"
                data-testid="unscheduled-toggle">
          <span class="font-semibold text-on-surface">
            {{ unscheduledToday().length }} task{{ unscheduledToday().length === 1 ? '' : 's' }} need a time slot today
          </span>
          <span class="material-symbols-outlined"
                [style.transform]="bannerOpen() ? 'rotate(180deg)' : 'rotate(0deg)'">
            expand_more
          </span>
        </button>

        <div *ngIf="bannerOpen()" class="mt-3 grid gap-stack-sm">
          <div *ngFor="let t of unscheduledToday()"
               class="bg-surface-container-lowest rounded-[20px] p-4 flex items-center gap-3 shadow-card"
               [attr.data-testid]="'unscheduled-' + t.id">
            <span class="w-3 h-3 rounded-full" [style.background]="t.color"></span>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-on-surface truncate">{{ t.title }}</p>
              <p *ngIf="t.goal" class="text-on-surface-variant text-sm">{{ t.goal }}</p>
            </div>
          </div>

          <button
            (click)="openTodaysSchedule()"
            class="btn-primary w-full py-3 mt-2 font-semibold"
            data-testid="open-schedule">
            Open today's schedule
          </button>
        </div>
      </section>

      <!-- Now card -->
      <section *ngIf="nowTask() as t" class="mb-stack-lg" data-testid="now-card">
        <p class="font-label-sm text-label-sm text-primary uppercase mb-2">Right Now</p>
        <div class="bg-surface-container-lowest rounded-[28px] p-6 shadow-card flex gap-4 items-center">
          <span class="w-2 self-stretch rounded-full" [style.background]="t.color"></span>
          <div class="flex-1 min-w-0">
            <h3 class="font-manrope font-bold text-h2 text-on-surface truncate">{{ t.title }}</h3>
            <p class="text-on-surface-variant text-sm mt-1">
              {{ t.startTime }} – {{ t.endTime }}
              <span *ngIf="t.goal" class="ml-2">· {{ t.goal }}</span>
            </p>
          </div>
          <button
            (click)="completePlanned(t.id)"
            class="btn-primary px-4 py-2"
            data-testid="now-complete">
            Complete
          </button>
        </div>
      </section>

      <!-- Today's Plan list -->
      <section *ngIf="upcomingToday().length" class="mb-stack-lg" data-testid="todays-plan">
        <h3 class="font-manrope font-bold text-[18px] text-on-surface mb-stack-md">Today's Plan</h3>
        <div class="grid gap-stack-sm">
          <div *ngFor="let t of upcomingToday()"
               class="bg-surface-container-lowest rounded-[20px] p-4 flex items-center gap-3 shadow-card"
               [attr.data-testid]="'planned-' + t.id">
            <span class="w-3 h-3 rounded-full" [style.background]="t.color"></span>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-on-surface truncate">{{ t.title }}</p>
              <p class="text-on-surface-variant text-sm">
                {{ t.startTime }} – {{ t.endTime }}<span *ngIf="t.goal"> · {{ t.goal }}</span>
              </p>
            </div>
            <button
              (click)="completePlanned(t.id)"
              class="btn-secondary px-3 py-1.5 text-sm"
              [attr.data-testid]="'complete-' + t.id">
              Complete
            </button>
          </div>
        </div>
      </section>

      <!-- Done collapsible -->
      <section *ngIf="completedToday().length" class="mb-stack-lg" data-testid="done-section">
        <button type="button"
                (click)="showDone.set(!showDone())"
                class="w-full flex items-center justify-between py-2"
                data-testid="done-toggle">
          <span class="font-semibold text-on-surface">Done ({{ completedToday().length }})</span>
          <span class="material-symbols-outlined"
                [style.transform]="showDone() ? 'rotate(180deg)' : 'rotate(0deg)'">
            expand_more
          </span>
        </button>
        <div *ngIf="showDone()" class="grid gap-stack-sm mt-2">
          <div *ngFor="let t of completedToday()"
               class="bg-surface-container-low rounded-[20px] p-3 flex items-center gap-3"
               [attr.data-testid]="'done-' + t.id">
            <span class="w-3 h-3 rounded-full opacity-50" [style.background]="t.color"></span>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-on-surface-variant line-through truncate">{{ t.title }}</p>
            </div>
            <button
              (click)="uncompletePlanned(t.id)"
              class="text-sm text-primary font-semibold"
              [attr.data-testid]="'undo-' + t.id">
              Undo
            </button>
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
      <app-fab (clicked)="openNewTask()" />
    </div>
  `,
})
export class TodayDashboardComponent implements OnInit, OnDestroy {
  private habitService = inject(HabitService);
  private authService  = inject(AuthService);
  private plannedTasks = inject(PlannedTaskService);
  private router       = inject(Router);

  habits   = this.habitService.habits;
  progress = this.habitService.todayProgress;
  user     = this.authService.currentUser;

  readonly nowTask          = this.plannedTasks.nowTask;
  readonly upcomingToday    = this.plannedTasks.upcomingToday;
  readonly unscheduledToday = this.plannedTasks.unscheduledToday;
  readonly completedToday   = this.plannedTasks.completedToday;

  showDone = signal(false);
  bannerOpen = signal(false);

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
    this.plannedTasks.loadToday().subscribe();
    this.plannedTasks.startTicker();
  }

  ngOnDestroy(): void {
    this.plannedTasks.stopTicker();
  }

  onStart(id: string): void {
    this.habitService.startHabit(id);
  }

  onIncrement(id: string): void {
    this.habitService.incrementHabit(id);
  }

  openNewTask(): void { this.router.navigate(['/new-task']); }

  completePlanned(id: string): void {
    this.plannedTasks.complete(id).subscribe();
  }

  uncompletePlanned(id: string): void {
    this.plannedTasks.uncomplete(id).subscribe();
  }

  openTodaysSchedule(): void {
    this.router.navigateByUrl('/schedule');
  }
}
