import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { InsightSummary } from '../models/insight.model';
import { BedtimeSummary } from '../models/bedtime-summary.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class InsightService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/insights`;

  private _summary = signal<InsightSummary | null>(null);
  private _loadedDays = signal<number | null>(null);
  readonly summary = this._summary.asReadonly();

  load(days = 7): void {
    if (this._loadedDays() === days && this._summary() !== null) return;
    this.fetch(days);
  }

  refresh(days = this._loadedDays() ?? 7): void {
    this.fetch(days);
  }

  private fetch(days: number): void {
    this._loadedDays.set(days);
    this.http.get<InsightSummary>(`${this.api}/summary?days=${days}`).subscribe({
      next: data => this._summary.set(data),
      error: () => this._loadedDays.set(null),
    });
  }

  bedtimeSummary(date?: string): Observable<BedtimeSummary> {
    const url = date ? `${this.api}/bedtime?date=${date}` : `${this.api}/bedtime`;
    return this.http.get<BedtimeSummary>(url);
  }
}
