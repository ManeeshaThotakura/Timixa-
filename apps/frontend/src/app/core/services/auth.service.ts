import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private _currentUser = signal<User | null>(this.loadFromStorage());
  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this._currentUser() !== null);

  private loadFromStorage(): User | null {
    const stored = localStorage.getItem('timixa_user');
    return stored ? JSON.parse(stored) : null;
  }

  login(email: string, _password: string): void {
    this.http.get<User>('assets/mock/user.json').subscribe(user => {
      const authedUser = { ...user, email };
      localStorage.setItem('timixa_user', JSON.stringify(authedUser));
      localStorage.setItem('timixa_token', 'mock-token');
      this._currentUser.set(authedUser);
      this.router.navigate(['/dashboard']);
    });
  }

  register(name: string, email: string, _password: string): void {
    this.http.get<User>('assets/mock/user.json').subscribe(user => {
      const newUser = { ...user, name, email };
      localStorage.setItem('timixa_user', JSON.stringify(newUser));
      localStorage.setItem('timixa_token', 'mock-token');
      this._currentUser.set(newUser);
      this.router.navigate(['/dashboard']);
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
