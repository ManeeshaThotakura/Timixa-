import { Component, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { InsightService } from '../../../core/services/insight.service';
import { DeepAnalysis } from '../../../core/models/insight.model';

const SMART_INSIGHTS = [
  {
    icon: 'bolt',
    color: 'rgba(94,67,251,0.05)',
    border: 'rgba(94,67,251,0.1)',
    iconColor: '#451de3',
    title: 'Peak Performance Window',
    body: 'You perform best between 9 AM – 11 AM. Schedule your Deep Work sessions then.',
  },
  {
    icon: 'split_scene',
    color: 'rgba(0,193,253,0.05)',
    border: 'rgba(0,193,253,0.1)',
    iconColor: '#006688',
    title: 'Task Splitting Boost',
    body: 'Splitting complex tasks into chunks increases your completion rate by 30%.',
  },
];

@Component({
  selector: 'app-insights-dashboard',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    .velocity-ring {
      background:
        radial-gradient(closest-side, white 79%, transparent 80% 100%),
        var(--ring-gradient);
    }
  `],
  template: `
    <main class="px-margin-page pt-stack-lg pb-32 max-w-lg mx-auto space-y-stack-lg">

      <!-- Loading -->
      <div *ngIf="!summary()" class="flex items-center justify-center py-20">
        <span class="material-symbols-outlined text-primary text-[32px] animate-spin">progress_activity</span>
      </div>

      <ng-container *ngIf="summary() as s">

        <!-- 1. Summary Snapshot -->
        <section class="bg-surface-container-lowest rounded-xl p-stack-md shadow-[0px_8px_24px_rgba(94,67,251,0.04)]">
          <div class="flex flex-col items-center text-center space-y-4">

            <!-- Circular velocity ring -->
            <div class="relative w-40 h-40 rounded-full flex items-center justify-center velocity-ring"
                 [style.--ring-gradient]="velocityRingStyle(s.overallScore)">
              <div class="flex flex-col items-center">
                <span class="text-[32px] font-extrabold text-primary leading-none" style="font-family:Manrope;">
                  {{ s.overallScore }}%
                </span>
                <span class="text-[11px] font-semibold text-outline uppercase tracking-widest mt-1">Velocity</span>
              </div>
            </div>

            <!-- Stats row -->
            <div class="flex justify-between w-full px-4 border-t border-surface-container pt-4">
              <div class="flex flex-col">
                <span class="text-[11px] font-semibold text-outline uppercase tracking-wider">Discipline Score</span>
                <span class="text-[24px] font-bold text-on-surface mt-0.5" style="font-family:Manrope;">
                  {{ s.totalHabits }}
                </span>
              </div>
              <div class="flex flex-col items-end">
                <span class="text-[11px] font-semibold text-outline uppercase tracking-wider">Streak</span>
                <span class="text-[24px] font-bold text-on-surface mt-0.5" style="font-family:Manrope;">
                  {{ s.streak }} Days
                </span>
              </div>
            </div>

            <!-- Motivational quote -->
            <p class="text-secondary italic text-[16px]">"You're on track, keep it up!"</p>
          </div>
        </section>

        <!-- 2. Goal Performance -->
        <section class="space-y-stack-md">
          <h3 class="font-bold text-[24px] text-on-surface px-1" style="font-family:Manrope;">Goal Performance</h3>
          <div class="grid grid-cols-1 gap-gutter">
            <div *ngFor="let goal of s.goals"
                 class="bg-surface-container-lowest p-stack-md rounded-xl shadow-[0px_8px_24px_rgba(94,67,251,0.04)] flex flex-col space-y-3">

              <div class="flex justify-between items-center">
                <span class="font-semibold text-[18px] text-on-surface">{{ goal.goalName }}</span>
                <div class="flex items-center gap-1"
                     [style.color]="goal.trend === 'up' ? '#16a34a' : goal.trend === 'down' ? '#ba1a1a' : '#787588'">
                  <span class="material-symbols-outlined text-[18px]">
                    {{ goal.trend === 'up' ? 'trending_up' : goal.trend === 'down' ? 'trending_down' : 'trending_flat' }}
                  </span>
                  <span class="font-semibold text-label-sm">
                    {{ goal.trend === 'up' ? '+' : '' }}{{ trendDelta(goal.completionRate) }}%
                  </span>
                </div>
              </div>

              <span class="text-[16px] text-outline">{{ goal.completionRate }}% Completion</span>

              <!-- Progress bar -->
              <div class="w-full h-2.5 bg-surface-container rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500"
                     [style.width.%]="goal.completionRate"
                     style="background:linear-gradient(90deg,#451de3,#00c1fd);">
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 3. Deep Analysis -->
        <section class="space-y-stack-md">
          <h3 class="font-bold text-[24px] text-on-surface px-1" style="font-family:Manrope;">Deep Analysis</h3>
          <div class="space-y-gutter">

            <!-- Best performing -->
            <ng-container *ngFor="let item of s.deepAnalysis">
              <div *ngIf="item.status === 'verified'"
                   class="bg-surface-container-lowest p-stack-md rounded-xl border-l-4 border-green-400">
                <div class="flex items-center gap-2 mb-2">
                  <span class="material-symbols-outlined text-green-600 text-[20px]">verified</span>
                  <span class="text-[11px] font-bold text-green-800 uppercase tracking-wider">Best Performing</span>
                </div>
                <div class="flex justify-between items-end">
                  <div>
                    <p class="font-semibold text-[18px] text-on-surface">{{ item.title }}</p>
                    <p class="text-[16px] text-outline">Habits consistently met</p>
                  </div>
                  <span class="font-bold text-[24px] text-green-600" style="font-family:Manrope;">
                    {{ item.score }}%
                  </span>
                </div>
              </div>

              <!-- Needs attention -->
              <div *ngIf="item.status === 'warning'"
                   class="bg-surface-container-lowest p-stack-md rounded-xl border-l-4 border-error">
                <div class="flex items-center gap-2 mb-2">
                  <span class="material-symbols-outlined text-error text-[20px]">warning</span>
                  <span class="text-[11px] font-bold text-error uppercase tracking-wider">Needs Attention</span>
                </div>
                <div class="flex justify-between items-start mb-3">
                  <div>
                    <p class="font-semibold text-[18px] text-on-surface">{{ item.title }}</p>
                    <span class="inline-block mt-1 px-2 py-0.5 rounded text-[12px] font-semibold text-error"
                          style="background:rgba(186,26,26,0.08);">42% Miss Rate</span>
                  </div>
                </div>
                <div *ngIf="item.insight"
                     class="p-stack-sm bg-surface-container-low rounded-lg flex items-start gap-2">
                  <span class="material-symbols-outlined text-primary text-[16px] mt-0.5">lightbulb</span>
                  <p class="text-[12px] italic text-on-surface-variant">"{{ item.insight }}"</p>
                </div>
              </div>
            </ng-container>
          </div>
        </section>

        <!-- 4. Discipline Analysis (bar chart) -->
        <section class="space-y-stack-md">
          <h3 class="font-bold text-[24px] text-on-surface px-1" style="font-family:Manrope;">Discipline Analysis</h3>
          <div class="bg-surface-container-lowest p-stack-md rounded-xl shadow-[0px_8px_24px_rgba(94,67,251,0.04)]">

            <div class="flex justify-between items-center mb-6">
              <div>
                <span class="text-[11px] font-semibold text-outline uppercase tracking-wider">Planned vs. Completed</span>
                <p class="font-bold text-[24px] text-primary mt-0.5" style="font-family:Manrope;">
                  {{ s.focusHours }} / 20 hrs
                </p>
              </div>
              <div class="text-right">
                <span class="text-[11px] font-semibold text-outline uppercase tracking-wider">Adherence</span>
                <p class="font-bold text-[24px] text-secondary mt-0.5" style="font-family:Manrope;">
                  {{ adherencePct(s.focusHours) }}%
                </p>
              </div>
            </div>

            <!-- Bar chart -->
            <div class="flex items-end justify-between h-32 w-full gap-2">
              <div *ngFor="let bar of weekBars" class="flex flex-col items-center flex-1 gap-1">
                <div class="w-full rounded-t h-full relative" style="background:rgba(94,67,251,0.15);">
                  <div class="absolute bottom-0 w-full rounded-t transition-all duration-500"
                       [style.height.%]="bar.pct"
                       style="background:#451de3;">
                  </div>
                </div>
                <span class="font-semibold uppercase"
                      style="font-size:8px; color:#787588; letter-spacing:0.05em;">
                  {{ bar.label }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- 5. Collaboration Sync -->
        <section class="space-y-stack-md">
          <h3 class="font-bold text-[24px] text-on-surface px-1" style="font-family:Manrope;">Collaboration Sync</h3>
          <div class="grid grid-cols-2 gap-gutter">
            <div class="bg-surface-container-lowest p-stack-md rounded-xl shadow-sm border border-surface-container">
              <span class="material-symbols-outlined text-primary mb-2 block">person</span>
              <p class="text-[11px] font-semibold text-outline uppercase tracking-wider">Personal</p>
              <p class="font-bold text-[24px] text-on-surface mt-0.5" style="font-family:Manrope;">{{ s.individualSync }}%</p>
              <p class="text-[10px] font-semibold text-green-600 mt-1">Consistency: High</p>
            </div>
            <div class="bg-surface-container-lowest p-stack-md rounded-xl shadow-sm border border-surface-container">
              <span class="material-symbols-outlined text-secondary mb-2 block">groups</span>
              <p class="text-[11px] font-semibold text-outline uppercase tracking-wider">Team</p>
              <p class="font-bold text-[24px] text-on-surface mt-0.5" style="font-family:Manrope;">{{ s.teamSync }}%</p>
              <p class="text-[10px] font-semibold text-yellow-600 mt-1">Consistency: Stable</p>
            </div>
          </div>
        </section>

        <!-- 6. Time Distribution -->
        <section class="space-y-stack-md">
          <h3 class="font-bold text-[24px] text-on-surface px-1" style="font-family:Manrope;">Time Distribution</h3>
          <div class="bg-surface-container-lowest p-stack-md rounded-xl shadow-[0px_8px_24px_rgba(94,67,251,0.04)] flex items-center gap-6">

            <!-- Pie chart ring -->
            <div class="relative w-28 h-28 rounded-full flex-shrink-0"
                 [style.background]="pieChartStyle(s.timeDistribution)">
              <div class="absolute inset-4 bg-white rounded-full flex items-center justify-center">
                <span class="text-[11px] font-semibold text-outline">Total</span>
              </div>
            </div>

            <!-- Legend -->
            <div class="flex-1 space-y-2">
              <div *ngFor="let block of s.timeDistribution" class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full flex-shrink-0" [style.background]="block.color"></div>
                <span class="text-[12px] font-semibold text-on-surface">
                  {{ block.label }} {{ pct(block.hours, s.timeDistribution) }}%
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- 7. Smart Insights -->
        <section class="space-y-stack-md">
          <h3 class="font-bold text-[24px] text-on-surface px-1 flex items-center gap-2" style="font-family:Manrope;">
            <span class="material-symbols-outlined text-primary" style="font-variation-settings:'FILL' 1;">auto_awesome</span>
            Smart Insights
          </h3>
          <div class="space-y-gutter">
            <div *ngFor="let tip of smartInsights"
                 class="p-stack-md rounded-xl border flex gap-4"
                 [style.background]="tip.color"
                 [style.borderColor]="tip.border">
              <span class="material-symbols-outlined flex-shrink-0" [style.color]="tip.iconColor">
                {{ tip.icon }}
              </span>
              <div>
                <p class="font-semibold text-[18px] text-on-surface">{{ tip.title }}</p>
                <p class="text-[16px] text-on-surface-variant mt-1">{{ tip.body }}</p>
              </div>
            </div>
          </div>
        </section>

      </ng-container>

      <!-- FAB -->
      <button (click)="openNewTask()"
              class="fixed right-6 bottom-28 w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center z-[9999] active:scale-90 transition-transform"
              style="background:linear-gradient(135deg,#451de3,#00c1fd);">
        <span class="material-symbols-outlined" style="font-variation-settings:'wght' 600;">add</span>
      </button>

    </main>
  `,
})
export class InsightsDashboardComponent implements OnInit {
  private insightService = inject(InsightService);
  private router         = inject(Router);

  summary       = this.insightService.summary;
  smartInsights = SMART_INSIGHTS;

  readonly weekBars = [
    { label: 'MON', pct: 70 },
    { label: 'TUE', pct: 85 },
    { label: 'WED', pct: 60 },
    { label: 'THU', pct: 90 },
    { label: 'FRI', pct: 40 },
  ];

  ngOnInit(): void { this.insightService.load(); }

  openNewTask(): void { this.router.navigate(['/new-task']); }

  velocityRingStyle(score: number): string {
    return `radial-gradient(closest-side, white 79%, transparent 80% 100%), conic-gradient(#5e43fb ${score}%, #eeeef0 0)`;
  }

  pieChartStyle(blocks: { hours: number; color: string }[]): string {
    const total = blocks.reduce((s, b) => s + b.hours, 0);
    let cursor = 0;
    const stops = blocks.map(b => {
      const end = cursor + (b.hours / total) * 100;
      const stop = `${b.color} ${cursor.toFixed(1)}% ${end.toFixed(1)}%`;
      cursor = end;
      return stop;
    });
    return `conic-gradient(${stops.join(', ')})`;
  }

  pct(hours: number, blocks: { hours: number }[]): number {
    const total = blocks.reduce((s, b) => s + b.hours, 0);
    return Math.round((hours / total) * 100);
  }

  adherencePct(focusHours: number): number {
    return Math.round((focusHours / 20) * 100);
  }

  trendDelta(rate: number): number {
    return Math.abs(Math.round((rate - 80) / 4));
  }
}
