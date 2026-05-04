export interface Habit {
  id: string;
  title: string;
  category: string;
  icon: string;
  targetCount: number;
  currentCount: number;
  unit: string;
  goalId: string;
  streak: number;
  color: string;
}

export interface TodayProgress {
  totalHabits: number;
  completedHabits: number;
  percentage: number;
}
