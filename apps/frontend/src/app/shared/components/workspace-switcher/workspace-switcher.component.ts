import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { ProjectService } from '../../../core/services/project.service';

const WS_COLORS = ['#451de3', '#00c1fd', '#006688', '#15803d', '#ea580c', '#dc2626', '#7c3aed', '#0891b2'];
const WS_ICONS = ['apartment', 'rocket_launch', 'workspaces', 'diversity_3', 'storefront', 'school', 'science', 'palette'];

@Component({
  selector: 'app-workspace-switcher',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="relative">
      <!-- Trigger -->
      <button (click)="open.set(!open())"
              class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-surface-container-low transition-colors text-left">
        <span class="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0" [style.background]="ws.current()?.color || '#451de3'">
          <span class="material-symbols-outlined text-[18px]">{{ ws.current()?.icon || 'workspaces' }}</span>
        </span>
        <span class="flex-1 min-w-0">
          <span class="block text-[10px] font-bold uppercase tracking-wider text-outline">Workspace</span>
          <span class="block text-[14px] font-bold text-on-surface truncate">{{ ws.current()?.name || 'Workspace' }}</span>
        </span>
        <span class="material-symbols-outlined text-[20px] text-on-surface-variant">unfold_more</span>
      </button>

      <!-- Dropdown -->
      <div *ngIf="open()" class="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl py-1 z-40" style="box-shadow:0 12px 40px rgba(0,0,0,0.18);">
        <p class="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-outline">Your workspaces</p>
        <button *ngFor="let w of ws.workspaces()" (click)="choose(w.id)"
                class="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-container-low">
          <span class="w-7 h-7 rounded-lg flex items-center justify-center text-white flex-shrink-0" [style.background]="w.color">
            <span class="material-symbols-outlined text-[16px]">{{ w.icon || 'workspaces' }}</span>
          </span>
          <span class="flex-1 text-[13px] font-semibold text-on-surface truncate">{{ w.name }}</span>
          <span *ngIf="w.id === ws.currentId()" class="material-symbols-outlined text-[18px] text-primary">check</span>
        </button>
        <div class="border-t border-surface-container my-1"></div>
        <button (click)="viewAll()" class="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-container-low text-on-surface-variant">
          <span class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"><span class="material-symbols-outlined text-[18px]">grid_view</span></span>
          <span class="text-[13px] font-semibold">View all workspaces</span>
        </button>
        <button (click)="openCreate()" class="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-container-low text-primary">
          <span class="w-7 h-7 rounded-lg flex items-center justify-center border border-dashed border-primary/40 flex-shrink-0">
            <span class="material-symbols-outlined text-[16px]">add</span>
          </span>
          <span class="text-[13px] font-bold">Create workspace</span>
        </button>
      </div>

      <!-- click-away -->
      <div *ngIf="open()" class="fixed inset-0 z-30" (click)="open.set(false)"></div>
    </div>

    <!-- Create modal -->
    <div *ngIf="showCreate()" class="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center" (click)="closeCreate()">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
      <div class="relative bg-white rounded-t-[28px] sm:rounded-[28px] w-full sm:max-w-md max-h-[92vh] overflow-y-auto p-6 pb-10" style="box-shadow:0 -8px 40px rgba(0,0,0,0.12);" (click)="$event.stopPropagation()">
        <div class="w-12 h-1 rounded-full bg-outline-variant mx-auto mb-6 sm:hidden"></div>
        <h3 class="font-bold text-[22px] text-on-surface mb-5" style="font-family:Manrope;">Create Workspace</h3>

        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Name</label>
          <input type="text" [ngModel]="name()" (ngModelChange)="name.set($event)" placeholder="e.g. Acme Inc"
                 class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[15px] font-medium outline-none border border-transparent focus:border-primary/30" />
        </div>

        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-2 block">Icon</label>
          <div class="flex flex-wrap gap-2">
            <button *ngFor="let ic of wsIcons" (click)="icon.set(ic)"
                    class="w-10 h-10 rounded-xl flex items-center justify-center border-2"
                    [style.background]="icon() === ic ? color() : '#f1f1f3'" [style.borderColor]="icon() === ic ? color() : 'transparent'">
              <span class="material-symbols-outlined text-[20px]" [style.color]="icon() === ic ? '#fff' : '#43474a'">{{ ic }}</span>
            </button>
          </div>
        </div>

        <div class="mb-6">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-2 block">Color</label>
          <div class="flex flex-wrap gap-2">
            <button *ngFor="let c of wsColors" (click)="color.set(c)"
                    class="w-8 h-8 rounded-full border-2" [style.background]="c" [style.borderColor]="color() === c ? '#1c1b1f' : 'transparent'" [class.scale-110]="color() === c"></button>
          </div>
        </div>

        <div class="flex gap-3">
          <button (click)="closeCreate()" class="flex-1 py-3.5 rounded-2xl bg-surface-container text-on-surface-variant text-[14px] font-bold active:scale-95">Cancel</button>
          <button (click)="save()" [disabled]="!name().trim()"
                  class="flex-1 py-3.5 rounded-2xl text-white text-[14px] font-bold bg-gradient-to-tr from-primary to-secondary-container active:scale-95 disabled:opacity-40">Create</button>
        </div>
      </div>
    </div>
  `,
})
export class WorkspaceSwitcherComponent {
  readonly ws = inject(WorkspaceService);
  private projectService = inject(ProjectService);
  private router = inject(Router);

  readonly wsColors = WS_COLORS;
  readonly wsIcons = WS_ICONS;

  open = signal(false);
  showCreate = signal(false);
  name = signal('');
  icon = signal(WS_ICONS[0]);
  color = signal(WS_COLORS[0]);

  constructor() {
    this.ws.load();
    this.projectService.load();
  }

  choose(id: string): void {
    this.open.set(false);
    if (id === this.ws.currentId()) return;
    this.ws.setCurrent(id);
    this.openWorkspace(id);
  }

  /** Open a workspace on its board (first project), or the projects gallery if it has none. */
  private openWorkspace(wsId: string): void {
    const defaultId = this.ws.workspaces()[0]?.id;
    const first = this.projectService.projects().find(p => (p.workspaceId ?? defaultId) === wsId);
    if (first) this.router.navigate(['/projects', first.id, 'board']);
    else this.router.navigate(['/projects/all']);
  }

  viewAll(): void {
    this.open.set(false);
    this.router.navigate(['/projects/workspaces']);
  }

  openCreate(): void {
    this.open.set(false);
    this.name.set('');
    this.icon.set(WS_ICONS[0]);
    this.color.set(WS_COLORS[0]);
    this.showCreate.set(true);
  }
  closeCreate(): void { this.showCreate.set(false); }

  save(): void {
    if (!this.name().trim()) return;
    const created = this.ws.create({ name: this.name(), color: this.color(), icon: this.icon() });
    this.showCreate.set(false);
    // A brand-new workspace has no projects yet → land on the gallery to create one.
    this.openWorkspace(created.id);
  }
}
