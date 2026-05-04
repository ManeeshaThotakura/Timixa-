import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InsightService } from '../../../core/services/insight.service';
import { ProgressBarComponent } from '../../../shared/components/progress-bar/progress-bar.component';

@Component({
  selector: 'app-insights-dashboard',
  standalone: true,
  imports: [CommonModule, ProgressBarComponent],
  template: `
    <div class="px-margin-page pt-stack-md pb-4 space-y-stack-lg">

      <!-- Header -->
      <div>
        <h1 class="font-manrope font-bold text-h1 text-on-surface">Insights</h1>
        <p class="text-on-surface-variant text-sm mt-0.5">Your performance at a glance</p>
      </div>

      <ng-container *ngIf="summary() as s">

        <!-- Score Summary -->
        <section class="bg-surface-container-lowest rounded-[24px] p-6 shadow-card">
          <div class="grid grid-cols-3 gap-4 text-center">
            <div>
              <span class="font-manrope font-bold text-h1 text-primary">{{ s.overallScore }}%</span>
              <p class="font-label-sm text-label-sm text-on-surface-variant mt-1">Overall Score</p>
            </div>
            <div class="border-x border-outline-variant">
              <span class="font-manrope font-bold text-h1 text-on-surface">{{ s.totalHabits }}</span>
              <p class="font-label-sm text-label-sm text-on-surface-variant mt-1">Habits Done</p>
            </div>
            <div>
              <span class="font-manrope font-bold text-h1 text-secondary">{{ s.streak }}</span>
              <p class="font-label-sm text-label-sm text-on-surface-variant mt-1">Day Streak</p>
            </div>
          </div>
          <div class="mt-4 pt-4 border-t border-outline-variant flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-amber-500 filled">timer</span>
              <span class="text-sm text-on-surface font-semibold">{{ s.focusHours }} / 20 hrs focused this week</span>
            </div>
            <span class="font-label-sm text-label-sm text-primary font-bold">70%</span>
          </div>
          <app-progress-bar [value]="(s.focusHours / 20) * 100" class="mt-2 block" />
        </section>

        <!-- Goal Performance -->
        <section>
          <h3 class="font-manrope font-bold text-[18px] text-on-surface mb-stack-md">Goal Performance</h3>
          <div class="flex flex-col gap-3">
            <div *ngFor="let goal of s.goals"
                 class="bg-surface-container-lowest rounded-[16px] p-4 shadow-card">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-sm text-on-surface">{{ goal.goalName }}</span>
                  <span class="font-label-sm text-label-sm text-on-surface-variant">· {{ goal.category }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px]"
                        [class]="goal.trend === 'up' ? 'text-green-500' : goal.trend === 'down' ? 'text-red-500' : 'text-on-surface-variant'">
                    {{ goal.trend === 'up' ? 'trending_up' : goal.trend === 'down' ? 'trending_down' : 'trending_flat' }}
                  </span>
                  <span class="font-bold text-sm"
                        [class]="goal.trend === 'up' ? 'text-green-500' : goal.trend === 'down' ? 'text-red-500' : 'text-on-surface-variant'">
                    {{ goal.completionRate }}%
                  </span>
                </div>
              </div>
              <app-progress-bar
                [value]="goal.completionRate"
                [gradient]="goal.trend === 'up' ? 'linear-gradient(90deg, #451de3, #00c1fd)' : 'linear-gradient(90deg, #ba1a1a, #ff8a80)'"
              />
              <div *ngIf="goal.hoursLogged !== undefined" class="flex justify-between mt-2">
                <span class="text-xs text-on-surface-variant">{{ goal.hoursLogged }} / {{ goal.hoursTarget }} hrs</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Deep Analysis -->
        <section>
          <h3 class="font-manrope font-bold text-[18px] text-on-surface mb-stack-md">Deep Analysis</h3>
          <div class="flex flex-col gap-3">
            <div *ngFor="let item of s.deepAnalysis"
                 class="bg-surface-container-lowest rounded-[16px] p-4 shadow-card flex items-start gap-3">
              <span class="material-symbols-outlined text-[20px] mt-0.5 flex-shrink-0"
                    [class]="item.status === 'verified' ? 'text-green-500' : item.status === 'warning' ? 'text-red-500' : 'text-primary'">
                {{ item.status === 'verified' ? 'verified' : item.status === 'warning' ? 'warning' : 'lightbulb' }}
              </span>
              <div class="flex-1">
                <div class="flex items-center justify-between">
                  <p class="font-semibold text-sm text-on-surface">{{ item.title }}</p>
                  <span *ngIf="item.score" class="font-bold text-sm text-green-500">{{ item.score }}%</span>
                </div>
                <p *ngIf="item.insight" class="text-xs text-on-surface-variant mt-1">{{ item.insight }}</p>
              </div>
            </div>
          </div>
        </section>

        <!-- Discipline / Time -->
        <section>
          <h3 class="font-manrope font-bold text-[18px] text-on-surface mb-stack-md">Time Distribution</h3>
          <div class="bg-surface-container-lowest rounded-[24px] p-6 shadow-card">
            <div class="flex flex-col gap-4">
              <div *ngFor="let block of s.timeDistribution" class="space-y-1.5">
                <div class="flex justify-between text-sm">
                  <span class="font-semibold text-on-surface">{{ block.label }}</span>
                  <span class="text-on-surface-variant">{{ block.hours }} hrs</span>
                </div>
                <div class="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                  <div class="h-full rounded-full" [style.width.%]="(block.hours / 54) * 100" [style.background]="block.color"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Collaboration Sync -->
        <section>
          <h3 class="font-manrope font-bold text-[18px] text-on-surface mb-stack-md">Collaboration Sync</h3>
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-surface-container-lowest rounded-[16px] p-5 shadow-card text-center">
              <span class="material-symbols-outlined text-primary text-[32px] mb-2 block">person</span>
              <p class="font-manrope font-bold text-h2 text-on-surface">{{ s.individualSync }}%</p>
              <p class="font-label-sm text-label-sm text-on-surface-variant mt-1">Individual</p>
              <app-progress-bar [value]="s.individualSync" class="mt-3 block" />
            </div>
            <div class="bg-surface-container-lowest rounded-[16px] p-5 shadow-card text-center">
              <span class="material-symbols-outlined text-secondary text-[32px] mb-2 block">groups</span>
              <p class="font-manrope font-bold text-h2 text-on-surface">{{ s.teamSync }}%</p>
              <p class="font-label-sm text-label-sm text-on-surface-variant mt-1">Team</p>
              <app-progress-bar [value]="s.teamSync" [gradient]="'linear-gradient(90deg, #006688, #00c1fd)'" class="mt-3 block" />
            </div>
          </div>
        </section>

      </ng-container>

      <!-- Loading -->
      <div *ngIf="!summary()" class="flex items-center justify-center py-20">
        <span class="material-symbols-outlined text-primary text-[32px] animate-spin">progress_activity</span>
      </div>
    </div>
  `,
})
export class InsightsDashboardComponent implements OnInit {
  private insightService = inject(InsightService);
  summary = this.insightService.summary;

  ngOnInit(): void {
    this.insightService.load();
  }
}
