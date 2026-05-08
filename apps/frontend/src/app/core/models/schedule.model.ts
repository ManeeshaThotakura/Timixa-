export interface ScheduledEvent {
  id: string;
  title: string;
  type: 'task' | 'habit' | 'meeting';
  date: string;
  startTime: string;
  endTime: string;
  color: string;
  sourceTaskId?: string;
}

export interface Meeting {
  id: string;
  projectId: string;
  title: string;
  participants: string[];
  date: string;
  startTime: string;
  endTime: string;
  location: string;
}

export interface UnscheduledTask {
  id: string;
  title: string;
  projectId: string;
  dueDate: string;
  durationMinutes: number;
  remainingMinutes: number;
}
