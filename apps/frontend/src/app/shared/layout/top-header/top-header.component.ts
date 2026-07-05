import { Component, ElementRef, HostListener, Input, inject, signal } from '@angular/core';
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

        <!-- Profile menu -->
        <div class="relative">
          <button type="button"
                  (click)="toggleMenu()"
                  data-testid="profile-button"
                  class="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-container/20 bg-surface-container flex items-center justify-center hover:border-primary/40 active:scale-95 transition-all duration-200">
            <span class="material-symbols-outlined text-primary text-[20px]">person</span>
          </button>

          <div *ngIf="menuOpen()"
               data-testid="profile-menu"
               class="absolute right-0 top-12 min-w-[220px] bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden"
               style="box-shadow:0 12px 32px rgba(0,0,0,0.12);">
            <div *ngIf="user() as u" class="px-4 py-3 border-b border-outline-variant/20">
              <p class="text-[14px] font-semibold text-on-surface truncate">{{ u.name }}</p>
              <p class="text-[11px] text-on-surface-variant truncate">{{ u.email }}</p>
            </div>
            <button type="button"
                    (click)="logout()"
                    data-testid="profile-logout"
                    class="w-full flex items-center gap-2 px-4 py-3 text-[13px] font-semibold text-left hover:bg-surface-container-low transition-colors"
                    style="color:#ba1a1a;">
              <span class="material-symbols-outlined text-[18px]">logout</span>
              Log out
            </button>
          </div>
        </div>
      </div>
    </header>
  `,
})
export class TopHeaderComponent {
  @Input() title = 'Timixa';

  private router = inject(Router);
  private reminders = inject(ReminderService);
  private auth = inject(AuthService);
  private host = inject(ElementRef);

  reminderCount = this.reminders.activeCount;
  user = this.auth.currentUser;
  menuOpen = signal(false);

  goToReminders(): void {
    this.menuOpen.set(false);
    this.router.navigate(['/reminders']);
  }

  toggleMenu(): void {
    this.menuOpen.set(!this.menuOpen());
  }

  logout(): void {
    this.menuOpen.set(false);
    this.auth.logout();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.menuOpen()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.menuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.menuOpen()) this.menuOpen.set(false);
  }
}
