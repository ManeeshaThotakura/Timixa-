import { PlannedTask } from './planned-task.model';

export interface StreakInfo {
  taskId: string;
  title: string;
  length: number;
}

export interface TomorrowSummary {
  date: string;
  unscheduledCount: number;
  overlapConflictCount: number;
}

export interface BedtimeSummary {
  date: string;
  pendingToday: PlannedTask[];
  topStreak?: StreakInfo;
  topMissedStreak?: StreakInfo;
  tomorrow: TomorrowSummary;
}
