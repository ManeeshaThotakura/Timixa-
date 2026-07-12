import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PlannedTaskService } from '../../core/services/planned-task.service';
import {
  PlannedTask,
  PlannedTaskCadence,
  PlannedTaskInput,
  Weekday,
} from '../../core/models/planned-task.model';
import { SchedulePickerComponent } from '../../shared/components/schedule-picker/schedule-picker.component';
import { ScheduleConfig, defaultScheduleConfig } from '../../core/models/schedule-config.model';

const GOAL_ICONS: Record<string, string> = {
  Fitness: '🏃‍♂️', Learning: '📚', Health: '🧘‍♀️',
  Work: '💼', Mindfulness: '🧠', Social: '🤝',
};

@Component({
  selector: 'app-new-task',
  standalone: true,
  imports: [CommonModule, FormsModule, SchedulePickerComponent],
  template: `
    <!-- Header -->
    <header class="bg-white/80 backdrop-blur-xl flex justify-between items-center px-6 py-4 w-full sticky top-0 z-50 shadow-[0px_8px_24px_rgba(94,67,251,0.04)]">
      <div class="flex items-center gap-4">
        <button (click)="goBack()"
                class="p-2 -ml-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors active:scale-95 duration-200">
          <span class="material-symbols-outlined text-[24px]">close</span>
        </button>
        <h1 class="text-lg font-extrabold text-on-surface" style="font-family:Manrope;">{{ editingTaskId() ? 'Edit Task' : 'New Task' }}</h1>
      </div>
      <button (click)="createTask()"
              [disabled]="!taskName().trim() || saving()"
              class="font-semibold text-sm transition-colors"
              [style.color]="taskName().trim() ? '#451de3' : '#9aa0a6'"
              style="font-family:Manrope;"
              data-testid="new-task-save">
        Save
      </button>
    </header>

    <main class="px-margin-page pt-stack-md pb-40 space-y-stack-lg">

      <!-- Section 1: Select Goal -->
      <section>
        <div class="flex justify-between items-center mb-stack-sm">
          <span class="font-semibold text-[16px] text-on-surface">Select Goal</span>
          <button (click)="showGoalModal.set(true)"
                  class="flex items-center gap-1 text-primary font-semibold text-label-sm hover:bg-primary/5 px-2 py-1 rounded-lg transition-colors">
            <span class="material-symbols-outlined text-[18px]">add</span>Add
          </button>
        </div>
        <div class="flex gap-2 overflow-x-auto -mx-margin-page px-margin-page py-2"
             style="-ms-overflow-style:none; scrollbar-width:none;">
          <button *ngFor="let g of goals()"
                  (click)="selectedGoal.set(g)"
                  class="flex-none px-4 py-2 rounded-full font-label-sm flex items-center gap-2 transition-all active:scale-95"
                  [style.background]="selectedGoal() === g ? '#e4dfff' : '#f3f3f6'"
                  [style.color]="selectedGoal() === g ? '#451de3' : '#787588'"
                  [style.border]="selectedGoal() === g ? '1px solid rgba(69,29,227,0.2)' : '1px solid rgba(200,196,217,0.3)'">
            {{ goalIcon(g) }} {{ g }}
          </button>
          <button (click)="showGoalModal.set(true)"
                  class="flex-none px-4 py-2 rounded-full font-label-sm flex items-center gap-2 transition-all active:scale-95 hover:bg-surface-container-high"
                  style="color:#5e43fb; border:1.5px dashed rgba(94,67,251,0.4);">
            <span class="material-symbols-outlined text-[16px]">add</span>New Goal
          </button>
        </div>
      </section>

      <!-- Section 2: Task Name -->
      <section>
        <label class="block font-label-sm text-outline mb-1 ml-1">Task Name</label>
        <input autofocus
               type="text"
               [value]="taskName()"
               (input)="taskName.set($any($event.target).value)"
               placeholder="e.g., Study, Exercise"
               class="w-full bg-surface-container-low border-none focus:ring-0 py-3 px-3 rounded-lg transition-all text-[24px] font-bold text-on-surface placeholder:text-outline/50 outline-none"
               style="font-family:Manrope;" />
      </section>

      <!-- Section 3: Constraints (optional) -->
      <section class="space-y-stack-sm" data-testid="constraints-section">
        <h2 class="font-semibold text-[16px] text-on-surface">Constraints <span class="text-outline font-normal">(optional)</span></h2>

        <div class="bg-surface-container-lowest rounded-[20px] border border-outline-variant/20 shadow-sm p-4" data-testid="time-card">
          <label class="flex items-center justify-between cursor-pointer">
            <span class="font-semibold text-[15px] text-on-surface">Time</span>
            <div class="relative inline-flex items-center">
              <input type="checkbox" class="sr-only peer"
                     [checked]="timeConstraintEnabled()"
                     (change)="timeConstraintEnabled.set($any($event.target).checked)"
                     data-testid="time-toggle" />
              <div class="w-11 h-6 bg-surface-container rounded-full peer
                          peer-checked:bg-primary-container
                          after:content-[''] after:absolute after:top-[2px] after:start-[2px]
                          after:bg-white after:border after:border-gray-300 after:rounded-full
                          after:h-5 after:w-5 after:transition-all
                          peer-checked:after:translate-x-full"></div>
            </div>
          </label>
          <div *ngIf="timeConstraintEnabled()" class="mt-3 grid grid-cols-2 gap-2" data-testid="time-fields">
            <input type="number" min="1" placeholder="Min minutes"
                   [value]="minTimeMinutes() ?? ''"
                   (input)="minTimeMinutes.set(parseNum($any($event.target).value))"
                   class="input-ghost" data-testid="time-min" />
            <input type="number" min="1" placeholder="Max minutes"
                   [value]="maxTimeMinutes() ?? ''"
                   (input)="maxTimeMinutes.set(parseNum($any($event.target).value))"
                   class="input-ghost" data-testid="time-max" />
          </div>
          <p *ngIf="timeConstraintEnabled()" class="text-[12px] text-outline mt-2">Either, both, or neither is fine.</p>
        </div>

        <div class="bg-surface-container-lowest rounded-[20px] border border-outline-variant/20 shadow-sm p-4" data-testid="count-card">
          <label class="flex items-center justify-between cursor-pointer">
            <span class="font-semibold text-[15px] text-on-surface">Count</span>
            <div class="relative inline-flex items-center">
              <input type="checkbox" class="sr-only peer"
                     [checked]="countConstraintEnabled()"
                     (change)="countConstraintEnabled.set($any($event.target).checked)"
                     data-testid="count-toggle" />
              <div class="w-11 h-6 bg-surface-container rounded-full peer
                          peer-checked:bg-primary-container
                          after:content-[''] after:absolute after:top-[2px] after:start-[2px]
                          after:bg-white after:border after:border-gray-300 after:rounded-full
                          after:h-5 after:w-5 after:transition-all
                          peer-checked:after:translate-x-full"></div>
            </div>
          </label>
          <div *ngIf="countConstraintEnabled()" class="mt-3 grid grid-cols-2 gap-2" data-testid="count-fields">
            <input type="number" min="1" placeholder="Min count"
                   [value]="minCount() ?? ''"
                   (input)="minCount.set(parseNum($any($event.target).value))"
                   class="input-ghost" data-testid="count-min" />
            <input type="number" min="1" placeholder="Max count"
                   [value]="maxCount() ?? ''"
                   (input)="maxCount.set(parseNum($any($event.target).value))"
                   class="input-ghost" data-testid="count-max" />
          </div>
          <p *ngIf="countConstraintEnabled()" class="text-[12px] text-outline mt-2">Either, both, or neither is fine.</p>
        </div>

        <p *ngIf="constraintError()" class="text-red-500 text-sm" data-testid="constraint-error">{{ constraintError() }}</p>
      </section>

      <!-- Section 4: Needs time slot toggle -->
      <section>
        <div class="bg-surface-container-lowest rounded-[20px] border border-outline-variant/20 shadow-sm p-4">
          <label class="flex items-start justify-between gap-3 cursor-pointer">
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-[16px] text-on-surface">Needs a time slot</p>
              <p class="text-[13px] text-on-surface-variant mt-1 leading-snug">
                {{ needsTimeSlot()
                  ? 'You will pick a time on the schedule page after saving.'
                  : 'All-day task — done any time on its scheduled days.' }}
              </p>
            </div>
            <div class="relative inline-flex items-center flex-shrink-0 mt-1">
              <input type="checkbox" class="sr-only peer"
                     [checked]="needsTimeSlot()"
                     (change)="needsTimeSlot.set($any($event.target).checked)"
                     data-testid="new-task-needs-time-slot" />
              <div class="w-11 h-6 bg-surface-container rounded-full peer
                          peer-checked:bg-primary-container
                          after:content-[''] after:absolute after:top-[2px] after:start-[2px]
                          after:bg-white after:border after:border-gray-300 after:rounded-full
                          after:h-5 after:w-5 after:transition-all
                          peer-checked:after:translate-x-full"></div>
            </div>
          </label>
        </div>
      </section>

      <!-- Section 5: Schedule (always visible — needsTimeSlot toggles only the date/time inputs inside) -->
      <section>
        <div class="bg-surface-container-lowest rounded-[20px] border border-outline-variant/20 shadow-sm overflow-hidden">
          <div class="flex items-center gap-3 p-4 border-b border-outline-variant/10">
            <span class="material-symbols-outlined text-primary">calendar_month</span>
            <div class="min-w-0">
              <p class="font-semibold text-primary">Schedule</p>
              <p *ngIf="scheduleConfig() as cfg" class="text-[12px] text-on-surface-variant truncate">
                {{ scheduleSummary() }}
              </p>
            </div>
          </div>
          <div class="px-4 pb-4 pt-3">
            <app-schedule-picker
              [value]="scheduleConfig()"
              [needsTimeSlot]="needsTimeSlot()"
              (valueChange)="scheduleConfig.set($event)" />
          </div>
        </div>
      </section>

      <!-- Section 6: Reminders -->
      <section class="space-y-stack-md">
        <h2 class="font-semibold text-[16px] text-on-surface">Reminders &amp; Notifications</h2>
        <div class="bg-surface-container-lowest rounded-[20px] p-4 border border-outline-variant/20 divide-y divide-outline-variant/10">

          <label class="flex items-center justify-between py-4 first:pt-0 cursor-pointer">
            <span class="text-[16px] text-on-surface">Notify at start</span>
            <div class="relative inline-flex items-center">
              <input type="checkbox" class="sr-only peer"
                     [checked]="notifyAtStart()"
                     (change)="notifyAtStart.set($any($event.target).checked)" />
              <div class="w-11 h-6 bg-surface-container rounded-full peer
                          peer-checked:bg-primary-container
                          after:content-[''] after:absolute after:top-[2px] after:start-[2px]
                          after:bg-white after:border after:border-gray-300 after:rounded-full
                          after:h-5 after:w-5 after:transition-all
                          peer-checked:after:translate-x-full"></div>
            </div>
          </label>

          <label class="flex items-center justify-between py-4 cursor-pointer">
            <span class="text-[16px] text-on-surface">Notify at end</span>
            <div class="relative inline-flex items-center">
              <input type="checkbox" class="sr-only peer"
                     [checked]="notifyAtEnd()"
                     (change)="notifyAtEnd.set($any($event.target).checked)" />
              <div class="w-11 h-6 bg-surface-container rounded-full peer
                          peer-checked:bg-primary-container
                          after:content-[''] after:absolute after:top-[2px] after:start-[2px]
                          after:bg-white after:border after:border-gray-300 after:rounded-full
                          after:h-5 after:w-5 after:transition-all
                          peer-checked:after:translate-x-full"></div>
            </div>
          </label>

          <label class="flex items-center justify-between py-4 last:pb-0 cursor-pointer">
            <span class="text-[16px] text-on-surface">Night reminder</span>
            <div class="relative inline-flex items-center">
              <input type="checkbox" class="sr-only peer"
                     [checked]="nightReminder()"
                     (change)="nightReminder.set($any($event.target).checked)" />
              <div class="w-11 h-6 bg-surface-container rounded-full peer
                          peer-checked:bg-primary-container
                          after:content-[''] after:absolute after:top-[2px] after:start-[2px]
                          after:bg-white after:border after:border-gray-300 after:rounded-full
                          after:h-5 after:w-5 after:transition-all
                          peer-checked:after:translate-x-full"></div>
            </div>
          </label>

        </div>
      </section>

      <!-- Section 7: Preview Card -->
      <section class="pb-10">
        <p class="font-label-sm text-outline mb-stack-sm uppercase tracking-wider">Preview</p>
        <div class="p-6 rounded-[20px] bg-white border border-primary-fixed/30"
             style="box-shadow:0 8px 24px rgba(94,67,251,0.06);">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-full flex items-center justify-center"
                 style="background:rgba(194,232,255,0.6);">
              <span class="material-symbols-outlined text-secondary">{{ previewIcon() }}</span>
            </div>
            <div class="min-w-0 flex-1">
              <h4 class="font-bold text-[16px] text-on-surface leading-none truncate">
                {{ taskName().trim() || 'Task Name' }}
              </h4>
              <p class="text-label-sm text-outline mt-1">{{ selectedGoal() }}</p>
            </div>
          </div>
          <p *ngIf="constraintSummary() as cs" class="text-[13px] text-on-surface-variant" data-testid="constraint-summary">
            {{ cs }}
          </p>
        </div>
      </section>

    </main>

    <!-- Sticky Bottom -->
    <div class="fixed bottom-0 left-0 w-full px-margin-page py-4 z-40"
         style="background:rgba(255,255,255,0.7); backdrop-filter:blur(20px);">
      <p *ngIf="error()" class="text-red-500 text-sm mb-3 text-center" data-testid="new-task-error">
        {{ error() }}
      </p>
      <button (click)="createTask()"
              [disabled]="!taskName().trim() || saving()"
              class="w-full py-4 text-white rounded-[20px] font-bold text-[18px] transition-all active:scale-95 disabled:opacity-40"
              style="font-family:Manrope; background:#5e43fb; box-shadow:0 16px 32px rgba(94,67,251,0.25);"
              data-testid="new-task-submit">
        {{ saving() ? 'Saving...' : 'Create Task' }}
      </button>
    </div>

    <!-- New Goal Modal -->
    <div *ngIf="showGoalModal()"
         class="fixed inset-0 z-[100] flex items-center justify-center p-6"
         style="background:rgba(26,28,30,0.4); backdrop-filter:blur(4px);"
         (click)="showGoalModal.set(false)">
      <div class="bg-surface-container-lowest w-full max-w-sm rounded-[20px] overflow-hidden border border-outline-variant/10"
           style="box-shadow:0 24px 48px rgba(0,0,0,0.12);"
           (click)="$event.stopPropagation()">
        <div class="p-6">
          <h3 class="font-bold text-[24px] text-on-surface mb-2" style="font-family:Manrope;">New Goal</h3>
          <p class="text-[16px] text-on-surface-variant mb-6">Enter a name for your custom category.</p>
          <label class="block font-label-sm text-outline mb-1 ml-1">New Goal Name</label>
          <input type="text"
                 [value]="newGoalName()"
                 (input)="newGoalName.set($any($event.target).value)"
                 placeholder="e.g. Productivity, Social"
                 class="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 outline-none text-on-surface"
                 (keyup.enter)="addGoal()" />
        </div>
        <div class="flex gap-3 p-4 border-t border-outline-variant/10"
             style="background:rgba(238,238,240,0.3);">
          <button (click)="showGoalModal.set(false)"
                  class="flex-1 py-3 text-on-surface-variant font-semibold hover:bg-surface-container-high rounded-xl transition-colors">
            Cancel
          </button>
          <button (click)="addGoal()"
                  [disabled]="!newGoalName().trim()"
                  class="flex-1 py-3 text-white font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-40"
                  style="background:#5e43fb; box-shadow:0 4px 12px rgba(94,67,251,0.3);">
            Add
          </button>
        </div>
      </div>
    </div>
  `,
})
export class NewTaskComponent implements OnInit {
  private plannedTasks = inject(PlannedTaskService);
  private location     = inject(Location);
  private router       = inject(Router);
  private route        = inject(ActivatedRoute);

  saving = signal(false);
  error  = signal<string | null>(null);
  editingTaskId = signal<string | null>(null);

  ngOnInit(): void {
    const taskId = this.route.snapshot.queryParamMap.get('taskId');
    if (!taskId) return;
    this.plannedTasks.loadOne(taskId).subscribe({
      next: t => {
        this.editingTaskId.set(taskId);
        this.prefill(t);
      },
      error: () => this.error.set('Could not load the task to edit.'),
    });
  }

  private prefill(t: PlannedTask): void {
    this.taskName.set(t.title);
    if (t.goal) {
      if (!this.goals().includes(t.goal)) this.goals.update(g => [...g, t.goal!]);
      this.selectedGoal.set(t.goal);
    }
    this.needsTimeSlot.set(t.needsTimeSlot);
    this.notifyAtStart.set(t.notifyAtStart ?? false);
    this.notifyAtEnd.set(t.notifyAtEnd ?? false);

    this.timeConstraintEnabled.set(t.minTimeMinutes != null || t.maxTimeMinutes != null);
    this.minTimeMinutes.set(t.minTimeMinutes ?? null);
    this.maxTimeMinutes.set(t.maxTimeMinutes ?? null);
    this.countConstraintEnabled.set(t.minCount != null || t.maxCount != null);
    this.minCount.set(t.minCount ?? null);
    this.maxCount.set(t.maxCount ?? null);

    const cfg: ScheduleConfig = { ...defaultScheduleConfig };
    const backToPicker: Record<Weekday, 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'> = {
      MONDAY: 'mon', TUESDAY: 'tue', WEDNESDAY: 'wed', THURSDAY: 'thu',
      FRIDAY: 'fri', SATURDAY: 'sat', SUNDAY: 'sun',
    };
    switch (t.cadence) {
      case 'ONCE':
        cfg.frequency = 'never';
        cfg.startDate = t.scheduledDate;
        break;
      case 'WEEKLY':
        cfg.frequency = 'weekly';
        cfg.weeklyDays = (t.weekdays ?? []).map(d => backToPicker[d]);
        break;
      case 'MONTHLY':
        cfg.frequency = 'monthly';
        cfg.monthlyDay = t.monthDays?.[0];
        break;
      default:
        cfg.frequency = 'daily';
        cfg.dailyOption = 'every-day';
    }
    cfg.startTime = t.startTime;
    cfg.endTime = t.endTime;
    this.scheduleConfig.set(cfg);
  }

  goals             = signal<string[]>(['Fitness', 'Learning', 'Health']);
  selectedGoal      = signal<string>('Fitness');
  taskName          = signal<string>('');
  notifyAtStart     = signal<boolean>(true);
  notifyAtEnd       = signal<boolean>(false);
  nightReminder     = signal<boolean>(true);
  needsTimeSlot     = signal<boolean>(true);
  scheduleConfig    = signal<ScheduleConfig>({ ...defaultScheduleConfig });
  showGoalModal     = signal<boolean>(false);
  newGoalName       = signal<string>('');

  timeConstraintEnabled  = signal(false);
  minTimeMinutes         = signal<number | null>(null);
  maxTimeMinutes         = signal<number | null>(null);
  countConstraintEnabled = signal(false);
  minCount               = signal<number | null>(null);
  maxCount               = signal<number | null>(null);
  constraintError        = signal<string | null>(null);

  previewIcon = computed(() => {
    const n = this.taskName().toLowerCase();
    if (n.includes('water') || n.includes('drink'))                  return 'water_drop';
    if (n.includes('run') || n.includes('workout') || n.includes('exercise')) return 'fitness_center';
    if (n.includes('study') || n.includes('learn') || n.includes('read'))     return 'menu_book';
    if (n.includes('meditat') || n.includes('mindful'))              return 'self_improvement';
    if (n.includes('write') || n.includes('journal'))                return 'edit_square';
    return 'task_alt';
  });

  constraintSummary = computed<string | null>(() => {
    const parts: string[] = [];
    if (this.timeConstraintEnabled()) {
      const mn = this.minTimeMinutes(), mx = this.maxTimeMinutes();
      if (mn != null && mx != null) parts.push(`⏱ ${mn}–${mx} min`);
      else if (mn != null) parts.push(`⏱ ≥ ${mn} min`);
      else if (mx != null) parts.push(`⏱ ≤ ${mx} min`);
    }
    if (this.countConstraintEnabled()) {
      const mn = this.minCount(), mx = this.maxCount();
      if (mn != null && mx != null) parts.push(`🔢 ${mn}–${mx} ×`);
      else if (mn != null) parts.push(`🔢 ≥ ${mn} ×`);
      else if (mx != null) parts.push(`🔢 ≤ ${mx} ×`);
    }
    return parts.length ? parts.join(' · ') : null;
  });

  goalIcon(goal: string): string {
    return GOAL_ICONS[goal] ?? '🎯';
  }

  parseNum(v: string): number | null {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  scheduleSummary(): string {
    const c = this.scheduleConfig();
    if (!c) return '';
    if (c.frequency === 'never') {
      return c.startDate ? `One-time on ${c.startDate}` : 'One-time task';
    }
    const unit = c.frequency === 'daily'   ? 'day'
               : c.frequency === 'weekly'  ? 'week'
               : c.frequency === 'monthly' ? 'month'
               : 'year';
    const every = c.interval > 1 ? `Every ${c.interval} ${unit}s` : `Every ${unit}`;
    if (c.frequency === 'daily' && c.dailyOption && c.dailyOption !== 'every-day') {
      return `${every} • ${c.dailyOption.replace('-', ' ')}`;
    }
    if (c.frequency === 'weekly' && c.weeklyDays?.length) {
      return `${every} • ${c.weeklyDays.map(d => d.toUpperCase()).join(' ')}`;
    }
    return every;
  }

  addGoal(): void {
    const name = this.newGoalName().trim();
    if (!name) return;
    this.goals.update(g => [...g, name]);
    this.selectedGoal.set(name);
    this.newGoalName.set('');
    this.showGoalModal.set(false);
  }

  createTask(): void {
    const title = this.taskName().trim();
    if (!title) return;
    this.constraintError.set(null);
    if (this.timeConstraintEnabled()
        && this.minTimeMinutes() != null && this.maxTimeMinutes() != null
        && this.maxTimeMinutes()! < this.minTimeMinutes()!) {
      this.constraintError.set('Max minutes must be at least Min minutes'); return;
    }
    if (this.countConstraintEnabled()
        && this.minCount() != null && this.maxCount() != null
        && this.maxCount()! < this.minCount()!) {
      this.constraintError.set('Max count must be at least Min count'); return;
    }
    const input = this.toPlannedTaskInput(title);
    this.saving.set(true);
    this.error.set(null);

    const editId = this.editingTaskId();
    if (editId) {
      // PATCH semantics ignore nulls, so disabled constraints are cleared with 0.
      const patch = {
        ...input,
        minTimeMinutes: input.minTimeMinutes ?? 0,
        maxTimeMinutes: input.maxTimeMinutes ?? 0,
        minCount: input.minCount ?? 0,
        maxCount: input.maxCount ?? 0,
      };
      this.plannedTasks.update(editId, patch).subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigateByUrl('/tasks');
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message || 'Could not save changes. Please try again.');
        },
      });
      return;
    }

    this.plannedTasks.create(input).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigateByUrl(this.routeForCadence(input.cadence));
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message || 'Could not save task. Please try again.');
      },
    });
  }

  private routeForCadence(cadence: PlannedTaskCadence): string {
    switch (cadence) {
      case 'WEEKLY':  return '/schedule/week';
      case 'MONTHLY': return '/schedule/month';
      default:        return '/schedule';
    }
  }

  private toPlannedTaskInput(title: string): PlannedTaskInput {
    const cfg = this.scheduleConfig();
    const minutes = 30;
    const needsTimeSlot = this.needsTimeSlot();

    let cadence: PlannedTaskCadence;
    let weekdays: Weekday[] | undefined;
    let monthDays: number[] | undefined;
    let scheduledDate: string | undefined;

    switch (cfg.frequency) {
      case 'never':
        cadence = 'ONCE';
        // One-time task: use the picker's Start Date or today.
        scheduledDate = cfg.startDate || new Date().toISOString().slice(0, 10);
        break;
      case 'weekly':
        cadence = 'WEEKLY';
        weekdays = this.mapWeeklyDays(cfg.weeklyDays);
        break;
      case 'monthly':
        cadence = 'MONTHLY';
        monthDays = cfg.monthlyDay != null ? [cfg.monthlyDay] : [new Date().getDate()];
        break;
      case 'yearly':
      case 'daily':
      default:
        // "Daily" with a Weekdays/Weekends preset is really a WEEKLY task on
        // those days — plain DAILY would apply to all 7 days.
        if (cfg.frequency === 'daily' && cfg.dailyOption === 'weekdays') {
          cadence = 'WEEKLY';
          weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
        } else if (cfg.frequency === 'daily' && cfg.dailyOption === 'weekends') {
          cadence = 'WEEKLY';
          weekdays = ['SATURDAY', 'SUNDAY'];
        } else {
          cadence = 'DAILY';
        }
        break;
    }

    let startTime: string | undefined;
    let endTime: string | undefined;
    if (needsTimeSlot && cfg.startTime) {
      startTime = cfg.startTime;
      endTime = cfg.endTime || this.addMinutesToTime(cfg.startTime, minutes);
    }

    const minTimeMinutes = this.timeConstraintEnabled() ? this.minTimeMinutes() : null;
    const maxTimeMinutes = this.timeConstraintEnabled() ? this.maxTimeMinutes() : null;
    const minCount       = this.countConstraintEnabled() ? this.minCount() : null;
    const maxCount       = this.countConstraintEnabled() ? this.maxCount() : null;

    return {
      title,
      goal: this.selectedGoal(),
      color: '#451de3',
      cadence,
      needsTimeSlot,
      startTime,
      endTime,
      scheduledDate,
      weekdays,
      monthDays,
      minTimeMinutes,
      maxTimeMinutes,
      minCount,
      maxCount,
      notifyAtStart: this.notifyAtStart(),
      notifyAtEnd: this.notifyAtEnd(),
    };
  }

  private mapWeeklyDays(days: string[] | undefined): Weekday[] | undefined {
    if (!days || !days.length) return undefined;
    const map: Record<string, Weekday> = {
      mon: 'MONDAY', tue: 'TUESDAY', wed: 'WEDNESDAY', thu: 'THURSDAY',
      fri: 'FRIDAY', sat: 'SATURDAY', sun: 'SUNDAY',
    };
    const out: Weekday[] = [];
    for (const d of days) {
      const w = map[d.toLowerCase()];
      if (w) out.push(w);
    }
    return out.length ? out : undefined;
  }

  private addMinutesToTime(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}`;
  }

  goBack(): void { this.location.back(); }
}
