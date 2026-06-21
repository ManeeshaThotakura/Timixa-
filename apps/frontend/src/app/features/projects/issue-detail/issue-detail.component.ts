import { Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProjectService } from '../../../core/services/project.service';
import { Issue, IssueType, IssuePriority, TeamMember, TaskResolution } from '../../../core/models/project.model';
import {
  ISSUE_TYPES, STATUSES, PRIORITIES, RESOLUTIONS,
  IssueTypeDef, PriorityDef, ResolutionDef,
  issueTypeInfo, statusInfo, priorityInfo, resolutionInfo,
} from '../task-meta';

interface Segment { text: string; mention: boolean; }
type EditField = 'priority' | 'points' | 'estimate' | 'start' | 'due' | null;

@Component({
  selector: 'app-issue-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-surface-container-lowest min-h-full" *ngIf="issue() as t; else missing">

      <!-- Breadcrumb header -->
      <div class="sticky top-0 z-20 px-5 py-2.5 bg-white/90 backdrop-blur-xl border-b border-surface-container">
        <div class="flex items-center gap-1.5 text-[12px] text-on-surface-variant flex-wrap max-w-3xl mx-auto">
          <button (click)="goBoard()" class="hover:text-primary font-semibold">{{ project()?.title }}</button>
          <ng-container *ngFor="let a of trail()">
            <span class="material-symbols-outlined text-[14px]">chevron_right</span>
            <button (click)="openIssue(a)" class="hover:text-primary font-semibold inline-flex items-center gap-1">
              <span class="material-symbols-outlined text-[13px]" [style.color]="typeOf(a).color">{{ typeOf(a).icon }}</span>{{ a.key }}
            </button>
          </ng-container>
          <span class="material-symbols-outlined text-[14px]">chevron_right</span>
          <span class="font-bold text-on-surface inline-flex items-center gap-1">
            <span class="material-symbols-outlined text-[13px]" [style.color]="typeOf(t).color">{{ typeOf(t).icon }}</span>{{ t.key }}
          </span>
        </div>
      </div>

      <div class="px-5 py-5 pb-16 max-w-3xl w-full mx-auto">

        <!-- Type + key (small) -->
        <div class="flex items-center gap-2 mb-2 text-[11px]">
          <span class="px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1" [style.background]="typeOf(t).bg" [style.color]="typeOf(t).color">
            <span class="material-symbols-outlined text-[12px]">{{ typeOf(t).icon }}</span>{{ typeOf(t).label }}
          </span>
          <span class="font-bold text-on-surface-variant">{{ t.key }}</span>
        </div>

        <!-- Title (click to edit) -->
        <ng-container *ngIf="editingTitle(); else titleView">
          <input [(ngModel)]="titleDraft" (blur)="saveTitle(t)" (keyup.enter)="saveTitle(t)" autofocus
                 class="w-full text-[24px] font-bold text-on-surface leading-snug font-manrope bg-surface-container rounded-lg px-2 py-1 outline-none border border-primary/30" />
        </ng-container>
        <ng-template #titleView>
          <h1 (click)="startEditTitle(t)" class="text-[24px] font-bold text-on-surface leading-snug font-manrope cursor-text hover:bg-surface-container-low rounded-lg px-2 -mx-2 py-1 transition-colors">{{ t.title }}</h1>
        </ng-template>

        <!-- Status + Assignee (beside the title) -->
        <div class="flex items-center gap-2 mt-3 mb-7 flex-wrap">
          <!-- Status label -->
          <div class="relative">
            <button (click)="statusMenuOpen.set(!statusMenuOpen())"
                    class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-bold uppercase tracking-wide">
              <span class="px-2 py-1 rounded-md inline-flex items-center gap-1" [style.background]="statusOf(t.status).bg" [style.color]="statusOf(t.status).color">
                <span class="material-symbols-outlined text-[14px]">{{ statusOf(t.status).icon }}</span>{{ statusOf(t.status).label }}
              </span>
              <span class="material-symbols-outlined text-[16px] text-on-surface-variant">expand_more</span>
            </button>
            <div *ngIf="statusMenuOpen()" class="absolute left-0 top-full mt-1 w-44 bg-white rounded-xl py-1 z-30" style="box-shadow:0 8px 30px rgba(0,0,0,0.15);">
              <button *ngFor="let s of statuses" (click)="chooseStatus(s.id, t)"
                      class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-container-low text-[13px] font-semibold" [class.text-primary]="t.status === s.id">
                <span class="material-symbols-outlined text-[16px]" [style.color]="s.color">{{ s.icon }}</span>{{ s.label }}
              </button>
            </div>
          </div>

          <!-- Assignee -->
          <div class="relative">
            <button (click)="toggleAssigneeEdit()" class="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-lg hover:bg-surface-container-low transition-colors">
              <ng-container *ngIf="memberOf(t) as m; else noAssignee">
                <span class="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-white text-[9px] font-bold" [style.background]="m.color">
                  <img *ngIf="m.avatarUrl; else mi" [src]="m.avatarUrl" [alt]="m.name" class="w-full h-full object-cover" />
                  <ng-template #mi>{{ m.initials }}</ng-template>
                </span>
                <span class="text-[13px] font-semibold text-on-surface">{{ m.name }}</span>
              </ng-container>
              <ng-template #noAssignee>
                <span class="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant"><span class="material-symbols-outlined text-[15px]">person</span></span>
                <span class="text-[13px] font-semibold text-on-surface-variant">Unassigned</span>
              </ng-template>
            </button>
            <div *ngIf="editingAssignee()" class="absolute left-0 top-full mt-1 w-60 bg-white rounded-xl p-2 z-30" style="box-shadow:0 8px 30px rgba(0,0,0,0.15);">
              <div class="relative mb-1">
                <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">search</span>
                <input type="text" [(ngModel)]="assigneeQuery" placeholder="Search a person…"
                       class="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-container text-on-surface text-[13px] font-medium outline-none" />
              </div>
              <div class="max-h-52 overflow-y-auto flex flex-col gap-0.5">
                <button (click)="clearAssignee(t)" class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-container text-left">
                  <span class="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant"><span class="material-symbols-outlined text-[15px]">person_off</span></span>
                  <span class="text-[13px] font-semibold text-on-surface-variant">Unassign</span>
                </button>
                <button *ngFor="let m of assignResults()" (click)="chooseAssignee(t, m.id)" class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-container text-left">
                  <span class="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-white text-[9px] font-bold" [style.background]="m.color">
                    <img *ngIf="m.avatarUrl; else ami" [src]="m.avatarUrl" [alt]="m.name" class="w-full h-full object-cover" />
                    <ng-template #ami>{{ m.initials }}</ng-template>
                  </span>
                  <span class="text-[13px] font-semibold text-on-surface">{{ m.name }}</span>
                </button>
              </div>
            </div>
          </div>

          <span *ngIf="t.status === 'done'" class="inline-flex items-center gap-1 text-[12px] font-semibold" [style.color]="resOf(t.resolution).color">
            <span class="material-symbols-outlined text-[15px]">{{ resOf(t.resolution).icon }}</span>{{ resOf(t.resolution).label }}
          </span>
        </div>

        <!-- Description (primary) -->
        <section class="mb-7">
          <div class="flex items-center justify-between mb-2">
            <p class="text-[12px] font-bold text-on-surface uppercase tracking-wider">Description</p>
            <button *ngIf="!editingDesc()" (click)="startEditDesc(t)" class="text-[12px] font-bold text-primary flex items-center gap-1">
              <span class="material-symbols-outlined text-[15px]">edit</span>Edit
            </button>
          </div>
          <ng-container *ngIf="!editingDesc(); else editDescTpl">
            <p (click)="startEditDesc(t)" class="text-[15px] text-on-surface whitespace-pre-wrap cursor-text hover:bg-surface-container-low rounded-lg px-2 -mx-2 py-1.5 transition-colors" *ngIf="t.description.trim(); else noDesc">{{ t.description }}</p>
            <ng-template #noDesc><p (click)="startEditDesc(t)" class="text-[14px] text-on-surface-variant italic cursor-text">Add a description…</p></ng-template>
          </ng-container>
          <ng-template #editDescTpl>
            <textarea [(ngModel)]="descDraft" rows="4"
                      class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[15px] font-medium outline-none border border-primary/30 resize-none"></textarea>
            <div class="flex gap-2 mt-2">
              <button (click)="cancelEditDesc()" class="px-4 py-2 rounded-xl bg-surface-container text-on-surface-variant text-[13px] font-bold active:scale-95">Cancel</button>
              <button (click)="saveDesc(t)" class="px-4 py-2 rounded-xl text-white text-[13px] font-bold bg-gradient-to-tr from-primary to-secondary-container active:scale-95">Save</button>
            </div>
          </ng-template>
        </section>

        <!-- Details (secondary, compact, click a value to edit) -->
        <section class="mb-7">
          <p class="text-[11px] font-bold text-outline uppercase tracking-wider mb-3">Details</p>
          <div class="flex flex-wrap gap-x-8 gap-y-4">

            <!-- Priority -->
            <div class="flex flex-col gap-1">
              <span class="text-[11px] font-semibold text-on-surface-variant">Priority</span>
              <ng-container *ngIf="editingField() === 'priority'; else prView">
                <select [ngModel]="t.priority" (ngModelChange)="patch(t, { priority: $event }); closeField()" (blur)="closeField()"
                        class="px-2 py-1 rounded-lg bg-surface-container text-[13px] font-semibold outline-none">
                  <option *ngFor="let p of priorities" [value]="p.id">{{ p.label }}</option>
                </select>
              </ng-container>
              <ng-template #prView>
                <button (click)="setField('priority')" class="inline-flex items-center gap-1 text-[13px] font-bold" [style.color]="prioOf(t).color">
                  <span class="material-symbols-outlined text-[16px]">{{ prioOf(t).icon }}</span>{{ prioOf(t).label }}
                </button>
              </ng-template>
            </div>

            <!-- Story points (board issues) -->
            <div class="flex flex-col gap-1" *ngIf="canEditType()">
              <span class="text-[11px] font-semibold text-on-surface-variant">Story points</span>
              <ng-container *ngIf="editingField() === 'points'; else ptView">
                <input type="number" min="0" step="1" [ngModel]="t.storyPoints ?? 0" (ngModelChange)="patch(t, { storyPoints: +$event || 0 })" (blur)="closeField()" autofocus
                       class="w-20 px-2 py-1 rounded-lg bg-surface-container text-[13px] font-semibold outline-none" />
              </ng-container>
              <ng-template #ptView>
                <button (click)="setField('points')" class="text-[13px] font-bold text-on-surface text-left">{{ t.storyPoints ?? 0 }}</button>
              </ng-template>
            </div>

            <!-- Estimate (subtasks) -->
            <div class="flex flex-col gap-1" *ngIf="t.type === 'subtask'">
              <span class="text-[11px] font-semibold text-on-surface-variant">Estimate (h)</span>
              <ng-container *ngIf="editingField() === 'estimate'; else esView">
                <input type="number" min="0" step="0.5" [ngModel]="t.estimateHours ?? 0" (ngModelChange)="patch(t, { estimateHours: +$event || 0 })" (blur)="closeField()" autofocus
                       class="w-20 px-2 py-1 rounded-lg bg-surface-container text-[13px] font-semibold outline-none" />
              </ng-container>
              <ng-template #esView>
                <button (click)="setField('estimate')" class="text-[13px] font-bold text-on-surface text-left">{{ t.estimateHours ?? 0 }}</button>
              </ng-template>
            </div>

            <!-- Start date -->
            <div class="flex flex-col gap-1">
              <span class="text-[11px] font-semibold text-on-surface-variant">Start date</span>
              <ng-container *ngIf="editingField() === 'start'; else stView">
                <input type="date" [ngModel]="t.startDate" (ngModelChange)="patch(t, { startDate: $event })" (blur)="closeField()" autofocus
                       class="px-2 py-1 rounded-lg bg-surface-container text-[13px] font-medium outline-none" />
              </ng-container>
              <ng-template #stView>
                <button (click)="setField('start')" class="text-[13px] font-bold text-on-surface text-left">{{ t.startDate ? (t.startDate | date:'MMM d, y') : '—' }}</button>
              </ng-template>
            </div>

            <!-- Due date -->
            <div class="flex flex-col gap-1">
              <span class="text-[11px] font-semibold text-on-surface-variant">Due date</span>
              <ng-container *ngIf="editingField() === 'due'; else dueView">
                <input type="date" [ngModel]="t.dueDate" (ngModelChange)="patch(t, { dueDate: $event })" [min]="t.startDate" (blur)="closeField()" autofocus
                       class="px-2 py-1 rounded-lg bg-surface-container text-[13px] font-medium outline-none" />
              </ng-container>
              <ng-template #dueView>
                <button (click)="setField('due')" class="text-[13px] font-bold text-on-surface text-left">{{ t.dueDate ? (t.dueDate | date:'MMM d, y') : '—' }}</button>
              </ng-template>
            </div>
          </div>
        </section>

        <!-- Children (epic→stories, story→subtasks) -->
        <section class="mb-7" *ngIf="childType() as ct">
          <p class="text-[12px] font-bold text-on-surface uppercase tracking-wider mb-2">{{ childLabel() }}
            <span class="ml-1 text-on-surface-variant">({{ children().length }})</span></p>
          <div class="bg-white rounded-2xl overflow-hidden border border-surface-container">
            <button *ngFor="let c of children()" (click)="openIssue(c)"
                    class="w-full flex items-center gap-3 px-4 py-3 border-b border-surface-container hover:bg-surface-container-low transition-colors text-left">
              <span class="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" [style.background]="typeOf(c).bg">
                <span class="material-symbols-outlined text-[14px]" [style.color]="typeOf(c).color">{{ typeOf(c).icon }}</span>
              </span>
              <span class="text-[11px] font-bold text-on-surface-variant flex-shrink-0">{{ c.key }}</span>
              <span class="flex-1 min-w-0 text-[14px] font-medium text-on-surface truncate"
                    [class.line-through]="c.status === 'done'" [class.text-on-surface-variant]="c.status === 'done'">{{ c.title }}</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0"
                    [style.background]="statusOf(c.status).bg" [style.color]="statusOf(c.status).color">{{ statusOf(c.status).label }}</span>
            </button>
            <div class="flex items-center gap-2 px-3 py-2">
              <input [(ngModel)]="newChildTitle" (keyup.enter)="addChild(t)"
                     [placeholder]="ct === 'story' ? 'Add a story…' : 'Add a subtask…'"
                     class="flex-1 px-3 py-2 rounded-xl bg-surface-container text-on-surface text-[14px] font-medium outline-none" />
              <button (click)="addChild(t)" [disabled]="!newChildTitle.trim()"
                      class="px-3 py-2 rounded-xl text-white text-[13px] font-bold bg-gradient-to-tr from-primary to-secondary-container active:scale-95 disabled:opacity-40 flex items-center gap-1">
                <span class="material-symbols-outlined text-[16px]">add</span>Add
              </button>
            </div>
          </div>
        </section>

        <!-- Comments (inline composer) -->
        <section>
          <p class="text-[12px] font-bold text-on-surface uppercase tracking-wider mb-3">Comments
            <span class="ml-1 text-on-surface-variant">({{ comments().length }})</span></p>

          <!-- Composer -->
          <div class="flex items-end gap-2 mb-5">
            <span class="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" [style.background]="me.color">
              <img *ngIf="me.avatarUrl; else myi" [src]="me.avatarUrl" [alt]="me.name" class="w-full h-full object-cover" />
              <ng-template #myi>{{ me.initials }}</ng-template>
            </span>
            <div class="flex-1 relative">
              <textarea #composer [value]="newComment" (input)="onCommentInput($event, 'new')" rows="1" placeholder="Add a comment… use @ to mention"
                        class="w-full px-4 py-2.5 rounded-2xl bg-surface-container text-on-surface text-[15px] font-medium outline-none border border-transparent focus:border-primary/30 resize-none max-h-32"></textarea>
              <div *ngIf="mentionOpen() && mentionTarget === 'new'" class="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl overflow-hidden max-h-48 overflow-y-auto" style="box-shadow:0 8px 30px rgba(0,0,0,0.15);">
                <ng-container *ngTemplateOutlet="mentionList"></ng-container>
              </div>
            </div>
            <button (click)="send()" [disabled]="!newComment.trim()"
                    class="w-11 h-11 rounded-full flex items-center justify-center text-white flex-shrink-0 bg-gradient-to-tr from-primary to-secondary-container active:scale-90 transition disabled:opacity-40">
              <span class="material-symbols-outlined text-[20px]">send</span>
            </button>
          </div>

          <!-- List -->
          <div class="flex flex-col gap-4">
            <div *ngFor="let c of comments()" class="flex gap-3">
              <span class="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" [style.background]="c.authorColor">
                <img *ngIf="c.authorAvatarUrl; else ci" [src]="c.authorAvatarUrl" [alt]="c.authorName" class="w-full h-full object-cover" />
                <ng-template #ci>{{ c.authorInitials }}</ng-template>
              </span>
              <div class="flex-1 bg-white rounded-2xl p-3 border border-surface-container">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-[13px] font-bold text-on-surface">{{ c.authorName }}</span>
                  <div class="flex items-center gap-2">
                    <span class="text-[11px] text-on-surface-variant">{{ c.createdAt | date:'MMM d, h:mm a' }}</span>
                    <ng-container *ngIf="c.authorId === me.id && editingCommentId() !== c.id">
                      <button (click)="startEditComment(c)" class="material-symbols-outlined text-[16px] text-outline hover:text-primary">edit</button>
                      <button (click)="removeComment(c)" class="material-symbols-outlined text-[16px] text-outline hover:text-error">delete</button>
                    </ng-container>
                  </div>
                </div>
                <ng-container *ngIf="editingCommentId() === c.id; else showBody">
                  <div class="relative">
                    <textarea #editComposer [value]="commentDraft" (input)="onCommentInput($event, 'edit')" rows="2"
                              class="w-full px-3 py-2 rounded-xl bg-surface-container text-on-surface text-[14px] font-medium outline-none resize-none"></textarea>
                    <div *ngIf="mentionOpen() && mentionTarget === 'edit'" class="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl overflow-hidden max-h-40 overflow-y-auto" style="box-shadow:0 8px 30px rgba(0,0,0,0.15);">
                      <ng-container *ngTemplateOutlet="mentionList"></ng-container>
                    </div>
                  </div>
                  <div class="flex gap-2 mt-2">
                    <button (click)="cancelCommentEdit()" class="px-4 py-2 rounded-lg bg-surface-container text-on-surface-variant text-[12px] font-bold active:scale-95">Cancel</button>
                    <button (click)="saveCommentEdit(c)" class="px-4 py-2 rounded-lg text-white text-[12px] font-bold bg-gradient-to-tr from-primary to-secondary-container active:scale-95">Save</button>
                  </div>
                </ng-container>
                <ng-template #showBody>
                  <p class="text-[14px] text-on-surface whitespace-pre-wrap leading-relaxed"><ng-container *ngFor="let seg of segments(c.text)"><span *ngIf="seg.mention" class="text-primary font-semibold bg-primary/10 rounded px-1">{{ seg.text }}</span><ng-container *ngIf="!seg.mention">{{ seg.text }}</ng-container></ng-container></p>
                </ng-template>
              </div>
            </div>
            <p *ngIf="!comments().length" class="text-[14px] text-on-surface-variant italic">No comments yet. Start the conversation.</p>
          </div>
        </section>
      </div>

      <!-- click-away for popovers -->
      <div *ngIf="statusMenuOpen() || editingAssignee()" class="fixed inset-0 z-10" (click)="statusMenuOpen.set(false); editingAssignee.set(false)"></div>
    </div>

    <ng-template #missing>
      <div class="p-10 text-center text-on-surface-variant">
        <p class="mb-3">Issue not found.</p>
        <button (click)="goBoard()" class="text-primary font-bold">Back to board</button>
      </div>
    </ng-template>

    <!-- Resolution modal -->
    <div *ngIf="showResolution()" class="fixed inset-0 z-[10001] flex items-end justify-center md:items-center" (click)="showResolution.set(false)">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
      <div class="relative bg-white rounded-t-[28px] md:rounded-[28px] w-full md:max-w-md p-6 pb-10" style="box-shadow:0 -8px 40px rgba(0,0,0,0.12);" (click)="$event.stopPropagation()">
        <div class="w-12 h-1 rounded-full bg-outline-variant mx-auto mb-6 md:hidden"></div>
        <h3 class="font-bold text-[22px] text-on-surface mb-1 font-manrope">Close issue</h3>
        <p class="text-[14px] text-on-surface-variant mb-5">How was this resolved?</p>
        <div class="flex flex-col gap-2">
          <button *ngFor="let r of resolutions" (click)="pickResolution(r.id)"
                  class="flex items-center gap-3 p-3 rounded-2xl border border-outline-variant hover:border-primary/40 hover:bg-surface-container-low transition-all text-left active:scale-[0.98]">
            <span class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" [style.background]="r.color + '22'">
              <span class="material-symbols-outlined text-[20px]" [style.color]="r.color">{{ r.icon }}</span>
            </span>
            <span class="flex-1">
              <span class="block text-[15px] font-bold text-on-surface">{{ r.label }}</span>
              <span class="block text-[12px] text-on-surface-variant">{{ r.desc }}</span>
            </span>
            <span class="material-symbols-outlined text-outline">chevron_right</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Reusable @mention suggestion list -->
    <ng-template #mentionList>
      <button *ngFor="let m of mentionResults()" (click)="selectMention(m)"
              class="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-surface-container transition-colors text-left">
        <span class="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" [style.background]="m.color">
          <img *ngIf="m.avatarUrl; else mlInit" [src]="m.avatarUrl" [alt]="m.name" class="w-full h-full object-cover" />
          <ng-template #mlInit>{{ m.initials }}</ng-template>
        </span>
        <span class="text-[14px] font-semibold text-on-surface">{{ m.name }}</span>
      </button>
      <p *ngIf="!mentionResults().length" class="px-3 py-3 text-[13px] text-on-surface-variant">No people found.</p>
    </ng-template>
  `,
})
export class IssueDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(ProjectService);

  @ViewChild('composer') composer?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('editComposer') editComposer?: ElementRef<HTMLTextAreaElement>;

  readonly statuses = STATUSES;
  readonly resolutions = RESOLUTIONS;
  readonly boardTypes: IssueTypeDef[] = ISSUE_TYPES.filter(t => ['story', 'task', 'bug'].includes(t.id));
  readonly priorities: PriorityDef[] = PRIORITIES;
  readonly teamMembers = this.service.teamMembers;
  readonly me = this.service.currentMember;

  issueId = signal('');

  issue = computed<Issue | undefined>(() => this.service.issues().find(i => i.id === this.issueId()));
  project = computed(() => this.service.getProjectById(this.issue()?.projectId ?? ''));
  children = computed(() => this.service.issues().filter(i => i.parentId === this.issueId()));
  comments = computed(() => this.service.comments().filter(c => c.issueId === this.issueId()));

  /** Ancestor issues from top (epic) down to the immediate parent. */
  trail = computed<Issue[]>(() => {
    const chain: Issue[] = [];
    let p = this.issue()?.parentId ? this.service.getIssueById(this.issue()!.parentId!) : undefined;
    while (p) {
      chain.unshift(p);
      p = p.parentId ? this.service.getIssueById(p.parentId) : undefined;
    }
    return chain;
  });

  childType = computed<IssueType | null>(() => {
    const t = this.issue()?.type;
    if (t === 'epic') return 'story';
    if (t === 'story' || t === 'task' || t === 'bug') return 'subtask';
    return null;
  });
  childLabel = computed(() => (this.childType() === 'story' ? 'Child stories' : 'Subtasks'));
  canEditType = computed(() => {
    const t = this.issue()?.type;
    return t === 'story' || t === 'task' || t === 'bug';
  });

  editingTitle = signal(false);
  titleDraft = '';
  statusMenuOpen = signal(false);
  editingField = signal<EditField>(null);

  editingDesc = signal(false);
  descDraft = '';
  showResolution = signal(false);

  editingAssignee = signal(false);
  assigneeQuery = '';

  editingCommentId = signal<string | null>(null);
  commentDraft = '';

  newChildTitle = '';

  newComment = '';
  mentionOpen = signal(false);
  mentionResults = signal<TeamMember[]>([]);
  mentionTarget: 'new' | 'edit' = 'new';
  private mentionStart = -1;
  private mentionEnd = -1;

  private readonly mentionRegex: RegExp;
  private readonly mentionTokens: Set<string>;

  constructor() {
    this.service.load();
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(pm => {
      this.issueId.set(pm.get('issueId') ?? '');
      this.editingTitle.set(false);
      this.editingDesc.set(false);
      this.editingAssignee.set(false);
      this.editingCommentId.set(null);
      this.statusMenuOpen.set(false);
      this.editingField.set(null);
      this.newChildTitle = '';
      this.newComment = '';
    });

    const names = this.service.teamMembers
      .map(m => m.name)
      .sort((a, b) => b.length - a.length)
      .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    this.mentionRegex = new RegExp(`(@(?:${names.join('|')}))`, 'g');
    this.mentionTokens = new Set(this.service.teamMembers.map(m => '@' + m.name));
  }

  // ── Navigation ───────────────────────────────────────────────────────
  goBoard(): void {
    const pid = this.issue()?.projectId ?? this.route.snapshot.paramMap.get('pid');
    this.router.navigate(['/projects', pid, 'board']);
  }
  openIssue(i: Issue): void {
    const pid = i.projectId;
    if (i.type === 'epic') this.router.navigate(['/projects', pid, 'epics', i.id]);
    else if (i.type === 'subtask') this.router.navigate(['/projects', pid, 'stories', i.parentId, 'subtasks', i.id]);
    else this.router.navigate(['/projects', pid, 'stories', i.id]);
  }

  // ── Inline patching ────────────────────────────────────────────────
  patch(issue: Issue, patch: Partial<Issue>): void { this.service.updateIssue(issue.id, patch); }

  // ── Title ──────────────────────────────────────────────────────────
  startEditTitle(t: Issue): void { this.titleDraft = t.title; this.editingTitle.set(true); }
  saveTitle(t: Issue): void {
    const v = this.titleDraft.trim();
    if (v && v !== t.title) this.patch(t, { title: v });
    this.editingTitle.set(false);
  }

  // ── Compact detail fields ──────────────────────────────────────────
  setField(f: EditField): void { this.editingField.set(f); }
  closeField(): void { this.editingField.set(null); }

  // ── Status ─────────────────────────────────────────────────────────
  chooseStatus(status: Issue['status'], t: Issue): void {
    this.statusMenuOpen.set(false);
    this.changeStatus(status, t);
  }
  changeStatus(status: Issue['status'], issue: Issue): void {
    if (issue.status === status) return;
    if (status === 'done') { this.showResolution.set(true); return; }
    this.service.updateIssueStatus(issue.id, status);
  }
  pickResolution(resolution: TaskResolution): void {
    this.service.updateIssueStatus(this.issueId(), 'done', resolution);
    this.showResolution.set(false);
  }

  // ── Assignee ───────────────────────────────────────────────────────
  toggleAssigneeEdit(): void { this.editingAssignee.update(v => !v); this.assigneeQuery = ''; }
  assignResults(): TeamMember[] {
    const q = this.assigneeQuery.trim().toLowerCase();
    if (!q) return this.teamMembers;
    return this.teamMembers.filter(m => m.name.toLowerCase().includes(q) || m.initials.toLowerCase().includes(q));
  }
  chooseAssignee(issue: Issue, id: string): void { this.patch(issue, { assigneeId: id }); this.editingAssignee.set(false); }
  clearAssignee(issue: Issue): void { this.patch(issue, { assigneeId: undefined }); this.editingAssignee.set(false); }

  // ── Description ────────────────────────────────────────────────────
  startEditDesc(issue: Issue): void { this.descDraft = issue.description; this.editingDesc.set(true); }
  cancelEditDesc(): void { this.editingDesc.set(false); }
  saveDesc(issue: Issue): void { this.service.updateIssue(issue.id, { description: this.descDraft.trim() }); this.editingDesc.set(false); }

  // ── Children ───────────────────────────────────────────────────────
  addChild(parent: Issue): void {
    const ct = this.childType();
    if (!ct || !this.newChildTitle.trim()) return;
    this.service.createIssue({
      projectId: parent.projectId,
      type: ct,
      parentId: parent.id,
      title: this.newChildTitle.trim(),
      status: 'todo',
      storyPoints: ct === 'story' ? 3 : undefined,
      estimateHours: ct === 'subtask' ? 2 : undefined,
      sprintId: ct === 'story' ? parent.sprintId : undefined,
    });
    this.newChildTitle = '';
  }

  // ── Comments ───────────────────────────────────────────────────────
  send(): void {
    if (!this.newComment.trim()) return;
    this.service.addComment(this.issueId(), this.newComment);
    this.newComment = '';
    this.mentionOpen.set(false);
  }
  startEditComment(c: { id: string; text: string }): void { this.editingCommentId.set(c.id); this.commentDraft = c.text; }
  cancelCommentEdit(): void { this.editingCommentId.set(null); }
  saveCommentEdit(c: { id: string }): void { this.service.updateComment(c.id, this.commentDraft); this.editingCommentId.set(null); }
  removeComment(c: { id: string }): void { this.service.deleteComment(c.id); }

  // ── @mentions ──────────────────────────────────────────────────────
  onCommentInput(event: Event, target: 'new' | 'edit'): void {
    const el = event.target as HTMLTextAreaElement;
    if (target === 'new') this.newComment = el.value; else this.commentDraft = el.value;
    this.mentionTarget = target;
    const pos = el.selectionStart ?? el.value.length;
    const match = el.value.slice(0, pos).match(/(?:^|\s)@(\w*)$/);
    if (match) {
      this.mentionStart = pos - match[1].length - 1;
      this.mentionEnd = pos;
      const q = match[1].toLowerCase();
      this.mentionResults.set(this.teamMembers.filter(m => m.name.toLowerCase().includes(q) || m.initials.toLowerCase().includes(q)));
      this.mentionOpen.set(true);
    } else {
      this.mentionOpen.set(false);
    }
  }
  selectMention(m: TeamMember): void {
    const isNew = this.mentionTarget === 'new';
    const current = isNew ? this.newComment : this.commentDraft;
    const before = current.slice(0, this.mentionStart);
    const after = current.slice(this.mentionEnd);
    const inserted = `@${m.name} `;
    const next = `${before}${inserted}${after}`;
    if (isNew) this.newComment = next; else this.commentDraft = next;
    this.mentionOpen.set(false);
    setTimeout(() => {
      const el = (isNew ? this.composer : this.editComposer)?.nativeElement;
      if (el) { const caret = (before + inserted).length; el.focus(); el.setSelectionRange(caret, caret); }
    });
  }
  segments(text: string): Segment[] {
    return text.split(this.mentionRegex).filter(p => p !== '').map(p => ({ text: p, mention: this.mentionTokens.has(p) }));
  }

  // ── Display helpers ────────────────────────────────────────────────
  typeOf(issue: Issue): IssueTypeDef { return issueTypeInfo(issue.type); }
  statusOf(status: Issue['status']) { return statusInfo(status); }
  prioOf(issue: Issue): PriorityDef { return priorityInfo(issue.priority); }
  resOf(res: Issue['resolution']): ResolutionDef { return resolutionInfo(res); }
  memberOf(issue: Issue): TeamMember | undefined { return this.teamMembers.find(m => m.id === issue.assigneeId); }
}
