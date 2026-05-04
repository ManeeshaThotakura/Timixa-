import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ReminderService } from '../../../core/services/reminder.service';

@Component({
  selector: 'app-top-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="flex justify-between items-center px-6 py-4 w-full sticky top-0 z-50
                   bg-white/80 backdrop-blur-xl shadow-card border-none">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-container/20 bg-surface-container flex items-center justify-center">
          <span class="material-symbols-outlined text-primary text-[20px]">person</span>
        </div>
        <span class="text-lg font-extrabold text-on-surface font-manrope tracking-tight">{{ title }}</span>
      </div>

      <div class="flex items-center gap-1">
        <button
          (click)="goToReminders()"
          class="w-10 h-10 flex items-center justify-center rounded-full text-primary
                 hover:bg-surface-container-low active:scale-95 transition-all duration-200 relative">
          <span class="material-symbols-outlined">notifications</span>
          <span *ngIf="reminderCount() > 0"
                class="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px]
                       font-bold rounded-full flex items-center justify-center">
            {{ reminderCount() }}
          </span>
        </button>
      </div>
    </header>
  `,
})
export class TopHeaderComponent {
  @Input() title = 'Timixa';

  private router = inject(Router);
  private reminders = inject(ReminderService);

  reminderCount = this.reminders.activeCount;

  goToReminders(): void {
    this.router.navigate(['/reminders']);
  }
}
