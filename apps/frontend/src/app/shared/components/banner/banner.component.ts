import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span class="material-symbols-outlined text-primary">schedule</span>
        <p class="text-sm font-semibold text-on-surface">
          You have <span class="text-primary">{{ count }}</span> unscheduled {{ count === 1 ? 'task' : 'tasks' }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          (click)="action.emit()"
          class="text-xs font-bold text-white bg-primary px-3 py-1.5 rounded-full active:scale-95 transition-transform">
          Schedule Now
        </button>
        <button (click)="dismissed.emit()" class="text-on-surface-variant hover:text-on-surface transition-colors">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </div>
  `,
})
export class BannerComponent {
  @Input() count = 0;
  @Output() dismissed = new EventEmitter<void>();
  @Output() action = new EventEmitter<void>();
}
