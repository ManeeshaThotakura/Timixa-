import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { PlannedTaskService } from '../../../core/services/planned-task.service';
import { ProgressBarComponent } from '../../../shared/components/progress-bar/progress-bar.component';
import { FabComponent } from '../../../shared/components/fab/fab.component';

@Component({
  selector: 'app-today-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgressBarComponent, FabComponent],
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
                {{ progress().completed }}/{{ progress().total }}
              </span>
              <p class="font-label-sm text-label-sm text-on-surface-variant">Tasks done</p>
            </div>
          </div>
          <app-progress-bar [value]="progress().percentage" />

          <div class="grid grid-cols-2 gap-3 mt-5">
            <div class="text-center">
              <p class="font-manrope font-bold text-[20px] text-primary">{{ progress().completed }}</p>
              <p class="font-label-sm text-label-sm text-on-surface-variant">Completed</p>
            </div>
            <div class="text-center border-l border-outline-variant">
              <p class="font-manrope font-bold text-[20px] text-on-surface">
                {{ progress().total - progress().completed }}
              </p>
              <p class="font-label-sm text-label-sm text-on-surface-variant">Remaining</p>
            </div>
          </div>
        </div>
      </section>

      <!-- View all tasks -->
      <section class="mb-stack-lg">
        <button type="button"
                (click)="openAllTasks()"
                class="w-full bg-surface-container-lowest rounded-[20px] p-4 flex items-center gap-3 shadow-card active:scale-[0.99] transition-transform"
                data-testid="view-all-tasks">
          <span class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style="background:rgba(94,67,251,0.10); color:#5e43fb;">
            <span class="material-symbols-outlined text-[20px]">list_alt</span>
          </span>
          <span class="flex-1 text-left font-semibold text-on-surface">View all tasks</span>
          <span class="material-symbols-outlined text-on-surface-variant">chevron_right</span>
        </button>
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
        <div class="bg-surface-container-lowest rounded-[28px] p-6 shadow-card">
          <div class="flex gap-4 items-center">
            <span class="w-2 self-stretch rounded-full flex-shrink-0" [style.background]="t.color"></span>
            <div class="flex-1 min-w-0">
              <h3 class="font-manrope font-bold text-h2 text-on-surface truncate">{{ t.title }}</h3>
              <p class="text-on-surface-variant text-sm mt-1">
                {{ t.startTime }} – {{ t.endTime }}
                <span *ngIf="t.goal" class="ml-2">· {{ t.goal }}</span>
              </p>
            </div>
            <button
                    (click)="completePlanned(t.id)"
                    class="btn-primary px-4 py-2 flex-shrink-0"
                    data-testid="now-complete">
              {{ isTimeBased(t) ? 'Done' : 'Complete' }}
            </button>
          </div>
          <ng-container *ngIf="isTimeBased(t)">
            <div class="mt-4 flex items-center justify-between mb-1">
              <span class="text-[11px] font-bold uppercase tracking-wider" style="color:#5e43fb;">
                {{ t.currentCount }}/{{ timeTargetOf(t) }} min
              </span>
              <span class="text-[11px] font-semibold text-on-surface-variant">{{ timePercentOf(t) }}%</span>
            </div>
            <app-progress-bar [value]="timePercentOf(t)" />
            <div class="mt-3 flex items-center gap-3">
              <input type="range"
                     [min]="0"
                     [max]="remainingTimeOf(t)"
                     step="5"
                     [(ngModel)]="logDrafts[t.id]"
                     class="flex-1 accent-primary"
                     [attr.data-testid]="'time-slider-' + t.id" />
              <span class="text-[13px] font-semibold text-on-surface min-w-[42px] text-right">
                {{ logDrafts[t.id] || 0 }}m
              </span>
              <button type="button"
                      (click)="logTime(t.id)"
                      [disabled]="!logDrafts[t.id]"
                      class="btn-primary px-3 py-1.5 text-sm disabled:opacity-40 flex-shrink-0"
                      [attr.data-testid]="'log-time-' + t.id">
                Log
              </button>
            </div>
          </ng-container>
        </div>
      </section>

      <!-- Today's Plan list -->
      <section *ngIf="upcomingToday().length" class="mb-stack-lg" data-testid="todays-plan">
        <h3 class="font-manrope font-bold text-[18px] text-on-surface mb-stack-md">Today's Plan</h3>
        <div class="grid gap-stack-sm">
          <div *ngFor="let t of upcomingToday()"
               class="rounded-[20px] p-4 shadow-card"
               [class.bg-surface-container-lowest]="!isMissed(t)"
               [style.background]="isMissed(t) ? 'rgba(186,26,26,0.06)' : null"
               [style.opacity]="isMissed(t) ? '0.95' : '1'"
               [attr.data-testid]="'planned-' + t.id">
            <div class="flex items-center gap-3">
              <span class="w-3 h-3 rounded-full flex-shrink-0" [style.background]="t.color"></span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <p class="font-semibold text-on-surface truncate">{{ t.title }}</p>
                  <span *ngIf="isMissed(t)"
                        class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0"
                        style="background:rgba(186,26,26,0.14); color:#ba1a1a;"
                        [attr.data-testid]="'missed-badge-' + t.id">
                    Missed
                  </span>
                </div>
                <p class="text-on-surface-variant text-sm">
                  {{ t.startTime }} – {{ t.endTime }}<span *ngIf="t.goal"> · {{ t.goal }}</span>
                </p>
              </div>
              <button
                      (click)="completePlanned(t.id)"
                      class="btn-secondary px-3 py-1.5 text-sm flex-shrink-0"
                      [attr.data-testid]="'complete-' + t.id">
                {{ isTimeBased(t) ? 'Done' : 'Complete' }}
              </button>
            </div>
            <ng-container *ngIf="isTimeBased(t)">
              <div class="mt-3 flex items-center justify-between mb-1">
                <span class="text-[11px] font-bold uppercase tracking-wider" style="color:#5e43fb;">
                  {{ t.currentCount }}/{{ timeTargetOf(t) }} min
                </span>
                <span class="text-[11px] font-semibold text-on-surface-variant">{{ timePercentOf(t) }}%</span>
              </div>
              <app-progress-bar [value]="timePercentOf(t)" />
              <div class="mt-3 flex items-center gap-3">
                <input type="range"
                       [min]="0"
                       [max]="remainingTimeOf(t)"
                       step="5"
                       [(ngModel)]="logDrafts[t.id]"
                       class="flex-1 accent-primary"
                       [attr.data-testid]="'time-slider-' + t.id" />
                <span class="text-[13px] font-semibold text-on-surface min-w-[42px] text-right">
                  {{ logDrafts[t.id] || 0 }}m
                </span>
                <button type="button"
                        (click)="logTime(t.id)"
                        [disabled]="!logDrafts[t.id]"
                        class="btn-primary px-3 py-1.5 text-sm disabled:opacity-40 flex-shrink-0"
                        [attr.data-testid]="'log-time-' + t.id">
                  Log
                </button>
              </div>
            </ng-container>
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

      <!-- Today's tasks (no time slot required) -->
      <section *ngIf="flexibleToday().length" class="mb-stack-lg" data-testid="flexible-today">
        <h3 class="font-manrope font-bold text-[18px] text-on-surface mb-stack-md">Today's tasks</h3>
        <div class="grid gap-stack-sm">
          <div *ngFor="let t of flexibleToday()"
               class="bg-surface-container-lowest rounded-[20px] p-4 shadow-card"
               [attr.data-testid]="'flex-' + t.id">
            <div class="flex items-center gap-3">
              <span class="w-3 h-3 rounded-full flex-shrink-0" [style.background]="t.color"></span>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-on-surface truncate">{{ t.title }}</p>
                <p *ngIf="t.goal" class="text-on-surface-variant text-sm truncate">{{ t.goal }}</p>
              </div>
              <button type="button"
                      (click)="incrementPlanned(t.id)"
                      class="btn-primary px-4 py-2 text-sm"
                      [attr.data-testid]="'start-' + t.id">
                {{ targetOf(t) > 1 && t.currentCount > 0 ? '+1' : 'Start' }}
              </button>
            </div>
            <div *ngIf="targetOf(t) > 1" class="mt-3" [attr.data-testid]="'flex-progress-' + t.id">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[11px] font-bold uppercase tracking-wider" style="color:#5e43fb;">
                  {{ t.currentCount }}/{{ targetOf(t) }} {{ t.currentCount === 1 ? 'time' : 'times' }}
                </span>
                <span class="text-[11px] font-semibold text-on-surface-variant">
                  {{ progressPercentOf(t) }}%
                </span>
              </div>
              <app-progress-bar [value]="progressPercentOf(t)" />
            </div>
          </div>
        </div>
      </section>

      <div *ngIf="totalToday() === 0" class="mb-stack-lg" data-testid="dashboard-empty">
        <div class="bg-surface-container-low rounded-[20px] p-4 text-on-surface-variant text-sm">
          Nothing planned for today. Tap the + button to add a task.
        </div>
      </div>
    </div>

    <!-- Unscheduled tasks prompt -->
    <div *ngIf="unschedPromptOpen()"
         class="fixed inset-0 z-[100] flex items-end justify-center bg-black/40"
         data-testid="unsched-prompt"
         (click)="dismissUnschedPrompt()">
      <div class="bg-surface-container-lowest w-full max-w-md rounded-t-[32px] p-6 shadow-card"
           (click)="$event.stopPropagation()">
        <p class="font-label-sm text-label-sm uppercase mb-1" style="color:#b76d00;">Heads up</p>
        <h3 class="font-manrope font-bold text-h2 text-on-surface">
          {{ unscheduledToday().length }} task{{ unscheduledToday().length === 1 ? '' : 's' }} need a time slot today
        </h3>
        <p class="text-on-surface-variant text-sm mt-1 mb-stack-md">
          Drop them onto the schedule so they actually happen.
        </p>
        <div class="flex gap-3">
          <button type="button"
                  (click)="dismissUnschedPrompt()"
                  class="btn-secondary flex-1 py-3 font-semibold"
                  data-testid="unsched-prompt-dismiss">
            Later
          </button>
          <button type="button"
                  (click)="openScheduleFromPrompt()"
                  class="btn-primary flex-1 py-3 font-semibold"
                  data-testid="unsched-prompt-open">
            Schedule now
          </button>
        </div>
      </div>
    </div>

    <!-- Bedtime prompt -->
    <div *ngIf="bedtimePromptOpen()"
         class="fixed inset-0 z-[100] flex items-end justify-center bg-black/40"
         data-testid="bedtime-prompt"
         (click)="dismissBedtimePrompt()">
      <div class="bg-surface-container-lowest w-full max-w-md rounded-t-[32px] p-6 shadow-card"
           (click)="$event.stopPropagation()">
        <p class="font-label-sm text-label-sm text-primary uppercase mb-1">Wind down</p>
        <h3 class="font-manrope font-bold text-h2 text-on-surface">Summarize your day?</h3>
        <p class="text-on-surface-variant text-sm mt-1 mb-stack-md">
          Close out what's left and tee up tomorrow.
        </p>
        <div class="flex gap-3">
          <button type="button"
                  (click)="dismissBedtimePrompt()"
                  class="btn-secondary flex-1 py-3 font-semibold"
                  data-testid="bedtime-prompt-dismiss">
            Not now
          </button>
          <button type="button"
                  (click)="openBedtimeSummary()"
                  class="btn-primary flex-1 py-3 font-semibold"
                  data-testid="bedtime-prompt-open">
            Summarize
          </button>
        </div>
      </div>
    </div>

    <!-- FAB -->
    <div class="fixed bottom-28 right-6 z-40">
      <app-fab (clicked)="openNewTask()" />
    </div>
  `,
})
export class TodayDashboardComponent implements OnInit, OnDestroy {
  private authService  = inject(AuthService);
  private plannedTasks = inject(PlannedTaskService);
  private router       = inject(Router);

  user = this.authService.currentUser;

  readonly nowTask          = this.plannedTasks.nowTask;
  readonly upcomingToday    = this.plannedTasks.upcomingToday;
  readonly unscheduledToday = this.plannedTasks.unscheduledToday;
  readonly flexibleToday    = this.plannedTasks.flexibleToday;
  readonly completedToday   = this.plannedTasks.completedToday;

  readonly totalToday = computed(() =>
    this.upcomingToday().length
      + (this.nowTask() ? 1 : 0)
      + this.unscheduledToday().length
      + this.flexibleToday().length
      + this.completedToday().length,
  );

  readonly progress = computed(() => {
    const total = this.totalToday();
    const completed = this.completedToday().length;
    return {
      total,
      completed,
      percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  });

  showDone = signal(false);
  bannerOpen = signal(false);
  bedtimePromptOpen = signal(false);
  unschedPromptOpen = signal(false);
  logDrafts: { [taskId: string]: number } = {};

  get greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  }

  get today(): string {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  ngOnInit(): void {
    this.plannedTasks.loadToday().subscribe(() => {
      if (this.bedtimePromptOpen()) return;
      if (this.unscheduledToday().length === 0) return;
      const key = `timixa.unschedPrompt.${this.todayKey()}`;
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) return;
      this.unschedPromptOpen.set(true);
    });
    this.plannedTasks.startTicker();
    if (this.shouldShowBedtimePrompt()) this.bedtimePromptOpen.set(true);
  }

  dismissUnschedPrompt(): void {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(`timixa.unschedPrompt.${this.todayKey()}`, '1');
    }
    this.unschedPromptOpen.set(false);
  }

  openScheduleFromPrompt(): void {
    this.dismissUnschedPrompt();
    this.router.navigateByUrl('/schedule');
  }

  private shouldShowBedtimePrompt(): boolean {
    const u = this.user();
    if (!u?.bedtime) return false;
    const key = `timixa.bedtimePrompt.${this.todayKey()}`;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) return false;
    return this.isWithinBedtimeWindow(u.bedtime);
  }

  private isWithinBedtimeWindow(bedtime: string): boolean {
    const [bh, bm] = bedtime.split(':').map(Number);
    if (Number.isNaN(bh) || Number.isNaN(bm)) return false;
    const bedMin = bh * 60 + bm;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const start = (bedMin - 30 + 1440) % 1440;
    const end = (bedMin + 480) % 1440;
    return start <= end
      ? nowMin >= start && nowMin <= end
      : nowMin >= start || nowMin <= end;
  }

  private markBedtimePromptShown(): void {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(`timixa.bedtimePrompt.${this.todayKey()}`, '1');
    }
  }

  private todayKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  dismissBedtimePrompt(): void {
    this.markBedtimePromptShown();
    this.bedtimePromptOpen.set(false);
  }

  openBedtimeSummary(): void {
    this.markBedtimePromptShown();
    this.bedtimePromptOpen.set(false);
    this.router.navigateByUrl('/bedtime-summary');
  }

  ngOnDestroy(): void {
    this.plannedTasks.stopTicker();
  }

  openNewTask(): void { this.router.navigate(['/new-task']); }

  openAllTasks(): void { this.router.navigate(['/tasks']); }

  completePlanned(id: string): void {
    this.plannedTasks.complete(id).subscribe();
  }

  incrementPlanned(id: string): void {
    this.plannedTasks.increment(id).subscribe();
  }

  targetOf(t: { minCount?: number | null }): number {
    return Math.max(1, t.minCount ?? 1);
  }

  progressPercentOf(t: { currentCount: number; minCount?: number | null }): number {
    const target = this.targetOf(t);
    if (target <= 0) return 0;
    return Math.min(100, Math.round((t.currentCount / target) * 100));
  }

  isMissed(t: { endTime?: string }): boolean {
    return !!t.endTime && t.endTime <= this.plannedTasks.nowHHmm();
  }

  timeTargetOf(t: { minTimeMinutes?: number | null; startTime?: string; endTime?: string }): number {
    if (t.minTimeMinutes && t.minTimeMinutes > 0) return t.minTimeMinutes;
    if (t.startTime && t.endTime) {
      const [sh, sm] = t.startTime.split(':').map(Number);
      const [eh, em] = t.endTime.split(':').map(Number);
      const diff = eh * 60 + em - (sh * 60 + sm);
      if (diff > 0) return diff;
    }
    return 0;
  }

  isTimeBased(t: { minTimeMinutes?: number | null; startTime?: string; endTime?: string }): boolean {
    return this.timeTargetOf(t) > 0;
  }

  remainingTimeOf(t: { currentCount: number; minTimeMinutes?: number | null; startTime?: string; endTime?: string }): number {
    return Math.max(0, this.timeTargetOf(t) - (t.currentCount || 0));
  }

  timePercentOf(t: { currentCount: number; minTimeMinutes?: number | null; startTime?: string; endTime?: string }): number {
    const target = this.timeTargetOf(t);
    if (target <= 0) return 0;
    return Math.min(100, Math.round(((t.currentCount || 0) / target) * 100));
  }

  logTime(id: string): void {
    const delta = Math.round(Number(this.logDrafts[id] || 0));
    if (delta <= 0) return;
    this.plannedTasks.increment(id, delta).subscribe(() => {
      this.logDrafts[id] = 0;
    });
  }

  uncompletePlanned(id: string): void {
    this.plannedTasks.uncomplete(id).subscribe();
  }

  openTodaysSchedule(): void {
    this.router.navigateByUrl('/schedule');
  }
}
