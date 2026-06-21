import { Component, OnInit, inject, computed, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ProjectService } from '../../../core/services/project.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { WorkspaceSwitcherComponent } from '../../../shared/components/workspace-switcher/workspace-switcher.component';
import { Issue, IssueType, IssueStatus, IssuePriority, TeamMember, TaskResolution } from '../../../core/models/project.model';
import {
  ISSUE_TYPES, RESOLUTIONS, PRIORITIES, STATUSES, BOARD_TYPES,
  IssueTypeDef, ResolutionDef, PriorityDef, StatusDef,
  issueTypeInfo, priorityInfo, statusInfo, resolutionInfo,
} from '../task-meta';

interface BoardColumn {
  id: IssueStatus;
  label: string;
  statuses: IssueStatus[];
}

@Component({
  selector: 'app-project-kanban',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, WorkspaceSwitcherComponent],
  styles: [`
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `],
  template: `
    <div class="flex min-h-[calc(100vh-180px)]">

      <!-- ── Sidebar (desktop) ─────────────────────────────────────── -->
      <aside class="hidden md:flex flex-col w-60 flex-shrink-0 border-r border-surface-container bg-surface-container-lowest">
        <ng-container *ngTemplateOutlet="sidebar"></ng-container>
      </aside>

      <!-- ── Sidebar (mobile drawer) ───────────────────────────────── -->
      <div *ngIf="sidebarOpen()" class="md:hidden fixed inset-0 z-50" (click)="sidebarOpen.set(false)">
        <div class="absolute inset-0 bg-black/30"></div>
        <aside class="absolute left-0 top-0 bottom-0 w-64 bg-surface-container-lowest flex flex-col" (click)="$event.stopPropagation()">
          <ng-container *ngTemplateOutlet="sidebar"></ng-container>
        </aside>
      </div>

      <!-- ── Main ──────────────────────────────────────────────────── -->
      <main class="flex-1 min-w-0 flex flex-col">

        <!-- Tabs row -->
        <div class="flex items-center gap-1 px-4 pt-3 border-b border-surface-container">
          <button (click)="sidebarOpen.set(true)" class="md:hidden w-9 h-9 -ml-1 flex items-center justify-center rounded-lg hover:bg-surface-container-low">
            <span class="material-symbols-outlined">menu</span>
          </button>
          <button (click)="tab.set('sprint')"
                  class="px-4 py-2.5 text-[13px] font-bold border-b-2 -mb-px transition-colors"
                  [class]="tab() === 'sprint' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-on-surface'">
            Active Sprint
          </button>
          <button (click)="tab.set('backlog')"
                  class="px-4 py-2.5 text-[13px] font-bold border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5"
                  [class]="tab() === 'backlog' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-on-surface'">
            Backlog
            <span class="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-surface-container text-on-surface-variant">{{ backlogStories().length }}</span>
          </button>
        </div>

        <!-- Filter bar -->
        <div class="flex items-center gap-3 px-4 py-2.5 flex-wrap">
          <div class="relative">
            <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">search</span>
            <input [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" placeholder="Search board"
                   class="w-48 pl-9 pr-3 py-1.5 rounded-lg bg-surface-container text-on-surface text-[13px] outline-none border border-transparent focus:border-primary/30" />
          </div>

          <!-- Assignee filter avatars -->
          <div class="flex items-center -space-x-1.5">
            <button (click)="filterAssignee.set('all')" title="All assignees"
                    class="w-8 h-8 rounded-full border-2 flex items-center justify-center bg-surface-container transition-all"
                    [class]="filterAssignee() === 'all' ? 'border-primary z-10' : 'border-white hover:border-outline-variant'">
              <span class="material-symbols-outlined text-[16px] text-on-surface-variant">groups</span>
            </button>
            <button *ngFor="let m of projectMembers()" (click)="toggleAssignee(m.id)" [title]="m.name"
                    class="w-8 h-8 rounded-full border-2 overflow-hidden flex items-center justify-center text-white text-[10px] font-bold transition-all"
                    [style.background]="m.color"
                    [class]="filterAssignee() === m.id ? 'border-primary z-10 scale-110' : 'border-white hover:scale-105'">
              <img *ngIf="m.avatarUrl; else fInit" [src]="m.avatarUrl" [alt]="m.name" class="w-full h-full object-cover" />
              <ng-template #fInit>{{ m.initials }}</ng-template>
            </button>
          </div>

          <!-- Epic filter dropdown -->
          <div class="relative">
            <button (click)="epicMenuOpen.set(!epicMenuOpen())"
                    class="inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-lg text-[13px] font-semibold border transition-colors"
                    [class]="filterEpic() !== 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-surface-container-high bg-surface-container text-on-surface-variant hover:bg-surface-container-high'">
              <span *ngIf="filterEpic() !== 'all' && epicById(filterEpic()) as e" class="w-2 h-2 rounded-full" [style.background]="e.color || '#7c3aed'"></span>
              <span class="material-symbols-outlined text-[16px]" *ngIf="filterEpic() === 'all'">bolt</span>
              {{ filterEpic() !== 'all' && epicById(filterEpic()) ? epicById(filterEpic())!.title : 'Epic' }}
              <span class="material-symbols-outlined text-[16px]">expand_more</span>
            </button>
            <div *ngIf="epicMenuOpen()" class="absolute left-0 top-full mt-1 w-56 bg-white rounded-xl py-1 z-30 max-h-72 overflow-y-auto" style="box-shadow:0 8px 30px rgba(0,0,0,0.15);">
              <button (click)="selectEpic('all')"
                      class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-container-low text-[13px] font-semibold"
                      [class.text-primary]="filterEpic() === 'all'">
                <span class="material-symbols-outlined text-[18px]">bolt</span>All epics
              </button>
              <button *ngFor="let e of epics()" (click)="selectEpic(e.id)"
                      class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-container-low text-[13px] font-semibold"
                      [class.text-primary]="filterEpic() === e.id">
                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" [style.background]="e.color || '#7c3aed'"></span>
                <span class="flex-1 truncate">{{ e.title }}</span>
                <span class="text-[11px] text-on-surface-variant">{{ epicStoryCount(e.id) }}</span>
              </button>
              <p *ngIf="!epics().length" class="px-3 py-2 text-[12px] text-on-surface-variant">No epics yet.</p>

              <div class="border-t border-surface-container my-1"></div>
              <button (click)="epicMenuOpen.set(false); go('/projects/' + projectId() + '/epics')"
                      class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-container-low text-[13px] font-semibold text-on-surface-variant">
                <span class="material-symbols-outlined text-[18px]">list</span>View all epics
              </button>
              <button (click)="epicMenuOpen.set(false); go('/projects/' + projectId() + '/epics', { new: 1 })"
                      class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-container-low text-[13px] font-bold text-primary">
                <span class="material-symbols-outlined text-[18px]">add</span>Create epic
              </button>
            </div>
          </div>

          <button (click)="openAddIssue('todo')"
                  class="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[13px] font-bold text-white bg-gradient-to-tr from-primary to-secondary-container active:scale-95">
            <span class="material-symbols-outlined text-[18px]">add</span>Create
          </button>
        </div>

        <!-- ── ACTIVE SPRINT (story list + subtask columns) ───────── -->
        <div *ngIf="tab() === 'sprint'" class="flex-1 overflow-y-auto px-4 pb-8">
          <div class="space-y-2">

            <!-- Column headers -->
            <div class="grid grid-cols-3 gap-3 px-3 py-2 sticky top-0 z-10 bg-surface-container-lowest/95 backdrop-blur-sm rounded-lg border border-surface-container">
              <div *ngFor="let col of columns" class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full" [style.background]="statusColor(col.id)"></span>
                <span class="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{{ col.label }}</span>
                <span class="px-1.5 rounded-full bg-surface-container text-[10px] font-bold text-on-surface-variant">{{ sprintColCount(col) }}</span>
              </div>
            </div>

            <div *ngFor="let story of sprintStories()" class="bg-white rounded-xl border border-surface-container shadow-[0px_4px_16px_rgba(94,67,251,0.04)]">
              <!-- Story row (slim) -->
              <div class="flex items-center gap-2.5 px-3 py-2.5">
                <!-- collapse chevron -->
                <button (click)="toggleCollapse(story.id)" class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-surface-container-low"
                        [class.invisible]="!subtasksOf(story).length">
                  <span class="material-symbols-outlined text-[18px] text-on-surface-variant transition-transform" [style.transform]="isCollapsed(story.id) ? 'rotate(-90deg)' : 'none'">expand_more</span>
                </button>

                <span class="text-[10px] px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1 flex-shrink-0" [style.background]="typeOf(story).bg" [style.color]="typeOf(story).color">
                  <span class="material-symbols-outlined text-[12px]">{{ typeOf(story).icon }}</span>{{ typeOf(story).short }}
                </span>

                <span class="text-[12px] font-bold text-on-surface-variant flex-shrink-0 hidden sm:inline">{{ story.key }}</span>

                <span (click)="openIssue(story)"
                      class="flex-1 min-w-0 text-[14px] font-semibold text-on-surface truncate cursor-pointer hover:text-primary" [class.line-through]="story.status === 'done'" [class.text-on-surface-variant]="story.status === 'done'">{{ story.title }}</span>

                <!-- subtask count -->
                <span *ngIf="subCount(story).total" class="text-[11px] text-on-surface-variant flex items-center gap-0.5 flex-shrink-0 hidden sm:flex">
                  <span class="material-symbols-outlined text-[14px]">checklist</span>{{ subCount(story).done }}/{{ subCount(story).total }}
                </span>

                <!-- priority -->
                <span class="material-symbols-outlined text-[16px] flex-shrink-0" [style.color]="prioOf(story).color" [title]="prioOf(story).label">{{ prioOf(story).icon }}</span>

                <!-- status label (click to change) -->
                <div class="relative flex-shrink-0">
                  <button (click)="toggleStatusMenu(story.id)"
                          class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide"
                          [style.background]="statusOf(story).bg" [style.color]="statusOf(story).color">
                    {{ statusOf(story).label }}
                    <span class="material-symbols-outlined text-[14px]">expand_more</span>
                  </button>
                  <div *ngIf="statusMenuFor() === story.id" class="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl py-1 z-30" style="box-shadow:0 8px 30px rgba(0,0,0,0.15);">
                    <button *ngFor="let s of sprintStatuses" (click)="setStatus(story, s.id)"
                            class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-container-low text-[12px] font-semibold">
                      <span class="material-symbols-outlined text-[16px]" [style.color]="s.color">{{ s.icon }}</span>{{ s.label }}
                    </button>
                  </div>
                </div>

                <!-- assignee -->
                <span class="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                      *ngIf="memberOf(story) as m; else unassigned" [style.background]="m.color" [title]="m.name">
                  <img *ngIf="m.avatarUrl; else cInit" [src]="m.avatarUrl" [alt]="m.name" class="w-full h-full object-cover" />
                  <ng-template #cInit>{{ m.initials }}</ng-template>
                </span>
                <ng-template #unassigned>
                  <span class="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant flex-shrink-0" title="Unassigned"><span class="material-symbols-outlined text-[14px]">person</span></span>
                </ng-template>
              </div>

              <!-- Subtasks bucketed into To Do / In Progress / Done columns (draggable) -->
              <div *ngIf="!isCollapsed(story.id) && subtasksOf(story).length"
                   class="border-t border-surface-container p-3 grid grid-cols-3 gap-3 bg-surface-container/30 rounded-b-xl" cdkDropListGroup>
                <div *ngFor="let col of columns"
                     cdkDropList [cdkDropListData]="subtasksForCol(story, col)"
                     (cdkDropListDropped)="onSubtaskDrop($event, col)"
                     class="space-y-2 min-h-[72px] rounded-lg pt-2" [style.border-top]="'2px solid ' + statusColor(col.id) + '33'">
                  <div *ngFor="let sub of subtasksForCol(story, col)" cdkDrag
                       class="bg-white rounded-lg border border-surface-container p-2.5 shadow-[0px_2px_8px_rgba(94,67,251,0.04)] cursor-grab active:cursor-grabbing">
                    <div class="flex items-center justify-between mb-1.5">
                      <span class="text-[9px] px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1" [style.background]="subType.bg" [style.color]="subType.color">
                        <span class="material-symbols-outlined text-[11px]">{{ subType.icon }}</span>{{ subType.short }}
                      </span>
                      <span class="text-[10px] font-bold text-on-surface-variant">{{ sub.key }}</span>
                    </div>
                    <p (click)="openSubtask(story, sub)"
                       class="text-[13px] leading-snug font-medium text-on-surface cursor-pointer hover:text-primary mb-2" [class.line-through]="sub.status === 'done'" [class.text-on-surface-variant]="sub.status === 'done'">{{ sub.title }}</p>
                    <div class="flex items-center justify-between">
                      <span class="material-symbols-outlined text-[15px]" [style.color]="prioOf(sub).color" [title]="prioOf(sub).label">{{ prioOf(sub).icon }}</span>
                      <span *ngIf="memberOf(sub) as m" class="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center text-white text-[8px] font-bold" [style.background]="m.color" [title]="m.name">
                        <img *ngIf="m.avatarUrl; else sI" [src]="m.avatarUrl" [alt]="m.name" class="w-full h-full object-cover" /><ng-template #sI>{{ m.initials }}</ng-template>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p *ngIf="!sprintStories().length" class="text-center text-[13px] text-on-surface-variant py-10">No issues in the sprint.</p>
          </div>
        </div>

        <!-- click-away for popovers -->
        <div *ngIf="statusMenuFor()" class="fixed inset-0 z-20" (click)="statusMenuFor.set(null)"></div>
        <div *ngIf="epicMenuOpen()" class="fixed inset-0 z-20" (click)="epicMenuOpen.set(false)"></div>

        <!-- ── BACKLOG (list) ─────────────────────────────────────── -->
        <div *ngIf="tab() === 'backlog'" class="flex-1 overflow-y-auto px-4 pb-8">
          <div class="space-y-2 max-w-3xl">
            <div *ngFor="let story of backlogStories()" class="bg-white rounded-xl border border-surface-container shadow-[0px_4px_16px_rgba(94,67,251,0.04)]">
              <div class="flex items-center gap-3 p-3 cursor-pointer" (click)="openIssue(story)">
                <span class="text-[10px] px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1 flex-shrink-0" [style.background]="typeOf(story).bg" [style.color]="typeOf(story).color">
                  <span class="material-symbols-outlined text-[12px]">{{ typeOf(story).icon }}</span>{{ typeOf(story).short }}
                </span>
                <span class="text-[12px] font-bold text-on-surface-variant flex-shrink-0">{{ story.key }}</span>
                <span class="flex-1 text-[14px] font-semibold text-on-surface truncate">{{ story.title }}</span>
                <span class="material-symbols-outlined text-[16px] flex-shrink-0" [style.color]="prioOf(story).color" [title]="prioOf(story).label">{{ prioOf(story).icon }}</span>
                <span *ngIf="subCount(story).total" class="text-[11px] text-on-surface-variant flex items-center gap-0.5 flex-shrink-0"><span class="material-symbols-outlined text-[14px]">checklist</span>{{ subCount(story).done }}/{{ subCount(story).total }}</span>
                <span class="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" *ngIf="memberOf(story) as m; else unA" [style.background]="m.color" [title]="m.name">
                  <img *ngIf="m.avatarUrl; else bI" [src]="m.avatarUrl" [alt]="m.name" class="w-full h-full object-cover" /><ng-template #bI>{{ m.initials }}</ng-template>
                </span>
                <ng-template #unA><span class="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant flex-shrink-0"><span class="material-symbols-outlined text-[14px]">person</span></span></ng-template>
              </div>
            </div>
            <p *ngIf="!backlogStories().length" class="text-center text-[13px] text-on-surface-variant py-10">Backlog is empty.</p>
          </div>
        </div>
      </main>
    </div>

    <!-- ── Sidebar template ─────────────────────────────────────────── -->
    <ng-template #sidebar>
      <!-- Workspace switcher (top layer) -->
      <div class="px-2 py-2 border-b border-surface-container">
        <app-workspace-switcher></app-workspace-switcher>
      </div>

      <div class="flex-1 overflow-y-auto py-2">
        <!-- Projects -->
        <div class="flex items-center justify-between px-4 pt-2 pb-1">
          <p class="text-[10px] font-bold uppercase tracking-wider text-outline">Projects</p>
          <button (click)="go('/projects/all')" class="text-[11px] font-bold text-primary hover:underline">View all</button>
        </div>
        <button *ngFor="let p of projects()" (click)="selectProject(p.id)"
                class="w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors"
                [class]="p.id === projectId() ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container-low'">
          <span class="w-6 h-6 rounded-md flex items-center justify-center text-white flex-shrink-0 text-[14px]" [style.background]="p.color || '#451de3'">
            <span class="material-symbols-outlined text-[14px]">{{ p.icon || 'rocket_launch' }}</span>
          </span>
          <span class="text-[13px] font-semibold truncate">{{ p.title }}</span>
        </button>
        <button (click)="go('/projects/all', { new: 1 })"
                class="w-full flex items-center gap-2.5 px-4 py-2 text-left text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors">
          <span class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 border border-dashed border-outline-variant">
            <span class="material-symbols-outlined text-[16px]">add</span>
          </span>
          <span class="text-[13px] font-semibold">New project</span>
        </button>
      </div>

      <!-- Footer links -->
      <div class="border-t border-surface-container py-2">
        <button (click)="go('/projects/dashboard')" class="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] font-semibold text-on-surface-variant hover:bg-surface-container-low text-left">
          <span class="material-symbols-outlined text-[18px]">dashboard</span>Dashboard
        </button>
        <button (click)="go('/projects/my-work')" class="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] font-semibold text-on-surface-variant hover:bg-surface-container-low text-left">
          <span class="material-symbols-outlined text-[18px]">assignment_ind</span>My Work
        </button>
      </div>
    </ng-template>

    <!-- Add Issue modal -->
    <div *ngIf="showAddModal" class="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center" (click)="showAddModal = false">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
      <div class="relative bg-white rounded-t-[28px] sm:rounded-[28px] w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-6 pb-10" style="box-shadow:0 -8px 40px rgba(0,0,0,0.12);" (click)="$event.stopPropagation()">
        <div class="w-12 h-1 rounded-full bg-outline-variant mx-auto mb-6 sm:hidden"></div>
        <h3 class="font-bold text-[22px] text-on-surface mb-1 font-manrope">New Story</h3>
        <p class="text-[13px] text-on-surface-variant mb-5 flex items-center gap-1">
          <span class="material-symbols-outlined text-[16px]" style="color:#16a34a;">bookmark</span>A user story under an epic.
        </p>

        <!-- Epic (required) -->
        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Epic <span class="text-error">*</span></label>
          <ng-container *ngIf="epics().length; else noEpics">
            <select [(ngModel)]="form.epicId" class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[15px] font-medium outline-none">
              <option value="" disabled>Select an epic…</option>
              <option *ngFor="let e of epics()" [value]="e.id">{{ e.title }}</option>
            </select>
          </ng-container>
          <ng-template #noEpics>
            <div class="rounded-2xl bg-surface-container p-4 flex flex-col items-start gap-2">
              <p class="text-[13px] text-on-surface-variant">A story must belong to an epic, and this project has none yet.</p>
              <button (click)="createEpicFirst()" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold text-white bg-gradient-to-tr from-primary to-secondary-container active:scale-95">
                <span class="material-symbols-outlined text-[18px]">bolt</span>Create an epic first
              </button>
            </div>
          </ng-template>
        </div>

        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Title</label>
          <input type="text" [(ngModel)]="form.title" placeholder="What does the user want to do?"
                 class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[16px] font-medium outline-none border border-transparent focus:border-primary/30" />
        </div>

        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-2 block">Status</label>
          <div class="bg-surface-container p-1 rounded-2xl flex gap-1">
            <button *ngFor="let s of columns" (click)="form.status = s.id"
                    class="flex-1 py-2.5 rounded-xl font-semibold text-[12px] transition-all"
                    [class]="form.status === s.id ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant'">{{ s.label }}</button>
          </div>
        </div>

        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-2 block">Priority</label>
          <div class="bg-surface-container p-1 rounded-2xl flex gap-1">
            <button *ngFor="let p of priorities" (click)="form.priority = p.id"
                    class="flex-1 py-2 rounded-xl font-semibold text-[12px] transition-all flex items-center justify-center"
                    [class]="form.priority === p.id ? 'bg-white shadow-sm' : 'text-on-surface-variant'"
                    [style.color]="form.priority === p.id ? p.color : null" [title]="p.label">
              <span class="material-symbols-outlined text-[18px]">{{ p.icon }}</span>
            </button>
          </div>
        </div>

        <div class="mb-4">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-2 block">Assignee</label>
          <div *ngIf="selectedMember() as m" class="flex items-center gap-2 mb-2">
            <span class="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-primary/10 border border-primary">
              <span class="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-white text-[10px] font-bold" [style.background]="m.color">
                <img *ngIf="m.avatarUrl; else selI" [src]="m.avatarUrl" [alt]="m.name" class="w-full h-full object-cover" /><ng-template #selI>{{ m.initials }}</ng-template>
              </span>
              <span class="text-[13px] font-semibold text-on-surface">{{ m.name }}</span>
              <button (click)="form.assigneeId = ''" class="material-symbols-outlined text-[16px] text-on-surface-variant hover:text-error">close</button>
            </span>
          </div>
          <div *ngIf="!selectedMember()" class="relative">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">search</span>
            <input type="text" [(ngModel)]="assigneeQuery" placeholder="Search a person…"
                   class="w-full pl-10 pr-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[15px] font-medium outline-none border border-transparent focus:border-primary/30" />
            <div *ngIf="assigneeQuery.trim()" class="absolute z-20 mt-1 w-full bg-white rounded-2xl overflow-hidden max-h-52 overflow-y-auto" style="box-shadow:0 8px 30px rgba(0,0,0,0.12);">
              <button *ngFor="let m of filteredMembers()" (click)="form.assigneeId = m.id; assigneeQuery = ''"
                      class="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-surface-container text-left">
                <span class="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" [style.background]="m.color">
                  <img *ngIf="m.avatarUrl; else rI" [src]="m.avatarUrl" [alt]="m.name" class="w-full h-full object-cover" /><ng-template #rI>{{ m.initials }}</ng-template>
                </span>
                <span class="text-[14px] font-semibold text-on-surface">{{ m.name }}</span>
              </button>
              <p *ngIf="!filteredMembers().length" class="px-3 py-3 text-[13px] text-on-surface-variant">No people found.</p>
            </div>
          </div>
        </div>

        <div class="mb-6">
          <label class="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">Story points</label>
          <input type="number" min="0" step="1" [(ngModel)]="form.storyPoints"
                 class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[16px] font-medium outline-none border border-transparent focus:border-primary/30" />
        </div>

        <div class="flex gap-3">
          <button (click)="showAddModal = false" class="flex-1 py-3.5 rounded-2xl bg-surface-container text-on-surface-variant text-[14px] font-bold active:scale-95">Cancel</button>
          <button (click)="saveIssue()" [disabled]="!form.title.trim() || !form.epicId" class="flex-1 py-3.5 rounded-2xl text-white text-[14px] font-bold bg-gradient-to-tr from-primary to-secondary-container active:scale-95 disabled:opacity-40">Create story</button>
        </div>
      </div>
    </div>

    <!-- Resolution modal -->
    <div *ngIf="showResolutionModal" class="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center" (click)="cancelResolution()">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
      <div class="relative bg-white rounded-t-[28px] sm:rounded-[28px] w-full sm:max-w-md p-6 pb-10" style="box-shadow:0 -8px 40px rgba(0,0,0,0.12);" (click)="$event.stopPropagation()">
        <div class="w-12 h-1 rounded-full bg-outline-variant mx-auto mb-6 sm:hidden"></div>
        <h3 class="font-bold text-[22px] text-on-surface mb-1 font-manrope">Close issue</h3>
        <p class="text-[14px] text-on-surface-variant mb-5">How was this resolved?</p>
        <div class="flex flex-col gap-2 mb-2">
          <button *ngFor="let r of resolutions" (click)="confirmResolution(r.id)"
                  class="flex items-center gap-3 p-3 rounded-2xl border border-outline-variant hover:border-primary/40 hover:bg-surface-container-low transition-all text-left active:scale-[0.98]">
            <span class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" [style.background]="r.color + '22'"><span class="material-symbols-outlined text-[20px]" [style.color]="r.color">{{ r.icon }}</span></span>
            <span class="flex-1"><span class="block text-[15px] font-bold text-on-surface">{{ r.label }}</span><span class="block text-[12px] text-on-surface-variant">{{ r.desc }}</span></span>
            <span class="material-symbols-outlined text-outline">chevron_right</span>
          </button>
        </div>
        <button (click)="cancelResolution()" class="w-full mt-3 py-3.5 rounded-2xl bg-surface-container text-on-surface-variant text-[14px] font-bold active:scale-95">Cancel</button>
      </div>
    </div>
  `,
})
export class ProjectKanbanComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private ws = inject(WorkspaceService);
  private destroyRef = inject(DestroyRef);

  private _projectId = signal('');
  readonly projectId = this._projectId.asReadonly();

  readonly columns: BoardColumn[] = [
    { id: 'todo', label: 'To Do', statuses: ['todo'] },
    { id: 'in-progress', label: 'In Progress', statuses: ['in-progress'] },
    { id: 'done', label: 'Done', statuses: ['done'] },
  ];
  readonly resolutions = RESOLUTIONS;
  readonly priorities: PriorityDef[] = PRIORITIES;
  /** Statuses selectable from a story's status label. */
  readonly sprintStatuses: StatusDef[] = STATUSES.filter(s => ['todo', 'in-progress', 'done'].includes(s.id));
  private readonly statusOrder: Record<IssueStatus, number> = { backlog: -1, todo: 0, 'in-progress': 1, done: 2 };
  readonly boardTypes: IssueTypeDef[] = ISSUE_TYPES.filter(t => BOARD_TYPES.includes(t.id));
  readonly subType: IssueTypeDef = issueTypeInfo('subtask');
  readonly teamMembers = this.projectService.teamMembers;

  // ── View state ───────────────────────────────────────────────────────
  tab = signal<'sprint' | 'backlog'>('sprint');
  searchQuery = signal('');
  filterAssignee = signal<string>('all');
  filterEpic = signal<string>('all');
  epicMenuOpen = signal(false);
  sidebarOpen = signal(false);
  collapsedStories = signal<Set<string>>(new Set<string>());
  addingSubtaskFor = signal<string | null>(null);
  subtaskTitle = '';
  statusMenuFor = signal<string | null>(null);

  // ── Data ─────────────────────────────────────────────────────────────
  project = computed(() => this.projectService.getProjectById(this._projectId()));
  /** Projects in the currently selected workspace. */
  projects = computed(() => this.projectService.projects().filter(p => this.ws.isInCurrent(p.workspaceId)));
  epics = computed(() => this.projectService.epicsOf(this._projectId()));

  private allStories = computed<Issue[]>(() =>
    this.projectService.issuesByProject(this._projectId()).filter(i => BOARD_TYPES.includes(i.type)),
  );

  private filteredStories = computed<Issue[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const fa = this.filterAssignee();
    const fe = this.filterEpic();
    return this.allStories().filter(i =>
      (!q || i.title.toLowerCase().includes(q) || i.key.toLowerCase().includes(q)) &&
      (fe === 'all' || i.parentId === fe) &&
      // Assignee filter is subtask-based: keep a story only if it has a matching subtask.
      (fa === 'all' || this.subtasksOf(i).some(s => s.assigneeId === fa)),
    );
  });

  backlogStories = computed<Issue[]>(() => this.filteredStories().filter(i => i.status === 'backlog'));

  /** Active-sprint stories (everything not in the backlog), ordered To Do → In Progress → Done. */
  sprintStories = computed<Issue[]>(() =>
    this.filteredStories()
      .filter(i => i.status !== 'backlog')
      .sort((a, b) => this.statusOrder[a.status] - this.statusOrder[b.status]),
  );

  /** Avatar filter is built from people assigned to subtasks (not stories). */
  projectMembers = computed<TeamMember[]>(() => {
    const ids = new Set<string>();
    this.projectService.issuesByProject(this._projectId())
      .filter(i => i.type === 'subtask')
      .forEach(s => { if (s.assigneeId) ids.add(s.assigneeId); });
    return this.teamMembers.filter(m => ids.has(m.id));
  });

  // ── Add issue / resolution state ─────────────────────────────────────
  showAddModal = false;
  assigneeQuery = '';
  form = this.emptyForm();
  showResolutionModal = false;
  private pendingCloseId: string | null = null;

  ngOnInit(): void {
    this.projectService.load();
    this.ws.load();
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(pm => {
      const pid = pm.get('pid') || this.projects()[0]?.id || this.projectService.projects()[0]?.id || '';
      this._projectId.set(pid);
    });
  }

  // ── Board data ───────────────────────────────────────────────────────
  colData(col: BoardColumn): Issue[] {
    return this.filteredStories().filter(i => col.statuses.includes(i.status));
  }
  connectedTo(id: IssueStatus): string[] {
    return this.columns.filter(c => c.id !== id).map(c => c.id + '-list');
  }
  subtasksOf(story: Issue): Issue[] {
    return this.projectService.childrenOf(story.id).filter(i => i.type === 'subtask');
  }
  /** Subtasks of a story in a given column (To Do also catches Backlog), respecting the assignee filter. */
  subtasksForCol(story: Issue, col: BoardColumn): Issue[] {
    const statuses: IssueStatus[] = col.id === 'todo' ? ['backlog', 'todo'] : col.statuses;
    const fa = this.filterAssignee();
    return this.subtasksOf(story).filter(s => statuses.includes(s.status) && (fa === 'all' || s.assigneeId === fa));
  }
  /** Count of all expanded-story subtasks sitting in a column (for the header chips). */
  sprintColCount(col: BoardColumn): number {
    return this.sprintStories()
      .filter(st => !this.isCollapsed(st.id))
      .reduce((n, st) => n + this.subtasksForCol(st, col).length, 0);
  }
  statusColor(s: IssueStatus): string { return statusInfo(s).color; }
  epicStoryCount(epicId: string): number {
    return this.projectService.childrenOf(epicId).filter(i => BOARD_TYPES.includes(i.type)).length;
  }
  epicById(id: string): Issue | undefined {
    return this.epics().find(e => e.id === id);
  }

  // ── Navigation ───────────────────────────────────────────────────────
  selectProject(pid: string): void {
    this.sidebarOpen.set(false);
    this.filterEpic.set('all');
    this.router.navigate(['/projects', pid, 'board']);
  }
  go(url: string, queryParams?: Record<string, unknown>): void {
    this.router.navigate([url], queryParams ? { queryParams } : {});
  }
  openIssue(story: Issue): void {
    this.router.navigate(['/projects', story.projectId, 'stories', story.id]);
  }
  openSubtask(story: Issue, sub: Issue): void {
    this.router.navigate(['/projects', sub.projectId, 'stories', story.id, 'subtasks', sub.id]);
  }

  // ── Filters ──────────────────────────────────────────────────────────
  toggleAssignee(id: string): void {
    this.filterAssignee.set(this.filterAssignee() === id ? 'all' : id);
  }
  selectEpic(id: string): void {
    this.filterEpic.set(id);
    this.epicMenuOpen.set(false);
  }

  // ── Collapse / subtasks ──────────────────────────────────────────────
  isCollapsed(id: string): boolean { return this.collapsedStories().has(id); }
  toggleCollapse(id: string): void {
    const next = new Set(this.collapsedStories());
    next.has(id) ? next.delete(id) : next.add(id);
    this.collapsedStories.set(next);
  }
  toggleSubtask(sub: Issue): void {
    this.projectService.updateIssueStatus(sub.id, sub.status === 'done' ? 'todo' : 'done', sub.status === 'done' ? undefined : 'done');
  }
  startAddSubtask(storyId: string): void {
    this.addingSubtaskFor.set(storyId);
    this.subtaskTitle = '';
  }
  cancelAddSubtask(): void {
    this.addingSubtaskFor.set(null);
    this.subtaskTitle = '';
  }
  saveSubtask(story: Issue): void {
    const title = this.subtaskTitle.trim();
    if (!title) return;
    this.projectService.createIssue({
      projectId: story.projectId,
      type: 'subtask',
      parentId: story.id,
      title,
      status: 'todo',
      priority: 'medium',
      assigneeId: story.assigneeId,
    });
    this.subtaskTitle = '';
    // keep adding open for quick entry
  }

  // ── Drag & drop ──────────────────────────────────────────────────────
  onDrop(event: CdkDragDrop<Issue[]>, target: BoardColumn): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }
    const moved = event.previousContainer.data[event.previousIndex];
    const targetStatus = target.statuses[0];
    if (targetStatus === 'done') {
      this.pendingCloseId = moved.id;
      this.showResolutionModal = true;
      return;
    }
    transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    this.projectService.updateIssueStatus(moved.id, targetStatus);
  }
  /** Drag a subtask between a story's To Do / In Progress / Done columns → set its status. */
  onSubtaskDrop(event: CdkDragDrop<Issue[]>, targetCol: BoardColumn): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }
    const moved = event.previousContainer.data[event.previousIndex];
    const targetStatus = targetCol.statuses[0];
    // Moving to Done/closed prompts for a resolution (Jira-style) before committing.
    if (targetStatus === 'done') {
      this.pendingCloseId = moved.id;
      this.showResolutionModal = true;
      return;
    }
    transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    this.projectService.updateIssueStatus(moved.id, targetStatus);
  }
  confirmResolution(resolution: TaskResolution): void {
    if (this.pendingCloseId) this.projectService.updateIssueStatus(this.pendingCloseId, 'done', resolution);
    this.showResolutionModal = false;
    this.pendingCloseId = null;
  }
  cancelResolution(): void {
    this.showResolutionModal = false;
    this.pendingCloseId = null;
    this.projectService.touchIssues();
  }

  // ── Add issue ────────────────────────────────────────────────────────
  openAddIssue(status: IssueStatus): void {
    this.form = this.emptyForm();
    this.form.status = status;
    this.form.epicId = this.filterEpic() !== 'all' ? this.filterEpic() : '';
    this.assigneeQuery = '';
    this.showAddModal = true;
  }
  saveIssue(): void {
    // Stories must have a title and belong to an epic.
    if (!this.form.title.trim() || !this.form.epicId) return;
    this.projectService.createIssue({
      projectId: this._projectId(),
      type: 'story',
      parentId: this.form.epicId,
      title: this.form.title,
      status: this.form.status,
      priority: this.form.priority,
      assigneeId: this.form.assigneeId || undefined,
      storyPoints: Number(this.form.storyPoints) || 0,
      sprintId: this.projectService.activeSprint(this._projectId())?.id,
    });
    this.showAddModal = false;
  }

  /** No epic yet → send the user to create one first. */
  createEpicFirst(): void {
    this.showAddModal = false;
    this.router.navigate(['/projects', this._projectId(), 'epics'], { queryParams: { new: 1 } });
  }

  // ── Assignee search (add modal) ──────────────────────────────────────
  filteredMembers(): TeamMember[] {
    const q = this.assigneeQuery.trim().toLowerCase();
    if (!q) return [];
    return this.teamMembers.filter(m => m.id !== this.form.assigneeId && (m.name.toLowerCase().includes(q) || m.initials.toLowerCase().includes(q)));
  }
  selectedMember(): TeamMember | undefined {
    return this.teamMembers.find(m => m.id === this.form.assigneeId);
  }

  // ── Status label / menu ──────────────────────────────────────────────
  statusOf(issue: Issue): StatusDef { return statusInfo(issue.status); }
  toggleStatusMenu(id: string): void {
    this.statusMenuFor.set(this.statusMenuFor() === id ? null : id);
  }
  setStatus(story: Issue, status: IssueStatus): void {
    this.statusMenuFor.set(null);
    if (status === story.status) return;
    if (status === 'done') {
      this.pendingCloseId = story.id;
      this.showResolutionModal = true;
      return;
    }
    this.projectService.updateIssueStatus(story.id, status);
  }

  // ── Display helpers ──────────────────────────────────────────────────
  typeOf(issue: Issue): IssueTypeDef { return issueTypeInfo(issue.type); }
  prioOf(issue: Issue): PriorityDef { return priorityInfo(issue.priority); }
  resolutionInfo(res: Issue['resolution']): ResolutionDef { return resolutionInfo(res); }
  memberOf(issue: Issue): TeamMember | undefined { return this.teamMembers.find(m => m.id === issue.assigneeId); }
  subCount(issue: Issue): { done: number; total: number } { return this.projectService.subtaskCount(issue.id); }

  private emptyForm() {
    return {
      type: 'story' as IssueType,
      title: '',
      epicId: '' as string,
      status: 'todo' as IssueStatus,
      priority: 'medium' as IssuePriority,
      assigneeId: '' as string,
      storyPoints: 3,
    };
  }
}
