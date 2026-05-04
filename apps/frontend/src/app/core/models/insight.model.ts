export interface GoalPerformance {
  goalName: string;
  category: string;
  completionRate: number;
  trend: 'up' | 'down' | 'flat';
  hoursLogged?: number;
  hoursTarget?: number;
}

export interface DeepAnalysis {
  title: string;
  status: 'verified' | 'warning' | 'info';
  score?: number;
  insight?: string;
}

export interface InsightSummary {
  overallScore: number;
  streak: number;
  focusHours: number;
  totalHabits: number;
  goals: GoalPerformance[];
  deepAnalysis: DeepAnalysis[];
  timeDistribution: TimeBlock[];
  individualSync: number;
  teamSync: number;
}

export interface TimeBlock {
  label: string;
  hours: number;
  color: string;
}
