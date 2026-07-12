import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProjectService } from '../../../core/services/project.service';
import { Issue } from '../../../core/models/project.model';
import { BOARD_TYPES } from '../task-meta';

const EPIC_COLORS = ['#7c3aed', '#2563eb', '#0891b2', '#16a34a', '#ea580c', '#dc2626', '#451de3', '#d97706'];

@Component({
  selector: 'app-epics-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="px-margin-page pt-stack-md pb-32">

      <!-- Header -->
      <div class="flex items-center gap-3 mb-stack-lg">
        <button (click)="goBoard()" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container-low active:scale-95">
          <span class="material-symbols-outlined text-on-surface">arrow_back</span>
        </button>
        <div class="flex-1">
          <h1 class="font-bold text-[24px] text-on-surface tracking-tight" style="font-family:Manrope;">Epics</h1>
          <p class="text-[13px] text-on-surface-variant">{{ project()?.title }}</p>
        </div>
        <button (click)="openCreate()"
                class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[14px] font-bold text-white bg-gradient-to-tr from-primary to-secondary-container active:scale-95">
          <span class="material-symbols-outlined text-[20px]">add</span>New Epic
        </button>
      </div>

      <!-- Epic list -->
      <div class="space-y-3 max-w-3xl">
        <div *ngFor="let e of epics()" (click)="openEpic(e)"
             class="bg-white rounded-2xl border border-surface-container overflow-hidden flex cursor-pointer transition-all hover:shadow-[0px_12px_32px_rgba(94,67,251,0.08)]">
          <span class="w-1.5 flex-shrink-0" [style.background]="e.color || '#7c3aed'"></span>
          <div class="flex-1 min-w-0 p-4">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[9px] px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1" style="background:#ede9fe;color:#7c3aed;">
                <span class="material-symbols-outlined text-[12px]">bolt</span>EPIC
              </span>
              <span class="text-[11px] font-bold text-on-surface-variant">{{ e.key }}</span>
            </div>
            <h3 class="text-[15px] font-bold text-on-surface truncate" style="font-family:Manrope;">{{ e.title }}</h3>
            <p *ngIf="e.description" class="text-[12px] text-on-surface-variant truncate mt-0.5">{{ e.description }}</p>

            <div class="flex items-center gap-3 mt-3">
              <div class="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
                <div class="h-full rounded-full" [style.width.%]="progress(e.id)" [style.background]="e.color || '#7c3aed'"></div>
              </div>
              <span class="text-[12px] font-bold text-on-surface-variant whitespace-nowrap">{{ doneCount(e.id) }}/{{ storyCount(e.id) }} done</span>
            </div>
          </div>
          <span class="self-center pr-3 material-symbols-outlined text-outline">chevron_right</span>
        </div>

        <button (click)="openCreate()"
                class="w-full py-3 rounded-2xl border-2 border-dashed border-outline-variant flex items-center justify-center gap-1.5 text-on-surface-variant hover:border-primary/50 hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-[20px]">add</span><span class="text-[13px] font-bold">New Epic</span>
        </button>

        <p *ngIf="!epics().length" class="text-center text-[13px] text-on-surface-variant py-8">No epics yet — create your first one.</p>
      </div>
    </div>

    <!-- Create modal -->
    <div *ngIf="showCreate()" class="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center" (click)="closeCreate()">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
      <div class="relative bg-white rounded-t-[28px] sm:rounded-[28px] w-full sm:max-w-md max-h-[92vh] overflow-y-auto p-6 pb-10" style="box-shadow:0 -8px 40px rgba(0,0,0,0.12);" (click)="$event.stopPropagation()">
        <div class="w-12 h-1 rounded-full bg-outline-variant mx-auto mb-6 sm:hidden"></div>
        <h3 class="font-bold text-[22px] text-on-surface mb-5" style="font-family:Manrope;">Create Epic</h3>

        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Name</label>
          <input type="text" [ngModel]="name()" (ngModelChange)="name.set($event)" placeholder="e.g. Design System"
                 class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[15px] font-medium outline-none border border-transparent focus:border-primary/30" />
        </div>

        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-2 block">Color</label>
          <div class="flex flex-wrap gap-2">
            <button *ngFor="let c of colors" (click)="color.set(c)"
                    class="w-8 h-8 rounded-full transition-all border-2"
                    [style.background]="c" [style.borderColor]="color() === c ? '#1c1b1f' : 'transparent'" [class.scale-110]="color() === c"></button>
          </div>
        </div>

        <div class="mb-6">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Description</label>
          <textarea [ngModel]="description()" (ngModelChange)="description.set($event)" rows="2" placeholder="What does this epic cover?"
                    class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[15px] outline-none border border-transparent focus:border-primary/30 resize-none"></textarea>
        </div>

        <div class="flex gap-3">
          <button (click)="closeCreate()" class="flex-1 py-3.5 rounded-2xl bg-surface-container text-on-surface-variant text-[14px] font-bold active:scale-95">Cancel</button>
          <button (click)="save()" [disabled]="!name().trim()"
                  class="flex-1 py-3.5 rounded-2xl text-white text-[14px] font-bold bg-gradient-to-tr from-primary to-secondary-container active:scale-95 disabled:opacity-40">Create epic</button>
        </div>
      </div>
    </div>
  `,
})
export class EpicsPageComponent implements OnInit {
  private projectService = inject(ProjectService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  readonly colors = EPIC_COLORS;

  private pid = signal('');
  project = computed(() => this.projectService.getProjectById(this.pid()));
  epics = computed(() => this.projectService.epicsOf(this.pid()));

  showCreate = signal(false);
  name = signal('');
  color = signal(EPIC_COLORS[0]);
  description = signal('');

  ngOnInit(): void {
    this.projectService.load();
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(pm => {
      this.pid.set(pm.get('pid') || this.projectService.projects()[0]?.id || '');
    });
    if (this.route.snapshot.queryParamMap.get('new') !== null) this.openCreate();
  }

  private storiesOf(epicId: string): Issue[] {
    return this.projectService.childrenOf(epicId).filter(i => BOARD_TYPES.includes(i.type));
  }
  storyCount(epicId: string): number { return this.storiesOf(epicId).length; }
  doneCount(epicId: string): number { return this.storiesOf(epicId).filter(s => s.status === 'done').length; }
  progress(epicId: string): number {
    const total = this.storyCount(epicId);
    return total ? Math.round((this.doneCount(epicId) / total) * 100) : 0;
  }

  goBoard(): void { this.router.navigate(['/projects', this.pid(), 'board']); }
  openEpic(e: Issue): void { this.router.navigate(['/projects', this.pid(), 'epics', e.id]); }

  openCreate(): void {
    this.name.set('');
    this.color.set(EPIC_COLORS[0]);
    this.description.set('');
    this.showCreate.set(true);
  }
  closeCreate(): void { this.showCreate.set(false); }

  save(): void {
    const title = this.name().trim();
    if (!title) return;
    this.projectService.createIssue({
      projectId: this.pid(),
      type: 'epic',
      title,
      description: this.description().trim(),
      color: this.color(),
      status: 'todo',
      priority: 'medium',
    });
    this.showCreate.set(false);
  }
}
