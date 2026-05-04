import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="min-h-screen bg-background flex flex-col items-center justify-center px-6">

      <div class="w-full max-w-sm">
        <!-- Logo -->
        <div class="flex flex-col items-center mb-10">
          <div class="w-16 h-16 rounded-[20px] flex items-center justify-center mb-4"
               style="background: linear-gradient(135deg, #451de3, #00c1fd)">
            <span class="material-symbols-outlined text-white text-[32px]">bolt</span>
          </div>
          <h1 class="font-manrope font-bold text-h1 text-on-surface tracking-tight">Timixa</h1>
          <p class="text-on-surface-variant text-sm mt-1">Your intelligent productivity companion</p>
        </div>

        <!-- Card -->
        <div class="bg-surface-container-lowest rounded-[28px] p-8 shadow-card">
          <h2 class="font-manrope font-bold text-h2 text-on-surface mb-1">Welcome back</h2>
          <p class="text-on-surface-variant text-sm mb-6">Sign in to continue your progress</p>

          <div class="space-y-4">
            <div>
              <label class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2 block">Email</label>
              <input
                type="email"
                [(ngModel)]="email"
                placeholder="you@example.com"
                class="input-ghost" />
            </div>

            <div>
              <label class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2 block">Password</label>
              <input
                type="password"
                [(ngModel)]="password"
                placeholder="••••••••"
                class="input-ghost" />
            </div>
          </div>

          <button
            (click)="login()"
            [disabled]="loading"
            class="btn-primary w-full mt-6 flex items-center justify-center gap-2">
            <span *ngIf="loading" class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
            <span>{{ loading ? 'Signing in...' : 'Sign In' }}</span>
          </button>
        </div>

        <p class="text-center text-sm text-on-surface-variant mt-6">
          Don't have an account?
          <a routerLink="/auth/register" class="text-primary font-semibold ml-1">Sign up</a>
        </p>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);

  email = '';
  password = '';
  loading = false;

  login(): void {
    if (!this.email || !this.password) return;
    this.loading = true;
    setTimeout(() => {
      this.auth.login(this.email, this.password);
      this.loading = false;
    }, 600);
  }
}
