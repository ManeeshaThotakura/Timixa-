export type PlannedTaskCadence = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type Weekday =
  | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY'
  | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export type ExceptionType = 'SKIP' | 'ADD';

export interface PlannedTaskException {
  date: string;            // YYYY-MM-DD
  type: ExceptionType;
}

export interface PlannedTaskSegment {
  id: string;
  date: string;            // YYYY-MM-DD
  startTime: string;       // HH:mm
  endTime: string;         // HH:mm
}

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
  minTimeMinutes?: number;
  maxTimeMinutes?: number;
  minCount?: number;
  maxCount?: number;
  exceptions: PlannedTaskException[];
  segmentsForDate?: PlannedTaskSegment[];   // present on date-scoped GET responses
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
  minTimeMinutes?: number | null;
  maxTimeMinutes?: number | null;
  minCount?: number | null;
  maxCount?: number | null;
}

export type PlannedTaskUpdate = Partial<PlannedTaskInput>;
