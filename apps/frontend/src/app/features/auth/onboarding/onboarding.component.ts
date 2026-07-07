import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div class="w-full max-w-sm">
        <div class="flex flex-col items-center mb-10">
          <div class="w-16 h-16 rounded-[20px] flex items-center justify-center mb-4"
               style="background: linear-gradient(135deg, #451de3, #00c1fd)">
            <span class="material-symbols-outlined text-white text-[32px]">person</span>
          </div>
          <h1 class="font-manrope font-bold text-h1 text-on-surface tracking-tight">Tell us about yourself</h1>
          <p class="text-on-surface-variant text-sm mt-1 text-center">A few quick questions so we can plan your day</p>
        </div>

        <form #f="ngForm" (ngSubmit)="submit(f)" class="bg-surface-container-lowest rounded-[28px] p-8 shadow-card">
          <div class="space-y-4">
            <div>
              <label class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2 block">Age</label>
              <input type="number" name="age" [(ngModel)]="form.age" required min="13" max="120"
                     class="input-ghost" data-testid="onboarding-age" />
            </div>
            <div>
              <label class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2 block">Occupation</label>
              <input type="text" name="occupation" [(ngModel)]="form.occupation" required maxlength="80"
                     class="input-ghost" data-testid="onboarding-occupation" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2 block">Bedtime</label>
                <input type="time" name="bedtime" [(ngModel)]="form.bedtime" required
                       class="input-ghost" data-testid="onboarding-bedtime" />
              </div>
              <div>
                <label class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2 block">Wake time</label>
                <input type="time" name="wakeTime" [(ngModel)]="form.wakeTime" required
                       class="input-ghost" data-testid="onboarding-waketime" />
              </div>
            </div>
          </div>

          <p *ngIf="errorMsg()" class="text-red-500 text-sm mt-4" data-testid="onboarding-error">{{ errorMsg() }}</p>

          <button type="submit" [disabled]="f.invalid || busy()"
                  class="btn-primary w-full mt-6 flex items-center justify-center gap-2"
                  data-testid="onboarding-submit">
            <span *ngIf="busy()" class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
            <span>{{ busy() ? 'Saving...' : 'Continue' }}</span>
          </button>
        </form>
      </div>
    </div>
  `,
})
export class OnboardingComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  form = { age: null as number | null, occupation: '', bedtime: '', wakeTime: '' };
  busy = signal(false);
  errorMsg = signal<string | null>(null);

  submit(f: NgForm) {
    if (f.invalid || this.form.age == null) return;
    this.busy.set(true);
    this.errorMsg.set(null);
    this.auth.completeOnboarding({
      age: this.form.age,
      occupation: this.form.occupation,
      bedtime: this.form.bedtime,
      wakeTime: this.form.wakeTime,
    }).subscribe({
      next: () => {
        this.busy.set(false);
        this.suppressBedtimePromptToday();
        this.router.navigateByUrl('/dashboard');
      },
      error: (err) => {
        this.busy.set(false);
        if (err?.error?.code === 'ONBOARDING_ALREADY_COMPLETE') {
          this.router.navigateByUrl('/dashboard');
          return;
        }
        this.errorMsg.set(err?.error?.message || 'Could not save your profile. Please try again.');
      },
    });
  }

  private suppressBedtimePromptToday(): void {
    if (typeof sessionStorage === 'undefined') return;
    const d = new Date();
    const key = `timixa.bedtimePrompt.${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    sessionStorage.setItem(key, '1');
  }
}
