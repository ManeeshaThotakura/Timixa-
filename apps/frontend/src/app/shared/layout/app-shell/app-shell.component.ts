import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopHeaderComponent } from '../top-header/top-header.component';
import { BottomNavComponent } from '../bottom-nav/bottom-nav.component';
import { HabitService } from '../../../core/services/habit.service';
import { ProjectService } from '../../../core/services/project.service';
import { ScheduleService } from '../../../core/services/schedule.service';
import { InsightService } from '../../../core/services/insight.service';
import { ReminderService } from '../../../core/services/reminder.service';
import { NotificationSchedulerService } from '../../../core/services/notification-scheduler.service';
import { routeAnimations } from '../../animations/route.animations';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, TopHeaderComponent, BottomNavComponent],
  animations: [routeAnimations],
  template: `
    <div class="min-h-screen bg-background flex flex-col">
      <app-top-header title="Timixa" />
      <main class="flex-1 pb-32 overflow-y-auto relative">
        <router-outlet #outlet="outlet" />
      </main>
      <app-bottom-nav />
    </div>
  `,
})
export class AppShellComponent implements OnInit {
  private habits = inject(HabitService);
  private projects = inject(ProjectService);
  private schedule = inject(ScheduleService);
  private insights = inject(InsightService);
  private reminders = inject(ReminderService);
  private notifications = inject(NotificationSchedulerService);

  ngOnInit(): void {
    this.habits.load();
    this.projects.load();
    this.schedule.load();
    this.insights.load();
    this.reminders.load();
    this.notifications.start();
  }
}
