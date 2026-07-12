import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectService } from '../../../core/services/project.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { WorkspaceSwitcherComponent } from '../../../shared/components/workspace-switcher/workspace-switcher.component';
import { Project, TeamMember } from '../../../core/models/project.model';
import { BOARD_TYPES } from '../task-meta';

const PROJECT_COLORS = ['#451de3', '#00c1fd', '#006688', '#15803d', '#ea580c', '#dc2626', '#7c3aed', '#0891b2'];
const PROJECT_ICONS = ['rocket_launch', 'web', 'campaign', 'handshake', 'code', 'design_services', 'analytics', 'shopping_cart', 'school', 'bolt'];

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [CommonModule, FormsModule, WorkspaceSwitcherComponent],
  template: `
    <div class="px-margin-page pt-stack-md pb-32">

      <!-- Workspace switcher (top layer) -->
      <div class="max-w-xs mb-4 rounded-xl border border-surface-container bg-surface-container-lowest">
        <app-workspace-switcher></app-workspace-switcher>
      </div>

      <!-- Header -->
      <div class="flex items-end justify-between mb-stack-lg">
        <div>
          <h1 class="font-bold text-[28px] text-on-surface tracking-tight" style="font-family:Manrope;">Projects</h1>
          <p class="text-[14px] text-on-surface-variant">In <span class="font-semibold text-on-surface">{{ ws.current()?.name }}</span></p>
        </div>
        <button (click)="openCreate()"
                class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[14px] font-bold text-white bg-gradient-to-tr from-primary to-secondary-container active:scale-95">
          <span class="material-symbols-outlined text-[20px]">add</span>New Project
        </button>
      </div>

      <!-- Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div *ngFor="let p of workspaceProjects()" (click)="openBoard(p.id)"
             class="bg-white rounded-2xl border border-surface-container p-5 cursor-pointer transition-all hover:shadow-[0px_12px_32px_rgba(94,67,251,0.08)] hover:-translate-y-0.5">
          <div class="flex items-center gap-3 mb-4">
            <span class="w-11 h-11 rounded-xl flex items-center justify-center text-white flex-shrink-0" [style.background]="p.color || '#451de3'">
              <span class="material-symbols-outlined text-[22px]">{{ p.icon || 'rocket_launch' }}</span>
            </span>
            <div class="min-w-0">
              <h3 class="text-[16px] font-bold text-on-surface truncate" style="font-family:Manrope;">{{ p.title }}</h3>
              <p class="text-[12px] font-semibold text-on-surface-variant">{{ p.keyPrefix }}</p>
            </div>
            <!-- Assignees -->
            <div class="ml-auto flex items-center flex-shrink-0">
              <div class="flex -space-x-2">
                <span *ngFor="let a of memberAvatars(p)" [title]="a.name"
                      class="w-7 h-7 rounded-full border-2 border-white overflow-hidden flex items-center justify-center text-white text-[9px] font-bold" [style.background]="a.color">
                  <img *ngIf="a.avatarUrl; else mInit" [src]="a.avatarUrl" [alt]="a.name" class="w-full h-full object-cover" />
                  <ng-template #mInit>{{ a.initials }}</ng-template>
                </span>
                <span *ngIf="p.moreMembers" class="w-7 h-7 rounded-full border-2 border-white bg-surface-container flex items-center justify-center text-[9px] font-bold text-on-surface-variant">+{{ p.moreMembers }}</span>
              </div>
              <span *ngIf="!memberAvatars(p).length" class="text-[11px] font-medium text-on-surface-variant">Unassigned</span>
            </div>
          </div>

          <div class="flex items-center gap-3 text-[12px] text-on-surface-variant mb-3">
            <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[15px]">bolt</span>{{ epicCount(p.id) }} epics</span>
            <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[15px]">bookmark</span>{{ storyCount(p.id) }} stories</span>
          </div>

          <div class="flex items-center justify-between gap-2">
            <div class="flex-1">
              <div class="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                <div class="h-full rounded-full bg-gradient-to-r from-primary to-secondary-container" [style.width.%]="p.progress || 0"></div>
              </div>
            </div>
            <span class="text-[12px] font-bold text-on-surface-variant">{{ p.progress || 0 }}%</span>
          </div>
        </div>

        <!-- New project card -->
        <button (click)="openCreate()"
                class="rounded-2xl border-2 border-dashed border-outline-variant p-5 min-h-[150px] flex flex-col items-center justify-center gap-2 text-on-surface-variant hover:border-primary/50 hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-[28px]">add_circle</span>
          <span class="text-[14px] font-bold">New Project</span>
        </button>
      </div>
    </div>

    <!-- Create modal -->
    <div *ngIf="showCreate()" class="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center" (click)="closeCreate()">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
      <div class="relative bg-white rounded-t-[28px] sm:rounded-[28px] w-full sm:max-w-lg max-h-[92vh] overflow-y-auto p-6 pb-10" style="box-shadow:0 -8px 40px rgba(0,0,0,0.12);" (click)="$event.stopPropagation()">
        <div class="w-12 h-1 rounded-full bg-outline-variant mx-auto mb-6 sm:hidden"></div>
        <h3 class="font-bold text-[22px] text-on-surface mb-5" style="font-family:Manrope;">Create Project</h3>

        <!-- Name + Key -->
        <div class="grid grid-cols-3 gap-3 mb-4">
          <div class="col-span-2">
            <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Name</label>
            <input type="text" [ngModel]="name()" (ngModelChange)="onNameChange($event)" placeholder="e.g. Website Redesign"
                   class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[15px] font-medium outline-none border border-transparent focus:border-primary/30" />
          </div>
          <div>
            <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Key</label>
            <input type="text" [ngModel]="key()" (ngModelChange)="onKeyChange($event)" maxlength="4" placeholder="WR"
                   class="w-full px-3 py-3 rounded-2xl bg-surface-container text-on-surface text-[15px] font-bold uppercase outline-none border border-transparent focus:border-primary/30" />
          </div>
        </div>

        <!-- Icon -->
        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-2 block">Icon</label>
          <div class="flex flex-wrap gap-2">
            <button *ngFor="let ic of icons" (click)="icon.set(ic)"
                    class="w-10 h-10 rounded-xl flex items-center justify-center transition-all border-2"
                    [style.background]="icon() === ic ? color() : '#f1f1f3'"
                    [style.borderColor]="icon() === ic ? color() : 'transparent'">
              <span class="material-symbols-outlined text-[20px]" [style.color]="icon() === ic ? '#fff' : '#43474a'">{{ ic }}</span>
            </button>
          </div>
        </div>

        <!-- Color -->
        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-2 block">Color</label>
          <div class="flex flex-wrap gap-2">
            <button *ngFor="let c of colors" (click)="color.set(c)"
                    class="w-8 h-8 rounded-full transition-all border-2"
                    [style.background]="c" [style.borderColor]="color() === c ? '#1c1b1f' : 'transparent'"
                    [class.scale-110]="color() === c"></button>
          </div>
        </div>

        <!-- Lead -->
        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Lead (optional)</label>
          <select [ngModel]="leadId()" (ngModelChange)="leadId.set($event)"
                  class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[15px] font-medium outline-none">
            <option value="">Unassigned</option>
            <option *ngFor="let m of team" [value]="m.id">{{ m.name }}</option>
          </select>
        </div>

        <!-- Description -->
        <div class="mb-6">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Description</label>
          <textarea [ngModel]="description()" (ngModelChange)="description.set($event)" rows="2" placeholder="What is this project about?"
                    class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[15px] outline-none border border-transparent focus:border-primary/30 resize-none"></textarea>
        </div>

        <div class="flex gap-3">
          <button (click)="closeCreate()" class="flex-1 py-3.5 rounded-2xl bg-surface-container text-on-surface-variant text-[14px] font-bold active:scale-95">Cancel</button>
          <button (click)="save()" [disabled]="!name().trim() || !key().trim()"
                  class="flex-1 py-3.5 rounded-2xl text-white text-[14px] font-bold bg-gradient-to-tr from-primary to-secondary-container active:scale-95 disabled:opacity-40">Create project</button>
        </div>
      </div>
    </div>
  `,
})
export class ProjectsPageComponent implements OnInit {
  private projectService = inject(ProjectService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  readonly ws = inject(WorkspaceService);

  readonly colors = PROJECT_COLORS;
  readonly icons = PROJECT_ICONS;
  readonly team: TeamMember[] = this.projectService.teamMembers;

  projects = this.projectService.projects;
  /** Projects in the currently selected workspace. */
  workspaceProjects = computed(() => this.projects().filter(p => this.ws.isInCurrent(p.workspaceId)));

  // create form
  showCreate = signal(false);
  name = signal('');
  key = signal('');
  private keyEdited = false;
  icon = signal(PROJECT_ICONS[0]);
  color = signal(PROJECT_COLORS[0]);
  leadId = signal('');
  description = signal('');

  ngOnInit(): void {
    this.projectService.load();
    this.ws.load();
    if (this.route.snapshot.queryParamMap.get('new') !== null) this.openCreate();
  }

  /** Resolve a project's stored member initials to team members (for avatar + color). */
  memberAvatars(p: Project): { initials: string; color: string; name: string; avatarUrl?: string }[] {
    return (p.members ?? []).map(init => {
      const m = this.team.find(t => t.initials === init);
      return m
        ? { initials: m.initials, color: m.color, name: m.name, avatarUrl: m.avatarUrl }
        : { initials: init, color: '#9aa0a6', name: init };
    });
  }

  epicCount(pid: string): number { return this.projectService.epicsOf(pid).length; }
  storyCount(pid: string): number {
    return this.projectService.issuesByProject(pid).filter(i => BOARD_TYPES.includes(i.type)).length;
  }

  openBoard(id: string): void { this.router.navigate(['/projects', id, 'board']); }

  openCreate(): void {
    this.name.set('');
    this.key.set('');
    this.keyEdited = false;
    this.icon.set(PROJECT_ICONS[0]);
    this.color.set(PROJECT_COLORS[0]);
    this.leadId.set('');
    this.description.set('');
    this.showCreate.set(true);
  }
  closeCreate(): void { this.showCreate.set(false); }

  onNameChange(v: string): void {
    this.name.set(v);
    if (!this.keyEdited) this.key.set(this.deriveKey(v));
  }
  onKeyChange(v: string): void {
    this.keyEdited = true;
    this.key.set(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4));
  }
  private deriveKey(title: string): string {
    const letters = title.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').join('');
    return (letters || title.slice(0, 2).toUpperCase()).slice(0, 4);
  }

  save(): void {
    const name = this.name().trim();
    const key = this.key().trim();
    if (!name || !key) return;
    const today = new Date();
    const due = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const created = this.projectService.createProject({
      title: name,
      keyPrefix: key,
      description: this.description().trim(),
      priority: 'medium',
      startDate: today.toISOString().split('T')[0],
      dueDate: due.toISOString().split('T')[0],
      assigneeIds: this.leadId() ? [this.leadId()] : [],
      tags: [],
      color: this.color(),
      icon: this.icon(),
      workspaceId: this.ws.currentId(),
    });
    this.showCreate.set(false);
    this.router.navigate(['/projects', created.id, 'board']);
  }
}
