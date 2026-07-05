export interface DaySummary {
  date: string;        // YYYY-MM-DD
  applicable: number;
  completed: number;
  percent: number;
}

export interface GoalSummary {
  goalName: string;
  completionRate: number;
  trend: 'up' | 'down' | 'flat';
}

export interface TimeBlock {
  label: string;
  hours: number;
  color: string;
}

export interface StreakInfo {
  taskId: string;
  title: string;
  length: number;
}

export interface TimeOfDayPerformance {
  label: string;
  percent: number;
}

export interface InsightSummary {
  windowDays: number;
  disciplinePercent: number;
  adherencePercent: number;
  topStreak?: StreakInfo;
  days: DaySummary[];
  goals: GoalSummary[];
  timeDistribution: TimeBlock[];
  bestTime?: TimeOfDayPerformance;
  worstTime?: TimeOfDayPerformance;
}
