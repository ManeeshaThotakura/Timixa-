import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ReminderService } from '../../../core/services/reminder.service';

@Component({
  selector: 'app-smart-reminders',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="px-margin-page pt-stack-md pb-4">

      <!-- Header with Back -->
      <div class="flex items-center gap-3 mb-stack-lg">
        <button (click)="goBack()"
                class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 class="font-manrope font-bold text-h2 text-on-surface">Reminders</h1>
          <p class="text-on-surface-variant text-xs mt-0.5">{{ activeCount() }} active</p>
        </div>
      </div>

      <!-- Smart Reminders -->
      <div class="mb-stack-lg">
        <div class="flex items-center gap-2 mb-3">
          <span class="material-symbols-outlined text-primary text-[18px]">auto_awesome</span>
          <h3 class="font-manrope font-bold text-[16px] text-on-surface">Smart Reminders</h3>
        </div>
        <div class="flex flex-col gap-3">
          <ng-container *ngFor="let r of smartReminders">
            <div *ngIf="!r.dismissed"
                 class="bg-surface-container-lowest rounded-[16px] p-4 shadow-card flex items-start gap-4 transition-all"
                 [class.opacity-50]="r.dismissed">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                   [style.background]="r.iconColor + '20'">
                <span class="material-symbols-outlined text-[20px]" [style.color]="r.iconColor">{{ r.icon }}</span>
              </div>
              <div class="flex-1">
                <h4 class="font-manrope font-semibold text-sm text-on-surface">{{ r.title }}</h4>
                <p class="text-on-surface-variant text-xs mt-0.5">{{ r.description }}</p>
                <div class="flex items-center gap-1 mt-1.5">
                  <span class="material-symbols-outlined text-[12px] text-on-surface-variant">schedule</span>
                  <span class="font-label-sm text-[11px] text-on-surface-variant">{{ r.time }}</span>
                  <span class="px-1.5 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-semibold ml-1">Smart</span>
                </div>
              </div>
              <div class="flex flex-col gap-2 flex-shrink-0">
                <button (click)="snooze(r.id)"
                        class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors active:scale-90">
                  <span class="material-symbols-outlined text-[16px] text-on-surface-variant">snooze</span>
                </button>
                <button (click)="dismiss(r.id)"
                        class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors active:scale-90">
                  <span class="material-symbols-outlined text-[16px] text-on-surface-variant">close</span>
                </button>
              </div>
            </div>
          </ng-container>
        </div>
      </div>

      <!-- Manual Reminders -->
      <div>
        <div class="flex items-center gap-2 mb-3">
          <span class="material-symbols-outlined text-on-surface-variant text-[18px]">alarm</span>
          <h3 class="font-manrope font-bold text-[16px] text-on-surface">Scheduled</h3>
        </div>
        <div class="flex flex-col gap-3">
          <ng-container *ngFor="let r of manualReminders">
            <div *ngIf="!r.dismissed"
                 class="bg-surface-container-lowest rounded-[16px] p-4 shadow-card flex items-start gap-4">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                   [style.background]="r.iconColor + '20'">
                <span class="material-symbols-outlined text-[20px]" [style.color]="r.iconColor">{{ r.icon }}</span>
              </div>
              <div class="flex-1">
                <h4 class="font-manrope font-semibold text-sm text-on-surface">{{ r.title }}</h4>
                <p class="text-on-surface-variant text-xs mt-0.5">{{ r.description }}</p>
                <div class="flex items-center gap-1 mt-1.5">
                  <span class="material-symbols-outlined text-[12px] text-on-surface-variant">schedule</span>
                  <span class="font-label-sm text-[11px] text-on-surface-variant">{{ r.time }}</span>
                </div>
              </div>
              <button (click)="dismiss(r.id)"
                      class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors active:scale-90">
                <span class="material-symbols-outlined text-[16px] text-on-surface-variant">close</span>
              </button>
            </div>
          </ng-container>
        </div>
      </div>

      <!-- Empty State -->
      <div *ngIf="activeCount() === 0" class="flex flex-col items-center justify-center py-16 gap-4">
        <div class="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
          <span class="material-symbols-outlined text-green-500 text-[32px]">check_circle</span>
        </div>
        <p class="font-manrope font-semibold text-on-surface">All caught up!</p>
        <p class="text-on-surface-variant text-sm text-center">No active reminders. Keep up the great work!</p>
      </div>
    </div>
  `,
})
export class SmartRemindersComponent implements OnInit {
  private reminderService = inject(ReminderService);
  private router = inject(Router);

  reminders = this.reminderService.reminders;
  activeCount = this.reminderService.activeCount;

  get smartReminders() {
    return this.reminders().filter(r => r.type === 'smart');
  }

  get manualReminders() {
    return this.reminders().filter(r => r.type === 'manual');
  }

  ngOnInit(): void {
    this.reminderService.load();
  }

  dismiss(id: string): void {
    this.reminderService.dismiss(id);
  }

  snooze(id: string): void {
    this.reminderService.snooze(id);
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
