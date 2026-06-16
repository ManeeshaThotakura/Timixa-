import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, Observable, map, tap } from 'rxjs';
import { User } from '../models/user.model';
import { environment } from '../../../environments/environment';

interface AuthResponse { token: string; user: User; }

export interface RegisterPayload { name: string; email: string; password: string; }
export interface LoginPayload    { email: string; password: string; }
export interface OnboardingPayload { age: number; occupation: string; bedtime: string; wakeTime: string; }

const TOKEN_KEY = 'timixa_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private api = `${environment.apiUrl}/auth`;
  private userApi = `${environment.apiUrl}/users`;

  private _currentUser = signal<User | null>(null);
  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this._currentUser() !== null);

  async bootstrap(): Promise<void> {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    try {
      const user = await firstValueFrom(this.http.get<User>(`${this.api}/me`));
      this._currentUser.set(user);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      this._currentUser.set(null);
    }
  }

  register(payload: RegisterPayload): Observable<User> {
    return this.http.post<AuthResponse>(`${this.api}/register`, payload).pipe(
      tap(({ token, user }) => { localStorage.setItem(TOKEN_KEY, token); this._currentUser.set(user); }),
      map(({ user }) => user),
    );
  }

  login(payload: LoginPayload): Observable<User> {
    return this.http.post<AuthResponse>(`${this.api}/login`, payload).pipe(
      tap(({ token, user }) => { localStorage.setItem(TOKEN_KEY, token); this._currentUser.set(user); }),
      map(({ user }) => user),
    );
  }

  completeOnboarding(payload: OnboardingPayload): Observable<User> {
    return this.http
      .patch<User>(`${this.userApi}/me/onboarding`, payload)
      .pipe(tap(user => this._currentUser.set(user)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this._currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  hasToken(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  }
}
