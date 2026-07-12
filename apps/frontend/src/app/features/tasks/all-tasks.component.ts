import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PlannedTaskService } from '../../core/services/planned-task.service';
import { PlannedTask } from '../../core/models/planned-task.model';

const DAY_SHORT: Record<string, string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu',
  FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun',
};

@Component({
  selector: 'app-all-tasks',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="px-margin-page pt-stack-lg pb-28">
      <header class="mb-stack-lg">
        <h2 class="font-manrope font-bold text-h1 text-on-surface">All tasks</h2>
        <p class="text-on-surface-variant text-sm mt-0.5">{{ tasks().length }} task{{ tasks().length === 1 ? '' : 's' }} created</p>
      </header>

      <div *ngIf="loaded() && tasks().length === 0"
           class="bg-surface-container-low rounded-[20px] p-4 text-on-surface-variant text-sm"
           data-testid="all-tasks-empty">
        No tasks yet. Create one from the dashboard.
      </div>

      <div class="grid gap-stack-sm">
        <div *ngFor="let t of tasks()"
             class="bg-surface-container-lowest rounded-[20px] p-4 shadow-card"
             [attr.data-testid]="'task-row-' + t.id">
          <div class="flex items-center gap-3">
            <span class="w-3 h-3 rounded-full flex-shrink-0" [style.background]="t.color"></span>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-on-surface truncate">{{ t.title }}</p>
              <p class="text-on-surface-variant text-[12px] truncate">
                {{ cadenceLabel(t) }}
                <span *ngIf="t.startTime && t.endTime"> · {{ t.startTime }}–{{ t.endTime }}</span>
                <span *ngIf="!t.needsTimeSlot"> · any time</span>
                <span *ngIf="t.goal"> · {{ t.goal }}</span>
              </p>
            </div>
            <button type="button"
                    (click)="edit(t.id)"
                    class="w-9 h-9 rounded-full flex items-center justify-center"
                    style="background:rgba(94,67,251,0.10); color:#5e43fb;"
                    [attr.data-testid]="'edit-' + t.id">
              <span class="material-symbols-outlined text-[18px]">edit</span>
            </button>
            <button type="button"
                    (click)="confirmDeleteId.set(t.id)"
                    class="w-9 h-9 rounded-full flex items-center justify-center"
                    style="background:rgba(186,26,26,0.10); color:#ba1a1a;"
                    [attr.data-testid]="'delete-' + t.id">
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete confirmation -->
    <div *ngIf="confirmDeleteId() as id"
         class="fixed inset-0 z-[100] flex items-center justify-center p-6"
         style="background:rgba(26,28,30,0.4); backdrop-filter:blur(4px);"
         (click)="confirmDeleteId.set(null)"
         data-testid="delete-confirm">
      <div class="bg-surface-container-lowest w-full max-w-sm rounded-[20px] overflow-hidden"
           style="box-shadow:0 24px 48px rgba(0,0,0,0.12);"
           (click)="$event.stopPropagation()">
        <div class="p-6">
          <h3 class="font-bold text-[18px] text-on-surface" style="font-family:Manrope;">Delete this task?</h3>
          <p class="text-[13px] text-on-surface-variant mt-1">
            "{{ titleOf(id) }}" and all of its scheduled slots, history and exceptions will be removed everywhere. This can't be undone.
          </p>
        </div>
        <div class="flex gap-3 p-4 border-t border-outline-variant/10" style="background:rgba(238,238,240,0.3);">
          <button type="button"
                  (click)="confirmDeleteId.set(null)"
                  class="flex-1 py-3 text-on-surface-variant font-semibold rounded-xl hover:bg-surface-container-high transition-colors"
                  data-testid="delete-cancel">
            Cancel
          </button>
          <button type="button"
                  (click)="doDelete(id)"
                  class="flex-1 py-3 text-white font-semibold rounded-xl transition-all active:scale-95"
                  style="background:#ba1a1a;"
                  data-testid="delete-confirm-yes">
            Delete
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AllTasksComponent implements OnInit {
  private plannedTasks = inject(PlannedTaskService);
  private router = inject(Router);

  tasks = signal<PlannedTask[]>([]);
  loaded = signal(false);
  confirmDeleteId = signal<string | null>(null);

  ngOnInit(): void { this.reload(); }

  private reload(): void {
    this.plannedTasks.loadAll().subscribe(list => {
      this.tasks.set(list);
      this.loaded.set(true);
    });
  }

  cadenceLabel(t: PlannedTask): string {
    switch (t.cadence) {
      case 'ONCE': return `Once${t.scheduledDate ? ' · ' + t.scheduledDate : ''}`;
      case 'DAILY': return 'Every day';
      case 'WEEKLY': {
        const order = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
        const days = [...(t.weekdays ?? [])]
          .sort((a, b) => order.indexOf(a) - order.indexOf(b))
          .map(d => DAY_SHORT[d] ?? d).join(' ');
        return days ? `Weekly · ${days}` : 'Weekly · no day picked';
      }
      case 'MONTHLY': {
        const days = (t.monthDays ?? []).join(', ');
        return days ? `Monthly · day ${days}` : 'Monthly · no day picked';
      }
    }
  }

  titleOf(id: string): string {
    return this.tasks().find(t => t.id === id)?.title ?? '';
  }

  edit(id: string): void {
    this.router.navigate(['/new-task'], { queryParams: { taskId: id } });
  }

  doDelete(id: string): void {
    this.confirmDeleteId.set(null);
    this.plannedTasks.remove(id).subscribe(() => this.reload());
  }
}
