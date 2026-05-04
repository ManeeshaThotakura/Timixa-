import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { InsightSummary } from '../models/insight.model';

@Injectable({ providedIn: 'root' })
export class InsightService {
  private http = inject(HttpClient);

  private _summary = signal<InsightSummary | null>(null);
  readonly summary = this._summary.asReadonly();

  load(): void {
    if (this._summary()) return;
    this.http.get<InsightSummary>('assets/mock/insights.json').subscribe(data => {
      this._summary.set(data);
    });
  }

  getWeeklyStats(): { label: string; value: number }[] {
    const summary = this._summary();
    if (!summary) return [];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((label, i) => ({
      label,
      value: Math.round(summary.goals.reduce((acc, g) => acc + g.completionRate, 0) / summary.goals.length * (0.7 + (i % 3) * 0.15)),
    }));
  }
}
