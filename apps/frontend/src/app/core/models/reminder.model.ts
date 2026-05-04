export interface Reminder {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'smart' | 'manual';
  relatedHabitId?: string;
  relatedTaskId?: string;
  dismissed: boolean;
  icon: string;
  iconColor: string;
}
