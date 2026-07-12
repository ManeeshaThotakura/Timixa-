import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../../core/services/project.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { Workspace } from '../../../core/models/project.model';

const WS_COLORS = ['#451de3', '#00c1fd', '#006688', '#15803d', '#ea580c', '#dc2626', '#7c3aed', '#0891b2'];
const WS_ICONS = ['apartment', 'rocket_launch', 'workspaces', 'diversity_3', 'storefront', 'school', 'science', 'palette'];

@Component({
  selector: 'app-workspaces-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="px-margin-page pt-stack-md pb-32">

      <!-- Header -->
      <div class="flex items-end justify-between mb-stack-lg">
        <div>
          <h1 class="font-bold text-[28px] text-on-surface tracking-tight" style="font-family:Manrope;">Workspaces</h1>
          <p class="text-[14px] text-on-surface-variant">Switch between your workspaces</p>
        </div>
        <button (click)="openCreate()"
                class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[14px] font-bold text-white bg-gradient-to-tr from-primary to-secondary-container active:scale-95">
          <span class="material-symbols-outlined text-[20px]">add</span>New Workspace
        </button>
      </div>

      <!-- Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div *ngFor="let w of ws.workspaces()" (click)="openWorkspace(w.id)"
             class="bg-white rounded-2xl border p-5 cursor-pointer transition-all hover:shadow-[0px_12px_32px_rgba(94,67,251,0.08)] hover:-translate-y-0.5"
             [class.border-primary]="w.id === ws.currentId()" [class.border-surface-container]="w.id !== ws.currentId()">
          <div class="flex items-center gap-3 mb-3">
            <span class="w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0" [style.background]="w.color">
              <span class="material-symbols-outlined text-[24px]">{{ w.icon || 'workspaces' }}</span>
            </span>
            <div class="min-w-0">
              <h3 class="text-[16px] font-bold text-on-surface truncate" style="font-family:Manrope;">{{ w.name }}</h3>
              <p class="text-[12px] font-semibold text-on-surface-variant">{{ projectCount(w.id) }} projects</p>
            </div>
            <span *ngIf="w.id === ws.currentId()" class="ml-auto text-[11px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">Current</span>
          </div>
          <div class="flex items-center gap-1 text-[13px] font-semibold text-primary">
            Open<span class="material-symbols-outlined text-[18px]">arrow_forward</span>
          </div>
        </div>

        <!-- New workspace card -->
        <button (click)="openCreate()"
                class="rounded-2xl border-2 border-dashed border-outline-variant p-5 min-h-[140px] flex flex-col items-center justify-center gap-2 text-on-surface-variant hover:border-primary/50 hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-[28px]">add_circle</span>
          <span class="text-[14px] font-bold">New Workspace</span>
        </button>
      </div>
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
            <button *ngFor="let ic of icons" (click)="icon.set(ic)"
                    class="w-10 h-10 rounded-xl flex items-center justify-center border-2"
                    [style.background]="icon() === ic ? color() : '#f1f1f3'" [style.borderColor]="icon() === ic ? color() : 'transparent'">
              <span class="material-symbols-outlined text-[20px]" [style.color]="icon() === ic ? '#fff' : '#43474a'">{{ ic }}</span>
            </button>
          </div>
        </div>

        <div class="mb-6">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-2 block">Color</label>
          <div class="flex flex-wrap gap-2">
            <button *ngFor="let c of colors" (click)="color.set(c)"
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
export class WorkspacesPageComponent implements OnInit {
  readonly ws = inject(WorkspaceService);
  private projectService = inject(ProjectService);
  private router = inject(Router);

  readonly colors = WS_COLORS;
  readonly icons = WS_ICONS;

  showCreate = signal(false);
  name = signal('');
  icon = signal(WS_ICONS[0]);
  color = signal(WS_COLORS[0]);

  ngOnInit(): void {
    this.ws.load();
    this.projectService.load();
  }

  projectCount(wsId: string): number {
    const defaultId = this.ws.workspaces()[0]?.id;
    return this.projectService.projects().filter(p => (p.workspaceId ?? defaultId) === wsId).length;
  }

  openWorkspace(id: string): void {
    this.ws.setCurrent(id);
    const defaultId = this.ws.workspaces()[0]?.id;
    const first = this.projectService.projects().find(p => (p.workspaceId ?? defaultId) === id);
    if (first) this.router.navigate(['/projects', first.id, 'board']);
    else this.router.navigate(['/projects/all']);
  }

  openCreate(): void {
    this.name.set('');
    this.icon.set(WS_ICONS[0]);
    this.color.set(WS_COLORS[0]);
    this.showCreate.set(true);
  }
  closeCreate(): void { this.showCreate.set(false); }

  save(): void {
    if (!this.name().trim()) return;
    this.ws.create({ name: this.name(), color: this.color(), icon: this.icon() });
    this.showCreate.set(false);
    // New workspace has no projects yet → land on the gallery to create one.
    this.router.navigate(['/projects/all']);
  }
}
