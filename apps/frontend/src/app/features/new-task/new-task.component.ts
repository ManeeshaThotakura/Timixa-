import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HabitService } from '../../core/services/habit.service';

const GOAL_ICONS: Record<string, string> = {
  Fitness: '🏃‍♂️', Learning: '📚', Health: '🧘‍♀️',
  Work: '💼', Mindfulness: '🧠', Social: '🤝',
};

@Component({
  selector: 'app-new-task',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Header -->
    <header class="bg-white/80 backdrop-blur-xl flex justify-between items-center px-6 py-4 w-full sticky top-0 z-50 shadow-[0px_8px_24px_rgba(94,67,251,0.04)]">
      <div class="flex items-center gap-4">
        <button (click)="goBack()"
                class="p-2 -ml-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors active:scale-95 duration-200">
          <span class="material-symbols-outlined text-[24px]">close</span>
        </button>
        <h1 class="text-lg font-extrabold text-on-surface" style="font-family:Manrope;">New Task</h1>
      </div>
      <button (click)="createTask()"
              [disabled]="!taskName().trim()"
              class="font-semibold text-sm transition-colors"
              [style.color]="taskName().trim() ? '#451de3' : '#9aa0a6'"
              style="font-family:Manrope;">
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

      <!-- Section 3: Task Type -->
      <section class="space-y-stack-sm">
        <h2 class="font-semibold text-[16px] text-on-surface">Task Type</h2>
        <div class="grid grid-cols-3 gap-stack-sm">
          <button *ngFor="let t of taskTypes"
                  (click)="taskType.set(t.value)"
                  class="flex flex-col items-center justify-center p-4 rounded-[20px] active:scale-95 transition-all"
                  [style.background]="taskType() === t.value ? '#5e43fb' : '#ffffff'"
                  [style.boxShadow]="taskType() === t.value
                    ? '0px 12px 24px rgba(94,67,251,0.25)'
                    : '0px 8px 24px rgba(0,0,0,0.02)'">
            <span class="material-symbols-outlined mb-2"
                  [style.color]="taskType() === t.value ? '#ffffff' : '#787588'">
              {{ t.icon }}
            </span>
            <span class="text-[11px] font-semibold"
                  [style.color]="taskType() === t.value ? '#ffffff' : '#787588'">
              {{ t.label }}
            </span>
          </button>
        </div>
      </section>

      <!-- Section 4: Dynamic Parameters -->
      <section class="p-6 rounded-[20px] border border-outline-variant/10"
               style="background:rgba(238,238,240,0.4);">

        <!-- Count -->
        <ng-container *ngIf="taskType() === 'count'">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h3 class="font-semibold text-[16px] text-on-surface">Target count</h3>
              <p class="text-label-sm text-outline mt-1">How many times per day?</p>
            </div>
            <div class="flex items-center gap-3 bg-white rounded-full p-1 shadow-sm border border-outline-variant/20">
              <button (click)="decrement()"
                      class="w-10 h-10 rounded-full flex items-center justify-center text-primary-container active:bg-primary-fixed transition-colors">
                <span class="material-symbols-outlined">remove</span>
              </button>
              <span class="font-bold text-[18px] min-w-[2ch] text-center text-on-surface" style="font-family:Manrope;">
                {{ targetCount() }}
              </span>
              <button (click)="increment()"
                      class="w-10 h-10 rounded-full flex items-center justify-center text-primary-container active:bg-primary-fixed transition-colors">
                <span class="material-symbols-outlined">add</span>
              </button>
            </div>
          </div>
          <div class="flex items-start gap-2 p-3 rounded-xl" style="background:rgba(194,232,255,0.3);">
            <span class="material-symbols-outlined text-secondary text-[18px] mt-0.5">info</span>
            <p class="text-[13px] text-on-surface leading-snug">
              You will tap <span class="font-bold">+</span> to track progress on your dashboard.
            </p>
          </div>
        </ng-container>

        <!-- Time -->
        <ng-container *ngIf="taskType() === 'time'">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h3 class="font-semibold text-[16px] text-on-surface">Duration</h3>
              <p class="text-label-sm text-outline mt-1">Minutes per session</p>
            </div>
            <div class="flex items-center gap-3 bg-white rounded-full p-1 shadow-sm border border-outline-variant/20">
              <button (click)="decrementTime()"
                      class="w-10 h-10 rounded-full flex items-center justify-center text-primary-container active:bg-primary-fixed transition-colors">
                <span class="material-symbols-outlined">remove</span>
              </button>
              <span class="font-bold text-[18px] min-w-[3ch] text-center text-on-surface" style="font-family:Manrope;">
                {{ targetMinutes() }}
              </span>
              <button (click)="incrementTime()"
                      class="w-10 h-10 rounded-full flex items-center justify-center text-primary-container active:bg-primary-fixed transition-colors">
                <span class="material-symbols-outlined">add</span>
              </button>
            </div>
          </div>
          <div class="flex items-start gap-2 p-3 rounded-xl" style="background:rgba(194,232,255,0.3);">
            <span class="material-symbols-outlined text-secondary text-[18px] mt-0.5">info</span>
            <p class="text-[13px] text-on-surface leading-snug">A timer will track your progress during the session.</p>
          </div>
        </ng-container>

        <!-- Frequency -->
        <ng-container *ngIf="taskType() === 'frequency'">
          <h3 class="font-semibold text-[16px] text-on-surface mb-3">How often?</h3>
          <div class="grid grid-cols-3 gap-2 mb-4">
            <button *ngFor="let f of frequencies"
                    (click)="selectedFrequency.set(f.value)"
                    class="py-2.5 rounded-xl text-[12px] font-semibold transition-all active:scale-95"
                    [style.background]="selectedFrequency() === f.value ? '#451de3' : '#f3f3f6'"
                    [style.color]="selectedFrequency() === f.value ? '#ffffff' : '#787588'">
              {{ f.label }}
            </button>
          </div>
          <div class="flex items-start gap-2 p-3 rounded-xl" style="background:rgba(194,232,255,0.3);">
            <span class="material-symbols-outlined text-secondary text-[18px] mt-0.5">info</span>
            <p class="text-[13px] text-on-surface leading-snug">Appears on your dashboard on scheduled days.</p>
          </div>
        </ng-container>

      </section>

      <!-- Section 5: Schedule -->
      <section>
        <div (click)="toggleSchedule()"
             class="flex justify-between items-center p-4 bg-surface-container-lowest rounded-[20px] border border-outline-variant/20 shadow-sm cursor-pointer active:bg-surface-container-high transition-colors">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-on-surface-variant">calendar_month</span>
            <span class="font-semibold text-on-surface-variant">
              {{ isScheduled() ? 'Scheduled for today' : 'Schedule this task' }}
            </span>
          </div>
          <span class="material-symbols-outlined text-outline transition-transform duration-200"
                [style.transform]="isScheduled() ? 'rotate(180deg)' : 'rotate(0deg)'">
            expand_more
          </span>
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
          <div class="flex justify-between items-center mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full flex items-center justify-center"
                   style="background:rgba(194,232,255,0.6);">
                <span class="material-symbols-outlined text-secondary">{{ previewIcon() }}</span>
              </div>
              <div>
                <h4 class="font-bold text-[16px] text-on-surface leading-none">
                  {{ taskName().trim() || 'Task Name' }}
                </h4>
                <p class="text-label-sm text-outline mt-1">{{ previewGoalLabel() }}</p>
              </div>
            </div>
            <span class="font-extrabold text-primary-container" style="font-family:Manrope;">
              {{ previewCounter() }}
            </span>
          </div>
          <div class="w-full h-2.5 bg-surface-container rounded-full overflow-hidden">
            <div class="h-full w-[5%] rounded-full"
                 style="background:linear-gradient(90deg,#451de3,#00c1fd);"></div>
          </div>
        </div>
      </section>

    </main>

    <!-- Sticky Bottom -->
    <div class="fixed bottom-0 left-0 w-full px-margin-page py-4 z-40"
         style="background:rgba(255,255,255,0.7); backdrop-filter:blur(20px);">
      <button (click)="createTask()"
              [disabled]="!taskName().trim()"
              class="w-full py-4 text-white rounded-[20px] font-bold text-[18px] transition-all active:scale-95 disabled:opacity-40"
              style="font-family:Manrope; background:#5e43fb; box-shadow:0 16px 32px rgba(94,67,251,0.25);">
        Create Task
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
export class NewTaskComponent {
  private habitService = inject(HabitService);
  private location     = inject(Location);

  goals             = signal<string[]>(['Fitness', 'Learning', 'Health']);
  selectedGoal      = signal<string>('Fitness');
  taskName          = signal<string>('');
  taskType          = signal<'time' | 'count' | 'frequency'>('count');
  targetCount       = signal<number>(10);
  targetMinutes     = signal<number>(60);
  selectedFrequency = signal<string>('daily');
  notifyAtStart     = signal<boolean>(true);
  notifyAtEnd       = signal<boolean>(false);
  nightReminder     = signal<boolean>(true);
  isScheduled       = signal<boolean>(false);
  showGoalModal     = signal<boolean>(false);
  newGoalName       = signal<string>('');

  taskTypes = [
    { value: 'time'      as const, label: 'Time',      icon: 'schedule'     },
    { value: 'count'     as const, label: 'Count',     icon: 'counter_3'    },
    { value: 'frequency' as const, label: 'Frequency', icon: 'event_repeat' },
  ];

  frequencies = [
    { value: 'daily',       label: 'Daily'      },
    { value: 'weekdays',    label: 'Weekdays'   },
    { value: 'weekends',    label: 'Weekends'   },
    { value: 'mon-wed-fri', label: 'M/W/F'      },
    { value: 'custom',      label: 'Custom'     },
  ];

  previewIcon = computed(() => {
    const n = this.taskName().toLowerCase();
    if (n.includes('water') || n.includes('drink'))                  return 'water_drop';
    if (n.includes('run') || n.includes('workout') || n.includes('exercise')) return 'fitness_center';
    if (n.includes('study') || n.includes('learn') || n.includes('read'))     return 'menu_book';
    if (n.includes('meditat') || n.includes('mindful'))              return 'self_improvement';
    if (n.includes('write') || n.includes('journal'))                return 'edit_square';
    return 'task_alt';
  });

  previewGoalLabel = computed(() => {
    if (this.taskType() === 'count')     return `Goal: ${this.targetCount()} times today`;
    if (this.taskType() === 'time')      return `Goal: ${this.targetMinutes()} min today`;
    return `Goal: ${this.selectedFrequency()}`;
  });

  previewCounter = computed(() => {
    if (this.taskType() === 'count') return `0/${this.targetCount()}`;
    if (this.taskType() === 'time')  return `0m/${this.targetMinutes()}m`;
    return '0%';
  });

  goalIcon(goal: string): string {
    return GOAL_ICONS[goal] ?? '🎯';
  }

  increment():     void { this.targetCount.update(n => n + 1); }
  decrement():     void { this.targetCount.update(n => Math.max(1, n - 1)); }
  incrementTime(): void { this.targetMinutes.update(n => n + 15); }
  decrementTime(): void { this.targetMinutes.update(n => Math.max(15, n - 15)); }
  toggleSchedule():void { this.isScheduled.update(v => !v); }

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
    const target = this.taskType() === 'time'
      ? this.targetMinutes()
      : this.taskType() === 'count'
        ? this.targetCount()
        : 1;
    const unit = this.taskType() === 'time' ? 'min' : 'times';
    this.habitService.addTask(title, this.selectedGoal(), target, unit);
    this.goBack();
  }

  goBack(): void { this.location.back(); }
}
