import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { InsightSummary } from '../models/insight.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class InsightService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/insights`;

  private _summary = signal<InsightSummary | null>(null);
  private _loaded = signal(false);
  readonly summary = this._summary.asReadonly();

  load(): void {
    if (this._loaded()) return;
    this._loaded.set(true);
    this.http.get<InsightSummary>(`${this.api}/summary`).subscribe({
      next: data => this._summary.set(data),
      error: () => this._loaded.set(false),
    });
  }

  refresh(): void {
    this.http.get<InsightSummary>(`${this.api}/summary`).subscribe(d => this._summary.set(d));
  }

  getWeeklyStats(): { label: string; value: number }[] {
    const summary = this._summary();
    if (!summary || summary.goals.length === 0) return [];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const avg = summary.goals.reduce((acc, g) => acc + g.completionRate, 0) / summary.goals.length;
    return days.map((label, i) => ({
      label,
      value: Math.round(avg * (0.7 + (i % 3) * 0.15)),
    }));
  }
}
