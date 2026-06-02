import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { User } from '../models/user.model';
import { environment } from '../../../environments/environment';

interface AuthResponse {
  token: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private api = `${environment.apiUrl}/auth`;

  private _currentUser = signal<User | null>(this.loadFromStorage());
  private _error = signal<string | null>(null);
  private _busy = signal<boolean>(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly error = this._error.asReadonly();
  readonly busy = this._busy.asReadonly();
  readonly isLoggedIn = computed(() => this._currentUser() !== null);

  private loadFromStorage(): User | null {
    const stored = localStorage.getItem('timixa_user');
    return stored ? JSON.parse(stored) : null;
  }

  private persist(token: string, user: User): void {
    localStorage.setItem('timixa_token', token);
    localStorage.setItem('timixa_user', JSON.stringify(user));
    this._currentUser.set(user);
  }

  login(email: string, password: string): void {
    this._error.set(null);
    this._busy.set(true);
    this.http.post<AuthResponse>(`${this.api}/login`, { email, password }).subscribe({
      next: ({ token, user }) => {
        this.persist(token, user);
        this._busy.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: err => {
        this._busy.set(false);
        this._error.set(err.error?.error || 'Login failed');
      },
    });
  }

  register(name: string, email: string, password: string): void {
    this._error.set(null);
    this._busy.set(true);
    this.http
      .post<AuthResponse>(`${this.api}/register`, { name, email, password })
      .subscribe({
        next: ({ token, user }) => {
          this.persist(token, user);
          this._busy.set(false);
          this.router.navigate(['/dashboard']);
        },
        error: err => {
          this._busy.set(false);
          this._error.set(err.error?.error || 'Registration failed');
        },
      });
  }

  logout(): void {
    localStorage.removeItem('timixa_user');
    localStorage.removeItem('timixa_token');
    this._currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  hasToken(): boolean {
    return !!localStorage.getItem('timixa_token');
  }
}
