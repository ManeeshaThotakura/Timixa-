import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ScheduleService } from '../../../core/services/schedule.service';
import { ProjectService } from '../../../core/services/project.service';
import { Meeting } from '../../../core/models/schedule.model';

const MOCK_USERS = ['Alex Carter', 'Sarah Kim', 'Jordan Lee', 'Morgan Blake', 'Taylor Reed'];

@Component({
  selector: 'app-meeting-scheduler',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="px-margin-page pt-stack-md pb-4">

      <!-- Header -->
      <div class="flex items-center gap-3 mb-stack-lg">
        <button (click)="goBack()"
                class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 class="font-manrope font-bold text-h2 text-on-surface">Schedule Meeting</h1>
          <p class="text-on-surface-variant text-xs mt-0.5">{{ project?.title }}</p>
        </div>
      </div>

      <!-- Form Card -->
      <div class="bg-surface-container-lowest rounded-[24px] p-6 shadow-card space-y-5">

        <!-- Title -->
        <div>
          <label class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2 block">Meeting Title</label>
          <input type="text" [(ngModel)]="form.title" placeholder="e.g. Sprint Planning" class="input-ghost" />
        </div>

        <!-- Date -->
        <div>
          <label class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2 block">Date</label>
          <input type="date" [(ngModel)]="form.date" class="input-ghost" />
        </div>

        <!-- Time Range -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2 block">Start Time</label>
            <input type="time" [(ngModel)]="form.startTime" class="input-ghost" />
          </div>
          <div>
            <label class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2 block">End Time</label>
            <input type="time" [(ngModel)]="form.endTime" class="input-ghost" />
          </div>
        </div>

        <!-- Location -->
        <div>
          <label class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2 block">Location</label>
          <input type="text" [(ngModel)]="form.location" placeholder="e.g. Zoom, Conference Room A" class="input-ghost" />
        </div>

        <!-- Participants -->
        <div>
          <label class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2 block">Participants</label>
          <div class="flex flex-wrap gap-2">
            <button *ngFor="let user of availableUsers"
                    (click)="toggleParticipant(user)"
                    class="px-3 py-1.5 rounded-full text-sm font-semibold transition-all"
                    [class]="isSelected(user)
                      ? 'bg-primary text-white'
                      : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'">
              {{ user }}
            </button>
          </div>
        </div>

        <!-- Submit -->
        <button (click)="submit()" [disabled]="!isValid || submitted"
                class="btn-primary w-full flex items-center justify-center gap-2 mt-2">
          <span class="material-symbols-outlined text-[18px]">event</span>
          <span>{{ submitted ? 'Meeting Scheduled!' : 'Schedule Meeting' }}</span>
        </button>
      </div>

      <!-- Existing Meetings -->
      <div *ngIf="existingMeetings.length > 0" class="mt-stack-lg">
        <h3 class="font-manrope font-bold text-[18px] text-on-surface mb-stack-md">Upcoming Meetings</h3>
        <div class="flex flex-col gap-3">
          <div *ngFor="let m of existingMeetings"
               class="bg-surface-container-lowest rounded-[16px] p-4 shadow-card flex items-start gap-4">
            <div class="w-10 h-10 rounded-xl bg-secondary-fixed/30 flex items-center justify-center">
              <span class="material-symbols-outlined text-secondary">video_call</span>
            </div>
            <div class="flex-1">
              <h4 class="font-manrope font-semibold text-sm text-on-surface">{{ m.title }}</h4>
              <p class="text-on-surface-variant text-xs mt-0.5">
                {{ m.date | date:'MMM d, y' }} · {{ m.startTime }} – {{ m.endTime }}
              </p>
              <p class="text-on-surface-variant text-xs">{{ m.location }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class MeetingSchedulerComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private scheduleService = inject(ScheduleService);
  private projectService = inject(ProjectService);

  projectId = '';
  availableUsers = MOCK_USERS;
  submitted = false;

  form = {
    title: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '11:00',
    location: '',
    participants: [] as string[],
  };

  get project() {
    return this.projectService.getProjectById(this.projectId);
  }

  get existingMeetings() {
    return this.scheduleService.getMeetingsByProject(this.projectId);
  }

  get isValid(): boolean {
    return !!(this.form.title && this.form.date && this.form.startTime && this.form.endTime);
  }

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id') || '';
    this.scheduleService.load();
    this.projectService.load();
  }

  toggleParticipant(user: string): void {
    const idx = this.form.participants.indexOf(user);
    if (idx >= 0) {
      this.form.participants.splice(idx, 1);
    } else {
      this.form.participants.push(user);
    }
  }

  isSelected(user: string): boolean {
    return this.form.participants.includes(user);
  }

  submit(): void {
    if (!this.isValid) return;
    const meeting: Meeting = {
      id: 'm-' + Date.now(),
      projectId: this.projectId,
      title: this.form.title,
      participants: [...this.form.participants],
      date: this.form.date,
      startTime: this.form.startTime,
      endTime: this.form.endTime,
      location: this.form.location || 'TBD',
    };
    this.scheduleService.addMeeting(meeting);
    this.submitted = true;
    setTimeout(() => this.goBack(), 1500);
  }

  goBack(): void {
    this.router.navigate(['/projects', this.projectId, 'board']);
  }
}
