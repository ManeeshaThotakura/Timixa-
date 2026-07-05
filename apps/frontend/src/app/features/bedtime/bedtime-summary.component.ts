import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { InsightService } from '../../core/services/insight.service';
import { PlannedTaskService } from '../../core/services/planned-task.service';
import { BedtimeSummary } from '../../core/models/bedtime-summary.model';
import { PlannedTask } from '../../core/models/planned-task.model';

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Component({
  selector: 'app-bedtime-summary',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="px-margin-page pt-stack-lg pb-12">

      <header class="mb-stack-lg" data-testid="bedtime-header">
        <p class="font-label-sm text-label-sm text-primary uppercase mb-1">Wind down</p>
        <h2 class="font-manrope font-bold text-h1 text-on-surface">How did today go?</h2>
        <p class="text-on-surface-variant text-body-lg mt-1">{{ prettyDate }}</p>
      </header>

      <ng-container *ngIf="summary() as s; else loadingTpl">

        <!-- Pending today -->
        <section class="mb-stack-lg" data-testid="bedtime-pending">
          <div class="flex items-baseline justify-between mb-stack-md">
            <h3 class="font-manrope font-bold text-[18px] text-on-surface">Pending today</h3>
            <span class="text-on-surface-variant text-sm">{{ s.pendingToday.length }}</span>
          </div>

          <div *ngIf="s.pendingToday.length === 0"
               class="bg-surface-container-low rounded-[20px] p-4 text-on-surface-variant text-sm"
               data-testid="bedtime-pending-empty">
            Nothing left. Beautiful close to the day.
          </div>

          <div *ngIf="s.pendingToday.length" class="grid gap-stack-sm">
            <div *ngFor="let t of s.pendingToday"
                 class="bg-surface-container-lowest rounded-[20px] p-4 shadow-card"
                 [attr.data-testid]="'bedtime-pending-' + t.id">
              <div class="flex items-center gap-3">
                <span class="w-3 h-3 rounded-full flex-shrink-0" [style.background]="t.color"></span>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-on-surface truncate">{{ t.title }}</p>
                  <p class="text-on-surface-variant text-sm">
                    <ng-container *ngIf="t.startTime && t.endTime">
                      {{ t.startTime }} – {{ t.endTime }}
                    </ng-container>
                    <ng-container *ngIf="!t.startTime">No time set</ng-container>
                    <span *ngIf="t.goal" class="ml-2">· {{ t.goal }}</span>
                  </p>
                </div>
                <button type="button"
                        (click)="complete(t.id)"
                        [disabled]="completing().has(t.id)"
                        class="btn-primary px-3 py-1.5 text-sm disabled:opacity-50 flex-shrink-0"
                        [attr.data-testid]="'bedtime-complete-' + t.id">
                  Done
                </button>
              </div>

              <!-- Time-based partial log -->
              <div *ngIf="isTimeBased(t)" class="mt-3" [attr.data-testid]="'bedtime-time-log-' + t.id">
                <p class="text-[11px] font-bold uppercase tracking-wider mb-1" style="color:#5e43fb;">
                  {{ t.currentCount }}/{{ timeTargetOf(t) }} min logged
                </p>
                <div class="flex items-center gap-3">
                  <input type="range"
                         [min]="0"
                         [max]="remainingTimeOf(t)"
                         step="5"
                         [(ngModel)]="logDrafts[t.id]"
                         class="flex-1 accent-primary"
                         [attr.data-testid]="'bedtime-time-slider-' + t.id" />
                  <span class="text-[13px] font-semibold text-on-surface min-w-[42px] text-right">
                    {{ logDrafts[t.id] || 0 }}m
                  </span>
                  <button type="button"
                          (click)="log(t.id)"
                          [disabled]="!logDrafts[t.id]"
                          class="btn-secondary px-3 py-1.5 text-sm disabled:opacity-40 flex-shrink-0"
                          [attr.data-testid]="'bedtime-log-' + t.id">
                    Log
                  </button>
                </div>
              </div>

              <!-- Count-based partial log -->
              <div *ngIf="!isTimeBased(t) && countTargetOf(t) > 1" class="mt-3"
                   [attr.data-testid]="'bedtime-count-log-' + t.id">
                <p class="text-[11px] font-bold uppercase tracking-wider mb-1" style="color:#5e43fb;">
                  {{ t.currentCount }}/{{ countTargetOf(t) }} times
                </p>
                <div class="flex items-center gap-3">
                  <input type="range"
                         [min]="0"
                         [max]="remainingCountOf(t)"
                         step="1"
                         [(ngModel)]="logDrafts[t.id]"
                         class="flex-1 accent-primary"
                         [attr.data-testid]="'bedtime-count-slider-' + t.id" />
                  <span class="text-[13px] font-semibold text-on-surface min-w-[42px] text-right">
                    +{{ logDrafts[t.id] || 0 }}
                  </span>
                  <button type="button"
                          (click)="log(t.id)"
                          [disabled]="!logDrafts[t.id]"
                          class="btn-secondary px-3 py-1.5 text-sm disabled:opacity-40 flex-shrink-0"
                          [attr.data-testid]="'bedtime-log-' + t.id">
                    Log
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Streaks -->
        <section class="mb-stack-lg" data-testid="bedtime-streaks">
          <h3 class="font-manrope font-bold text-[18px] text-on-surface mb-stack-md">Your streaks</h3>
          <div class="grid grid-cols-2 gap-stack-md">
            <div class="bg-surface-container-lowest rounded-[24px] p-4 shadow-card"
                 data-testid="bedtime-top-streak">
              <p class="font-label-sm text-label-sm text-primary uppercase mb-1">Best run</p>
              <ng-container *ngIf="s.topStreak; else emptyStreak">
                <p class="font-manrope font-bold text-[24px] text-on-surface">{{ s.topStreak.length }} day{{ s.topStreak.length === 1 ? '' : 's' }}</p>
                <p class="text-on-surface-variant text-sm mt-0.5 truncate">{{ s.topStreak.title }}</p>
              </ng-container>
              <ng-template #emptyStreak>
                <p class="font-manrope font-bold text-[24px] text-on-surface-variant">–</p>
                <p class="text-on-surface-variant text-sm mt-0.5">No streak yet</p>
              </ng-template>
            </div>
            <div class="bg-surface-container-lowest rounded-[24px] p-4 shadow-card"
                 data-testid="bedtime-top-missed">
              <p class="font-label-sm text-label-sm uppercase mb-1" style="color:#c44a3b;">Longest miss</p>
              <ng-container *ngIf="s.topMissedStreak; else emptyMissed">
                <p class="font-manrope font-bold text-[24px] text-on-surface">{{ s.topMissedStreak.length }} day{{ s.topMissedStreak.length === 1 ? '' : 's' }}</p>
                <p class="text-on-surface-variant text-sm mt-0.5 truncate">{{ s.topMissedStreak.title }}</p>
              </ng-container>
              <ng-template #emptyMissed>
                <p class="font-manrope font-bold text-[24px] text-on-surface-variant">–</p>
                <p class="text-on-surface-variant text-sm mt-0.5">Clean slate</p>
              </ng-template>
            </div>
          </div>
        </section>

        <!-- Tomorrow -->
        <section class="mb-stack-lg" data-testid="bedtime-tomorrow">
          <h3 class="font-manrope font-bold text-[18px] text-on-surface mb-stack-md">Prepare for tomorrow</h3>
          <div class="bg-surface-container-lowest rounded-[24px] p-5 shadow-card">
            <div class="grid grid-cols-2 gap-stack-md mb-stack-md">
              <div data-testid="bedtime-tomorrow-unscheduled">
                <p class="font-manrope font-bold text-[28px] text-on-surface">{{ s.tomorrow.unscheduledCount }}</p>
                <p class="text-on-surface-variant text-sm">unscheduled</p>
              </div>
              <div data-testid="bedtime-tomorrow-conflicts">
                <p class="font-manrope font-bold text-[28px] text-on-surface">{{ s.tomorrow.overlapConflictCount }}</p>
                <p class="text-on-surface-variant text-sm">overlap conflict{{ s.tomorrow.overlapConflictCount === 1 ? '' : 's' }}</p>
              </div>
            </div>
            <button type="button"
                    (click)="openTomorrow()"
                    class="btn-primary w-full py-3 font-semibold"
                    data-testid="bedtime-open-tomorrow">
              Open tomorrow's schedule
            </button>
          </div>
        </section>

        <button type="button"
                (click)="dismiss()"
                class="btn-secondary w-full py-3 font-semibold"
                data-testid="bedtime-dismiss">
          Done — back to today
        </button>
      </ng-container>

      <ng-template #loadingTpl>
        <p class="text-on-surface-variant text-sm" data-testid="bedtime-loading">Loading your day…</p>
      </ng-template>
    </div>
  `,
})
export class BedtimeSummaryComponent implements OnInit {
  private insights = inject(InsightService);
  private plannedTasks = inject(PlannedTaskService);
  private router = inject(Router);

  readonly summary = signal<BedtimeSummary | null>(null);
  readonly completing = signal<Set<string>>(new Set());
  logDrafts: { [taskId: string]: number } = {};

  readonly prettyDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.insights.bedtimeSummary(todayIso()).subscribe(s => this.summary.set(s));
  }

  complete(taskId: string): void {
    const next = new Set(this.completing());
    next.add(taskId);
    this.completing.set(next);
    this.plannedTasks.complete(taskId, todayIso()).subscribe({
      next: () => {
        const cur = this.summary();
        if (cur) {
          this.summary.set({
            ...cur,
            pendingToday: cur.pendingToday.filter(t => t.id !== taskId),
          });
        }
        const after = new Set(this.completing());
        after.delete(taskId);
        this.completing.set(after);
      },
      error: () => {
        const after = new Set(this.completing());
        after.delete(taskId);
        this.completing.set(after);
      },
    });
  }

  log(taskId: string): void {
    const delta = Math.round(Number(this.logDrafts[taskId] || 0));
    if (delta <= 0) return;
    this.plannedTasks.increment(taskId, delta, todayIso()).subscribe(updated => {
      this.logDrafts[taskId] = 0;
      const cur = this.summary();
      if (!cur) return;
      this.summary.set({
        ...cur,
        pendingToday: updated.completedToday
          ? cur.pendingToday.filter(t => t.id !== taskId)
          : cur.pendingToday.map(t => (t.id === taskId ? updated : t)),
      });
    });
  }

  timeTargetOf(t: PlannedTask): number {
    if (t.minTimeMinutes && t.minTimeMinutes > 0) return t.minTimeMinutes;
    if (t.startTime && t.endTime) {
      const [sh, sm] = t.startTime.split(':').map(Number);
      const [eh, em] = t.endTime.split(':').map(Number);
      const diff = eh * 60 + em - (sh * 60 + sm);
      if (diff > 0) return diff;
    }
    return 0;
  }

  isTimeBased(t: PlannedTask): boolean {
    return this.timeTargetOf(t) > 0;
  }

  remainingTimeOf(t: PlannedTask): number {
    return Math.max(0, this.timeTargetOf(t) - (t.currentCount || 0));
  }

  countTargetOf(t: PlannedTask): number {
    return Math.max(1, t.minCount ?? 1);
  }

  remainingCountOf(t: PlannedTask): number {
    return Math.max(0, this.countTargetOf(t) - (t.currentCount || 0));
  }

  openTomorrow(): void {
    this.router.navigate(['/schedule/calendar'], { queryParams: { date: tomorrowIso() } });
  }

  dismiss(): void {
    this.router.navigateByUrl('/dashboard');
  }
}
