import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-surface-container-lowest rounded-[24px] p-6 shadow-card flex flex-col justify-between min-h-[120px]">
      <div class="flex justify-between items-start">
        <div class="w-10 h-10 rounded-full flex items-center justify-center"
             [style.background]="iconBg">
          <span class="material-symbols-outlined text-[20px]" [style.color]="iconColor">{{ icon }}</span>
        </div>
        <span *ngIf="trend" class="text-xs font-semibold px-2 py-1 rounded-full"
              [class]="trend === 'up' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'">
          {{ trend === 'up' ? '↑' : '↓' }} {{ trendLabel }}
        </span>
      </div>
      <div>
        <p class="font-manrope font-bold text-h2 text-on-surface">{{ value }}</p>
        <p class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mt-1">{{ label }}</p>
      </div>
    </div>
  `,
})
export class StatCardComponent {
  @Input() icon = '';
  @Input() value: string | number = '';
  @Input() label = '';
  @Input() iconBg = 'rgba(69,29,227,0.1)';
  @Input() iconColor = '#451de3';
  @Input() trend?: 'up' | 'down';
  @Input() trendLabel = '';
}
