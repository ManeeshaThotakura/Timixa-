import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center
                px-6 pb-8 pt-4 glass-nav rounded-t-[32px]
                shadow-[0px_-10px_30px_rgba(0,0,0,0.03)]">
      <button
        *ngFor="let item of navItems"
        (click)="navigate(item.route)"
        class="flex flex-col items-center gap-1 min-w-[56px] relative
               active:scale-90 transition-transform duration-200">

        <div class="w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200"
             [class]="isActive(item.route) ? 'bg-primary/10' : ''">
          <span class="material-symbols-outlined text-[24px] transition-all duration-200"
                [class]="isActive(item.route) ? 'text-primary filled' : 'text-on-surface-variant'">
            {{ item.icon }}
          </span>
        </div>

        <span class="font-label-sm text-[10px] transition-colors duration-200"
              [class]="isActive(item.route) ? 'text-primary font-bold' : 'text-on-surface-variant'">
          {{ item.label }}
        </span>

        <span *ngIf="isActive(item.route)"
              class="absolute -bottom-1 w-1 h-1 rounded-full bg-primary"></span>
      </button>
    </nav>
  `,
})
export class BottomNavComponent {
  private router = inject(Router);

  navItems: NavItem[] = [
    { label: 'Home', icon: 'home', route: '/dashboard' },
    { label: 'Projects', icon: 'rocket_launch', route: '/projects' },
    { label: 'Calendar', icon: 'calendar_today', route: '/schedule/calendar' },
    { label: 'Insights', icon: 'insights', route: '/insights' },
  ];

  navigate(route: string): void {
    this.router.navigate([route]);
  }

  isActive(route: string): boolean {
    return this.router.url.startsWith(route);
  }
}
