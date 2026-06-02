import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Habit, TodayProgress } from '../models/habit.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class HabitService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/habits`;

  private _habits = signal<Habit[]>([]);
  private _loaded = signal(false);
  readonly habits = this._habits.asReadonly();

  readonly todayProgress = computed<TodayProgress>(() => {
    const all = this._habits();
    const completed = all.filter(h => h.currentCount >= h.targetCount).length;
    return {
      totalHabits: all.length,
      completedHabits: completed,
      percentage: all.length ? Math.round((completed / all.length) * 100) : 0,
    };
  });

  load(): void {
    if (this._loaded()) return;
    this._loaded.set(true);
    this.http.get<Habit[]>(this.api).subscribe({
      next: data => this._habits.set(data),
      error: () => this._loaded.set(false),
    });
  }

  refresh(): void {
    this.http.get<Habit[]>(this.api).subscribe(data => this._habits.set(data));
  }

  incrementHabit(id: string): void {
    // Optimistic
    this._habits.update(hs =>
      hs.map(h =>
        h.id === id && h.currentCount < h.targetCount
          ? { ...h, currentCount: h.currentCount + 1 }
          : h,
      ),
    );
    this.http.post<Habit>(`${this.api}/${id}/increment`, {}).subscribe({
      next: updated => this._habits.update(hs => hs.map(h => (h.id === id ? updated : h))),
      error: () => this.refresh(),
    });
  }

  startHabit(id: string): void {
    this.incrementHabit(id);
  }

  addQuickTask(title: string): void {
    this.addTask(title, 'Task', 1, 'time');
  }

  addTask(title: string, category: string, targetCount: number, unit: string): void {
    this.http
      .post<Habit>(this.api, { title, category, targetCount, unit })
      .subscribe(h => this._habits.update(all => [...all, h]));
  }

  progressPercent(habit: Habit): number {
    return Math.min(100, Math.round((habit.currentCount / habit.targetCount) * 100));
  }
}
