import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlannedTask } from '../../core/models/planned-task.model';

export interface SlotPopupConfirm {
  taskId: string;
  date: string;
  startTime: string;
  endTime: string;
}

@Component({
  selector: 'app-schedule-slot-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6"
         style="background:rgba(26,28,30,0.4); backdrop-filter:blur(4px);"
         (click)="close.emit()"
         data-testid="slot-popup">

      <div class="bg-surface-container-lowest w-full sm:max-w-md rounded-t-[28px] sm:rounded-[20px] overflow-hidden"
           style="box-shadow:0 24px 48px rgba(0,0,0,0.12);"
           (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="p-5 pb-3 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="w-10 h-1 rounded-full bg-outline-variant mb-3 sm:hidden"></div>
            <h3 class="font-bold text-[18px] text-on-surface" style="font-family:Manrope;">Schedule a slot</h3>
            <p class="text-[12px] text-on-surface-variant mt-0.5">Pick an existing task, day and time.</p>
          </div>
          <button type="button"
                  (click)="newTask.emit()"
                  class="flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold flex-shrink-0"
                  style="background:rgba(94,67,251,0.10); color:#5e43fb;"
                  data-testid="slot-popup-new-task">
            <span class="material-symbols-outlined text-[14px]">add</span>
            New task
          </button>
        </div>

        <div class="px-5 pb-3 space-y-3">

          <!-- Task autosuggest -->
          <div class="relative">
            <label class="block text-[10px] font-bold text-outline uppercase mb-1">Task</label>
            <input type="text"
                   [(ngModel)]="query"
                   (focus)="suggestOpen.set(true)"
                   (input)="onQueryInput()"
                   placeholder="Type to search…"
                   class="w-full px-3 py-2.5 bg-surface-container-low rounded-xl text-[14px] focus:ring-0 focus:outline-none"
                   data-testid="slot-popup-task-input" />

            <div *ngIf="suggestOpen() && filteredTasks().length > 0"
                 class="absolute z-10 mt-1 left-0 right-0 bg-surface-container-lowest rounded-xl border border-outline-variant/20 max-h-48 overflow-y-auto"
                 style="box-shadow:0 8px 24px rgba(0,0,0,0.10);"
                 data-testid="slot-popup-task-suggest">
              <button *ngFor="let t of filteredTasks()"
                      type="button"
                      (click)="pickTask(t)"
                      [attr.data-testid]="'slot-popup-suggest-' + t.id"
                      class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-container-low transition-colors">
                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" [style.background]="t.color"></span>
                <span class="flex-1 text-[13px] text-on-surface truncate">{{ t.title }}</span>
                <span class="text-[10px] uppercase font-bold text-on-surface-variant">{{ t.cadence }}</span>
              </button>
            </div>

            <div *ngIf="selectedTask()"
                 class="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl"
                 style="background:rgba(94,67,251,0.06);"
                 data-testid="slot-popup-selected">
              <span class="w-2.5 h-2.5 rounded-full" [style.background]="selectedTask()!.color"></span>
              <span class="flex-1 text-[13px] font-semibold text-on-surface truncate">{{ selectedTask()!.title }}</span>
              <button type="button" (click)="clearTask()" class="text-on-surface-variant">
                <span class="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          </div>

          <!-- Date -->
          <div>
            <label class="block text-[10px] font-bold text-outline uppercase mb-1">Day</label>
            <input type="date"
                   [(ngModel)]="date"
                   class="w-full px-3 py-2.5 bg-surface-container-low rounded-xl text-[14px] focus:ring-0 focus:outline-none"
                   data-testid="slot-popup-date" />
          </div>

          <!-- Time slot -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] font-bold text-outline uppercase mb-1">Start</label>
              <input type="time"
                     [(ngModel)]="startTime"
                     class="w-full px-3 py-2.5 bg-surface-container-low rounded-xl text-[14px] focus:ring-0 focus:outline-none"
                     data-testid="slot-popup-start" />
            </div>
            <div>
              <label class="block text-[10px] font-bold text-outline uppercase mb-1">End</label>
              <input type="time"
                     [(ngModel)]="endTime"
                     class="w-full px-3 py-2.5 bg-surface-container-low rounded-xl text-[14px] focus:ring-0 focus:outline-none"
                     data-testid="slot-popup-end" />
            </div>
          </div>

          <p *ngIf="error || errorMsg()" class="text-[12px]" style="color:#ba1a1a;" data-testid="slot-popup-error">{{ error || errorMsg() }}</p>
        </div>

        <!-- Footer -->
        <div class="flex gap-3 p-4 border-t border-outline-variant/10"
             style="background:rgba(238,238,240,0.3);">
          <button type="button"
                  (click)="close.emit()"
                  class="flex-1 py-3 text-on-surface-variant font-semibold rounded-xl hover:bg-surface-container-high transition-colors"
                  data-testid="slot-popup-cancel">
            Cancel
          </button>
          <button type="button"
                  (click)="onConfirm()"
                  [disabled]="!canConfirm() || busy"
                  class="flex-1 py-3 text-white font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-50"
                  style="background:#5e43fb; box-shadow:0 4px 12px rgba(94,67,251,0.3);"
                  data-testid="slot-popup-confirm">
            {{ busy ? 'Scheduling…' : 'Schedule' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ScheduleSlotPopupComponent implements OnInit, OnChanges {
  @Input() tasks: PlannedTask[] = [];
  @Input() defaultDate = '';
  @Input() error: string | null = null;
  @Input() busy = false;
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<SlotPopupConfirm>();
  @Output() newTask = new EventEmitter<void>();

  query = '';
  date = '';
  startTime = '09:00';
  endTime = '10:00';

  readonly selectedTask = signal<PlannedTask | null>(null);
  readonly suggestOpen = signal(false);
  readonly errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    this.date = this.defaultDate || this.todayIso();
  }

  ngOnChanges(_: SimpleChanges): void {
    if (this.error) this.errorMsg.set(null);
  }

  filteredTasks(): PlannedTask[] {
    const q = this.query.trim().toLowerCase();
    const pool = this.tasks.filter(t => t.cadence !== 'ONCE');
    if (!q) return pool.slice(0, 8);
    return pool.filter(t => t.title.toLowerCase().includes(q)).slice(0, 8);
  }

  onQueryInput(): void {
    this.suggestOpen.set(true);
    if (this.selectedTask() && this.query !== this.selectedTask()!.title) {
      this.selectedTask.set(null);
    }
  }

  pickTask(t: PlannedTask): void {
    this.selectedTask.set(t);
    this.query = t.title;
    this.suggestOpen.set(false);
  }

  clearTask(): void {
    this.selectedTask.set(null);
    this.query = '';
  }

  canConfirm(): boolean {
    return !!this.selectedTask() && !!this.date && !!this.startTime && !!this.endTime
      && this.endTime > this.startTime;
  }

  onConfirm(): void {
    const t = this.selectedTask();
    if (!t) { this.errorMsg.set('Pick a task first.'); return; }
    if (!this.date) { this.errorMsg.set('Pick a day.'); return; }
    if (this.endTime <= this.startTime) {
      this.errorMsg.set('End time must be after start time.');
      return;
    }
    this.errorMsg.set(null);
    this.confirm.emit({
      taskId: t.id,
      date: this.date,
      startTime: this.startTime,
      endTime: this.endTime,
    });
  }

  private todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
