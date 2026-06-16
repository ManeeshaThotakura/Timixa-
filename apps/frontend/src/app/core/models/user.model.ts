export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: 'admin' | 'member' | 'ADMIN' | 'MEMBER';
  age?: number;
  occupation?: string;
  bedtime?: string;
  wakeTime?: string;
  onboardingComplete: boolean;
}
