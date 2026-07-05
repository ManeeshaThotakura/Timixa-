import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InsightService } from '../../../core/services/insight.service';
import { DaySummary, TimeBlock } from '../../../core/models/insight.model';

@Component({
  selector: 'app-insights-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="px-margin-page pt-stack-lg pb-8">

      <!-- Header -->
      <section class="mb-stack-lg">
        <h2 class="font-manrope font-bold text-h1 text-on-surface">Insights</h2>
        <p class="text-on-surface-variant text-sm mt-0.5">How you're actually doing.</p>
      </section>

      <ng-container *ngIf="summary() as s; else loadingTpl">

        <!-- Metric cards -->
        <section class="mb-stack-lg grid grid-cols-3 gap-3" data-testid="insight-metrics">
          <div class="bg-surface-container-lowest rounded-[24px] p-4 shadow-card flex flex-col items-center"
               data-testid="metric-discipline">
            <div class="relative w-16 h-16 rounded-full flex items-center justify-center mb-2"
                 [style.background]="ringStyle(s.disciplinePercent)">
              <div class="absolute inset-[6px] bg-surface-container-lowest rounded-full"></div>
              <span class="relative font-manrope font-bold text-[16px] text-on-surface">
                {{ s.disciplinePercent }}%
              </span>
            </div>
            <p class="font-label-sm text-label-sm text-on-surface-variant text-center">Discipline</p>
          </div>

          <div class="bg-surface-container-lowest rounded-[24px] p-4 shadow-card flex flex-col items-center justify-center"
               data-testid="metric-adherence">
            <p class="font-manrope font-bold text-[24px]" style="color:#00a3c4;">{{ s.adherencePercent }}%</p>
            <p class="font-label-sm text-label-sm text-on-surface-variant text-center mt-1">Adherence</p>
            <p class="text-[9px] text-on-surface-variant text-center leading-tight mt-0.5">done on schedule</p>
          </div>

          <div class="bg-surface-container-lowest rounded-[24px] p-4 shadow-card flex flex-col items-center justify-center"
               data-testid="metric-streak">
            <p class="font-manrope font-bold text-[24px] text-secondary">{{ s.topStreak?.length ?? 0 }}</p>
            <p class="font-label-sm text-label-sm text-on-surface-variant text-center mt-1">Best streak</p>
            <p *ngIf="s.topStreak" class="text-[9px] text-on-surface-variant text-center truncate max-w-full mt-0.5">
              {{ s.topStreak.title }}
            </p>
          </div>
        </section>

        <!-- Daily completion chart -->
        <section class="mb-stack-lg" data-testid="insight-chart">
          <div class="bg-surface-container-lowest rounded-[24px] p-5 shadow-card">
            <div class="flex items-center justify-between mb-stack-md">
              <h3 class="font-manrope font-bold text-[16px] text-on-surface">Daily completion</h3>
              <div class="bg-surface-container p-0.5 rounded-lg flex">
                <button type="button"
                        (click)="setWindow(7)"
                        class="px-3 py-1 text-[11px] font-bold rounded-md transition-all"
                        [class.bg-surface-container-lowest]="windowDays() === 7"
                        [class.text-primary]="windowDays() === 7"
                        [class.text-on-surface-variant]="windowDays() !== 7"
                        data-testid="window-7d">
                  7d
                </button>
                <button type="button"
                        (click)="setWindow(30)"
                        class="px-3 py-1 text-[11px] font-bold rounded-md transition-all"
                        [class.bg-surface-container-lowest]="windowDays() === 30"
                        [class.text-primary]="windowDays() === 30"
                        [class.text-on-surface-variant]="windowDays() !== 30"
                        data-testid="window-30d">
                  30d
                </button>
              </div>
            </div>

            <div class="flex items-end gap-[3px] h-32" data-testid="day-bars">
              <div *ngFor="let d of s.days"
                   class="flex-1 flex flex-col items-center justify-end h-full"
                   [attr.title]="d.date + ' · ' + d.completed + '/' + d.applicable">
                <div class="w-full rounded-t-md transition-all duration-300"
                     [style.height.%]="barHeight(d)"
                     [style.background]="d.applicable === 0
                       ? 'rgba(120,117,136,0.15)'
                       : d.percent >= 100
                         ? 'linear-gradient(180deg,#451de3,#00c1fd)'
                         : d.percent >= 50
                           ? 'rgba(94,67,251,0.55)'
                           : 'rgba(186,26,26,0.35)'"></div>
              </div>
            </div>
            <div class="flex justify-between mt-2">
              <span class="text-[10px] text-on-surface-variant">{{ firstDayLabel(s.days) }}</span>
              <span class="text-[10px] text-on-surface-variant">Today</span>
            </div>
          </div>
        </section>

        <!-- Goal performance -->
        <section *ngIf="s.goals.length" class="mb-stack-lg" data-testid="insight-goals">
          <h3 class="font-manrope font-bold text-[18px] text-on-surface mb-stack-md">Goal performance</h3>
          <div class="grid gap-stack-sm">
            <div *ngFor="let g of s.goals"
                 class="bg-surface-container-lowest rounded-[20px] p-4 shadow-card flex items-center gap-3"
                 [attr.data-testid]="'goal-' + g.goalName">
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-on-surface truncate">{{ g.goalName }}</p>
                <div class="w-full bg-surface-container h-1.5 rounded-full overflow-hidden mt-2">
                  <div class="h-full rounded-full"
                       [style.width.%]="g.completionRate"
                       style="background:linear-gradient(90deg,#451de3,#00c1fd);"></div>
                </div>
              </div>
              <div class="text-right flex-shrink-0">
                <p class="font-manrope font-bold text-[18px] text-on-surface">{{ g.completionRate }}%</p>
                <span class="material-symbols-outlined text-[16px]"
                      [style.color]="g.trend === 'up' ? '#2e7d32' : g.trend === 'down' ? '#ba1a1a' : '#787588'">
                  {{ g.trend === 'up' ? 'trending_up' : g.trend === 'down' ? 'trending_down' : 'trending_flat' }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- Deep analysis: best/worst time of day -->
        <section *ngIf="s.bestTime || s.worstTime" class="mb-stack-lg" data-testid="insight-deep">
          <h3 class="font-manrope font-bold text-[18px] text-on-surface mb-stack-md">Deep analysis</h3>
          <div class="grid grid-cols-2 gap-stack-md">
            <div *ngIf="s.bestTime"
                 class="bg-surface-container-lowest rounded-[24px] p-4 shadow-card"
                 data-testid="deep-best">
              <div class="flex items-center gap-1.5 mb-1">
                <span class="material-symbols-outlined text-[18px]" style="color:#2e7d32;">wb_sunny</span>
                <p class="font-label-sm text-label-sm uppercase" style="color:#2e7d32;">Best time</p>
              </div>
              <p class="font-manrope font-bold text-[20px] text-on-surface">{{ s.bestTime.label }}</p>
              <p class="text-on-surface-variant text-sm mt-0.5">{{ s.bestTime.percent }}% of slotted tasks done</p>
            </div>
            <div *ngIf="s.worstTime"
                 class="bg-surface-container-lowest rounded-[24px] p-4 shadow-card"
                 data-testid="deep-worst">
              <div class="flex items-center gap-1.5 mb-1">
                <span class="material-symbols-outlined text-[18px]" style="color:#ba1a1a;">bedtime</span>
                <p class="font-label-sm text-label-sm uppercase" style="color:#ba1a1a;">Weakest time</p>
              </div>
              <p class="font-manrope font-bold text-[20px] text-on-surface">{{ s.worstTime.label }}</p>
              <p class="text-on-surface-variant text-sm mt-0.5">{{ s.worstTime.percent }}% of slotted tasks done</p>
            </div>
          </div>
        </section>

        <!-- Time distribution -->
        <section *ngIf="s.timeDistribution.length" class="mb-stack-lg" data-testid="insight-time">
          <h3 class="font-manrope font-bold text-[18px] text-on-surface mb-stack-md">Time distribution</h3>
          <div class="bg-surface-container-lowest rounded-[24px] p-5 shadow-card flex items-center gap-5">
            <div class="w-24 h-24 rounded-full flex-shrink-0 relative"
                 [style.background]="donutStyle(s.timeDistribution)">
              <div class="absolute inset-[18px] bg-surface-container-lowest rounded-full flex items-center justify-center">
                <span class="font-manrope font-bold text-[13px] text-on-surface">{{ totalHours(s.timeDistribution) }}h</span>
              </div>
            </div>
            <div class="flex-1 grid gap-2">
              <div *ngFor="let tb of s.timeDistribution" class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" [style.background]="tb.color"></span>
                <span class="text-[13px] text-on-surface flex-1 truncate">{{ tb.label }}</span>
                <span class="text-[13px] font-semibold text-on-surface-variant">{{ tb.hours }}h</span>
              </div>
            </div>
          </div>
        </section>

        <div *ngIf="!s.goals.length && !s.timeDistribution.length && s.disciplinePercent === 0"
             class="bg-surface-container-low rounded-[20px] p-4 text-on-surface-variant text-sm"
             data-testid="insights-empty">
          Complete a few tasks and your numbers will show up here.
        </div>
      </ng-container>

      <ng-template #loadingTpl>
        <p class="text-on-surface-variant text-sm" data-testid="insights-loading">Crunching your numbers…</p>
      </ng-template>
    </div>
  `,
})
export class InsightsDashboardComponent implements OnInit {
  private insightService = inject(InsightService);

  summary = this.insightService.summary;
  windowDays = signal(7);

  ngOnInit(): void {
    this.insightService.load(this.windowDays());
  }

  setWindow(days: number): void {
    if (this.windowDays() === days) return;
    this.windowDays.set(days);
    this.insightService.refresh(days);
  }

  ringStyle(percent: number): string {
    const p = Math.min(100, Math.max(0, percent));
    return `conic-gradient(#451de3 0% ${p}%, rgba(120,117,136,0.15) ${p}% 100%)`;
  }

  barHeight(d: DaySummary): number {
    if (d.applicable === 0) return 6;
    return Math.max(8, d.percent);
  }

  firstDayLabel(days: DaySummary[]): string {
    if (!days.length) return '';
    const d = new Date(days[0].date + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  donutStyle(blocks: TimeBlock[]): string {
    const total = blocks.reduce((acc, b) => acc + b.hours, 0);
    if (total <= 0) return 'rgba(120,117,136,0.15)';
    let acc = 0;
    const stops: string[] = [];
    for (const b of blocks) {
      const from = (acc / total) * 100;
      acc += b.hours;
      const to = (acc / total) * 100;
      stops.push(`${b.color} ${from}% ${to}%`);
    }
    return `conic-gradient(${stops.join(', ')})`;
  }

  totalHours(blocks: TimeBlock[]): number {
    return Math.round(blocks.reduce((acc, b) => acc + b.hours, 0) * 10) / 10;
  }
}
