export type PlannedTaskCadence = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type Weekday =
  | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY'
  | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface PlannedTask {
  id: string;
  userId: string;
  title: string;
  goal?: string;
  color: string;
  cadence: PlannedTaskCadence;
  needsTimeSlot: boolean;
  startTime?: string;
  endTime?: string;
  scheduledDate?: string;
  weekdays?: Weekday[];
  monthDays?: number[];
  completedToday: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlannedTaskInput {
  title: string;
  goal?: string;
  color?: string;
  cadence: PlannedTaskCadence;
  needsTimeSlot?: boolean;
  startTime?: string;
  endTime?: string;
  scheduledDate?: string;
  weekdays?: Weekday[];
  monthDays?: number[];
}

export type PlannedTaskUpdate = Partial<PlannedTaskInput>;
