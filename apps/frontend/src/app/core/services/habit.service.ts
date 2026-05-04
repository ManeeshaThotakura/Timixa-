import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Habit, TodayProgress } from '../models/habit.model';

@Injectable({ providedIn: 'root' })
export class HabitService {
  private http = inject(HttpClient);

  private _habits = signal<Habit[]>([]);
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
    if (this._habits().length) return;
    this.http.get<Habit[]>('assets/mock/habits.json').subscribe(data => {
      this._habits.set(data);
    });
  }

  incrementHabit(id: string): void {
    this._habits.update(habits =>
      habits.map(h =>
        h.id === id && h.currentCount < h.targetCount
          ? { ...h, currentCount: h.currentCount + 1 }
          : h
      )
    );
  }

  startHabit(id: string): void {
    this.incrementHabit(id);
  }

  progressPercent(habit: Habit): number {
    return Math.min(100, Math.round((habit.currentCount / habit.targetCount) * 100));
  }
}
