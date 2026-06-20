import { Component, ElementRef, ViewChild, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../../core/services/project.service';
import { Task, TeamMember, TaskResolution } from '../../../core/models/project.model';
import { STATUSES, RESOLUTIONS, TASK_TYPES, typeInfo, resolutionInfo, TaskTypeDef, ResolutionDef } from '../task-meta';

interface Segment { text: string; mention: boolean; }

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Full-screen on mobile, right-side panel on desktop (Jira-style) -->
    <div *ngIf="task() as t"
         class="fixed inset-0 z-[10000] bg-surface-container-lowest flex flex-col
                md:left-auto md:w-[440px] md:border-l md:border-surface-container
                md:shadow-[-8px_0_40px_rgba(0,0,0,0.08)]">

      <!-- Header -->
      <div class="sticky top-0 z-10 flex items-center gap-3 px-5 py-4 bg-white/85 backdrop-blur-xl
                  shadow-[0px_8px_24px_rgba(94,67,251,0.04)]">
        <button (click)="close.emit()"
                class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low active:scale-95 transition">
          <span class="material-symbols-outlined text-on-surface">arrow_back</span>
        </button>
        <span class="text-[11px] px-2 py-0.5 rounded font-bold inline-flex items-center gap-1"
              [style.background]="typeOf(t).bg" [style.color]="typeOf(t).color">
          <span class="material-symbols-outlined text-[13px]">{{ typeOf(t).icon }}</span>
          {{ typeOf(t).label }}
        </span>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto px-5 py-5 pb-40">

        <!-- Title (editable) -->
        <input [ngModel]="t.title" (change)="patch({ title: asValue($event) })"
               class="w-full text-[22px] font-bold text-on-surface leading-snug mb-5 font-manrope bg-transparent
                      outline-none border-b border-transparent focus:border-primary/30 transition-all" />

        <!-- Status side-panel (transitions) -->
        <div class="mb-6">
          <p class="text-[11px] font-bold text-outline uppercase tracking-wider mb-2">Status</p>
          <div class="flex gap-2">
            <button *ngFor="let s of statuses" (click)="changeStatus(s.id, t)"
                    class="flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl border transition-all active:scale-95"
                    [class]="t.status === s.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'">
              <span class="material-symbols-outlined text-[20px]">{{ s.icon }}</span>
              <span class="text-[12px] font-bold">{{ s.label }}</span>
            </button>
          </div>
          <div *ngIf="t.status === 'done'" class="mt-2 flex items-center gap-1.5 text-[12px] font-semibold"
               [style.color]="resOf(t.resolution).color">
            <span class="material-symbols-outlined text-[16px]">{{ resOf(t.resolution).icon }}</span>
            Resolution: {{ resOf(t.resolution).label }}
          </div>
        </div>

        <!-- Details (all editable) -->
        <div class="bg-white rounded-2xl p-4 mb-6 shadow-[0px_8px_24px_rgba(94,67,251,0.04)]">
          <p class="text-[11px] font-bold text-outline uppercase tracking-wider mb-3">Details</p>

          <!-- Assignee -->
          <div class="py-2 border-b border-surface-container">
            <div class="flex items-center justify-between">
              <span class="text-[13px] text-on-surface-variant">Assignee</span>
              <button (click)="toggleAssigneeEdit()" class="flex items-center gap-2">
                <ng-container *ngIf="memberOf(t) as m; else noAssignee">
                  <span class="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-white text-[9px] font-bold"
                        [style.background]="m.color">
                    <img *ngIf="m.avatarUrl; else mi" [src]="m.avatarUrl" [alt]="m.name" class="w-full h-full object-cover" />
                    <ng-template #mi>{{ m.initials }}</ng-template>
                  </span>
                  <span class="text-[13px] font-semibold text-on-surface">{{ m.name }}</span>
                </ng-container>
                <ng-template #noAssignee>
                  <span class="text-[13px] font-semibold text-on-surface-variant flex items-center gap-1">
                    <span class="material-symbols-outlined text-[16px]">person_off</span>Unassigned
                  </span>
                </ng-template>
                <span class="material-symbols-outlined text-[18px] text-outline">edit</span>
              </button>
            </div>

            <!-- Assignee editor -->
            <div *ngIf="editingAssignee()" class="mt-2">
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">search</span>
                <input type="text" [(ngModel)]="assigneeQuery" placeholder="Search a person…"
                       class="w-full pl-9 pr-3 py-2.5 rounded-xl bg-surface-container text-on-surface text-[14px] font-medium outline-none" />
              </div>
              <div class="mt-2 flex flex-col gap-1">
                <button (click)="clearTaskAssignee()"
                        class="flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-surface-container text-left">
                  <span class="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
                    <span class="material-symbols-outlined text-[15px]">person_off</span>
                  </span>
                  <span class="text-[13px] font-semibold text-on-surface-variant">Unassign</span>
                </button>
                <button *ngFor="let m of assignResults()" (click)="chooseAssignee(m.id)"
                        class="flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-surface-container text-left">
                  <span class="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-white text-[9px] font-bold"
                        [style.background]="m.color">
                    <img *ngIf="m.avatarUrl; else ami" [src]="m.avatarUrl" [alt]="m.name" class="w-full h-full object-cover" />
                    <ng-template #ami>{{ m.initials }}</ng-template>
                  </span>
                  <span class="text-[13px] font-semibold text-on-surface">{{ m.name }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Type -->
          <div class="py-2 border-b border-surface-container">
            <span class="text-[13px] text-on-surface-variant block mb-2">Type</span>
            <div class="flex flex-wrap gap-1.5">
              <button *ngFor="let ty of taskTypes" (click)="patch({ type: ty.id })"
                      class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all border"
                      [style.background]="t.type === ty.id ? ty.bg : 'transparent'"
                      [style.borderColor]="t.type === ty.id ? ty.color : '#e0e3e6'"
                      [style.color]="t.type === ty.id ? ty.color : '#43474a'">
                <span class="material-symbols-outlined text-[14px]">{{ ty.icon }}</span>{{ ty.label }}
              </button>
            </div>
          </div>

          <!-- Priority -->
          <div class="py-2 border-b border-surface-container">
            <span class="text-[13px] text-on-surface-variant block mb-2">Priority</span>
            <div class="bg-surface-container p-1 rounded-xl flex gap-1">
              <button *ngFor="let p of priorities" (click)="patch({ priority: p })"
                      class="flex-1 py-2 rounded-lg capitalize font-semibold text-[12px] transition-all"
                      [class]="t.priority === p ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant'">
                {{ p }}
              </button>
            </div>
          </div>

          <!-- Dates -->
          <div class="flex gap-3 py-2 border-b border-surface-container">
            <div class="flex-1">
              <span class="text-[13px] text-on-surface-variant block mb-1">Start date</span>
              <input type="date" [ngModel]="t.startDate" (ngModelChange)="patch({ startDate: $event })"
                     class="w-full px-3 py-2 rounded-xl bg-surface-container text-on-surface text-[13px] font-medium outline-none" />
            </div>
            <div class="flex-1">
              <span class="text-[13px] text-on-surface-variant block mb-1">End date</span>
              <input type="date" [ngModel]="t.dueDate" (ngModelChange)="patch({ dueDate: $event })" [min]="t.startDate"
                     class="w-full px-3 py-2 rounded-xl bg-surface-container text-on-surface text-[13px] font-medium outline-none" />
            </div>
          </div>

          <!-- Estimate -->
          <div class="flex items-center justify-between py-2">
            <span class="text-[13px] text-on-surface-variant">Estimate (hours)</span>
            <input type="number" min="0" step="0.5" [ngModel]="t.estimateHours" (ngModelChange)="patch({ estimateHours: +$event || 0 })"
                   class="w-20 px-3 py-2 rounded-xl bg-surface-container text-on-surface text-[13px] font-semibold outline-none text-right" />
          </div>
        </div>

        <!-- Description -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-2">
            <p class="text-[11px] font-bold text-outline uppercase tracking-wider">Description</p>
            <button *ngIf="!editingDesc()" (click)="startEditDesc(t)"
                    class="text-[12px] font-bold text-primary flex items-center gap-1">
              <span class="material-symbols-outlined text-[16px]">edit</span>Edit
            </button>
          </div>
          <ng-container *ngIf="!editingDesc(); else editDescTpl">
            <p class="text-[15px] text-on-surface whitespace-pre-wrap" *ngIf="t.description.trim(); else noDesc">{{ t.description }}</p>
            <ng-template #noDesc>
              <p class="text-[14px] text-on-surface-variant italic">No description yet.</p>
            </ng-template>
          </ng-container>
          <ng-template #editDescTpl>
            <textarea [(ngModel)]="descDraft" rows="4"
                      class="w-full px-4 py-3 rounded-2xl bg-surface-container text-on-surface text-[15px] font-medium
                             outline-none border border-transparent focus:border-primary/30 transition-all resize-none"></textarea>
            <div class="flex gap-2 mt-2">
              <button (click)="cancelEditDesc()"
                      class="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface-variant text-[13px] font-bold active:scale-95">Cancel</button>
              <button (click)="saveDesc(t)"
                      class="flex-1 py-2.5 rounded-xl text-white text-[13px] font-bold bg-gradient-to-tr from-primary to-secondary-container active:scale-95">Save</button>
            </div>
          </ng-template>
        </div>

        <!-- Comments -->
        <div>
          <p class="text-[11px] font-bold text-outline uppercase tracking-wider mb-3">
            Comments <span class="ml-1 text-on-surface-variant">({{ comments().length }})</span>
          </p>

          <div class="flex flex-col gap-4">
            <div *ngFor="let c of comments()" class="flex gap-3">
              <span class="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                    [style.background]="c.authorColor">
                <img *ngIf="c.authorAvatarUrl; else ci" [src]="c.authorAvatarUrl" [alt]="c.authorName" class="w-full h-full object-cover" />
                <ng-template #ci>{{ c.authorInitials }}</ng-template>
              </span>
              <div class="flex-1 bg-white rounded-2xl p-3 shadow-[0px_8px_24px_rgba(94,67,251,0.04)]">
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
                    <div *ngIf="mentionOpen() && mentionTarget === 'edit'"
                         class="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl overflow-hidden max-h-40 overflow-y-auto"
                         style="box-shadow:0 8px 30px rgba(0,0,0,0.15);">
                      <ng-container *ngTemplateOutlet="mentionList"></ng-container>
                    </div>
                  </div>
                  <div class="flex gap-2 mt-2">
                    <button (click)="cancelCommentEdit()" class="flex-1 py-2 rounded-lg bg-surface-container text-on-surface-variant text-[12px] font-bold active:scale-95">Cancel</button>
                    <button (click)="saveCommentEdit(c)" class="flex-1 py-2 rounded-lg text-white text-[12px] font-bold bg-gradient-to-tr from-primary to-secondary-container active:scale-95">Save</button>
                  </div>
                </ng-container>
                <ng-template #showBody>
                  <p class="text-[14px] text-on-surface whitespace-pre-wrap leading-relaxed">
                    <ng-container *ngFor="let seg of segments(c.text)"><span *ngIf="seg.mention" class="text-primary font-semibold bg-primary/10 rounded px-1">{{ seg.text }}</span><ng-container *ngIf="!seg.mention">{{ seg.text }}</ng-container></ng-container>
                  </p>
                </ng-template>
              </div>
            </div>

            <p *ngIf="!comments().length" class="text-[14px] text-on-surface-variant italic">No comments yet. Start the conversation.</p>
          </div>
        </div>
      </div>

      <!-- Comment composer -->
      <div class="absolute bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-xl border-t border-surface-container">
        <!-- @mention suggestions -->
        <div *ngIf="mentionOpen() && mentionTarget === 'new'"
             class="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-2xl overflow-hidden max-h-48 overflow-y-auto"
             style="box-shadow:0 8px 30px rgba(0,0,0,0.15);">
          <ng-container *ngTemplateOutlet="mentionList"></ng-container>
        </div>

        <div class="flex items-end gap-2">
          <span class="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                [style.background]="me.color">
            <img *ngIf="me.avatarUrl; else myi" [src]="me.avatarUrl" [alt]="me.name" class="w-full h-full object-cover" />
            <ng-template #myi>{{ me.initials }}</ng-template>
          </span>
          <textarea #composer [value]="newComment" (input)="onCommentInput($event, 'new')" rows="1"
                    placeholder="Add a comment… use @ to mention"
                    class="flex-1 px-4 py-2.5 rounded-2xl bg-surface-container text-on-surface text-[15px] font-medium
                           outline-none border border-transparent focus:border-primary/30 transition-all resize-none max-h-24"></textarea>
          <button (click)="send()" [disabled]="!newComment.trim()"
                  class="w-11 h-11 rounded-full flex items-center justify-center text-white flex-shrink-0
                         bg-gradient-to-tr from-primary to-secondary-container active:scale-90 transition disabled:opacity-40">
            <span class="material-symbols-outlined text-[20px]">send</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Resolution modal -->
    <div *ngIf="showResolution()" class="fixed inset-0 z-[10001] flex items-end justify-center md:items-center" (click)="showResolution.set(false)">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
      <div class="relative bg-white rounded-t-[28px] md:rounded-[28px] w-full md:max-w-md p-6 pb-10" style="box-shadow:0 -8px 40px rgba(0,0,0,0.12);"
           (click)="$event.stopPropagation()">
        <div class="w-12 h-1 rounded-full bg-outline-variant mx-auto mb-6 md:hidden"></div>
        <h3 class="font-bold text-[22px] text-on-surface mb-1 font-manrope">Close task</h3>
        <p class="text-[14px] text-on-surface-variant mb-5">How was this resolved?</p>
        <div class="flex flex-col gap-2">
          <button *ngFor="let r of resolutions" (click)="pickResolution(r.id)"
                  class="flex items-center gap-3 p-3 rounded-2xl border border-outline-variant
                         hover:border-primary/40 hover:bg-surface-container-low transition-all text-left active:scale-[0.98]">
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
        <span class="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
              [style.background]="m.color">
          <img *ngIf="m.avatarUrl; else mlInit" [src]="m.avatarUrl" [alt]="m.name" class="w-full h-full object-cover" />
          <ng-template #mlInit>{{ m.initials }}</ng-template>
        </span>
        <span class="text-[14px] font-semibold text-on-surface">{{ m.name }}</span>
      </button>
      <p *ngIf="!mentionResults().length" class="px-3 py-3 text-[13px] text-on-surface-variant">No people found.</p>
    </ng-template>
  `,
})
export class TaskDetailComponent {
  private service = inject(ProjectService);

  taskId = input.required<string>();
  close = output<void>();

  @ViewChild('composer') composer?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('editComposer') editComposer?: ElementRef<HTMLTextAreaElement>;

  readonly statuses = STATUSES;
  readonly resolutions = RESOLUTIONS;
  readonly taskTypes = TASK_TYPES;
  readonly priorities: Task['priority'][] = ['low', 'medium', 'high'];
  readonly teamMembers = this.service.teamMembers;
  readonly me = this.service.currentMember;

  task = computed<Task | undefined>(() => this.service.tasks().find(t => t.id === this.taskId()));
  comments = computed(() => this.service.comments().filter(c => c.taskId === this.taskId()));

  editingDesc = signal(false);
  descDraft = '';
  showResolution = signal(false);

  editingAssignee = signal(false);
  assigneeQuery = '';

  editingCommentId = signal<string | null>(null);
  commentDraft = '';

  newComment = '';
  mentionOpen = signal(false);
  mentionResults = signal<TeamMember[]>([]);
  mentionTarget: 'new' | 'edit' = 'new';
  private mentionStart = -1;
  private mentionEnd = -1;

  private readonly mentionRegex: RegExp;
  private readonly mentionTokens: Set<string>;

  constructor() {
    const names = this.service.teamMembers
      .map(m => m.name)
      .sort((a, b) => b.length - a.length)
      .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    this.mentionRegex = new RegExp(`(@(?:${names.join('|')}))`, 'g');
    this.mentionTokens = new Set(this.service.teamMembers.map(m => '@' + m.name));
  }

  // ── Inline patching ─────────────────────────────────────────────────
  patch(patch: Partial<Task>): void {
    this.service.updateTask(this.taskId(), patch);
  }

  asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  // ── Status transitions ──────────────────────────────────────────────
  changeStatus(status: Task['status'], task: Task): void {
    if (task.status === status) return;
    if (status === 'done') { this.showResolution.set(true); return; }
    this.service.updateTaskStatus(task.id, status);
  }

  pickResolution(resolution: TaskResolution): void {
    this.service.updateTaskStatus(this.taskId(), 'done', resolution);
    this.showResolution.set(false);
  }

  // ── Assignee editing ────────────────────────────────────────────────
  toggleAssigneeEdit(): void {
    this.editingAssignee.update(v => !v);
    this.assigneeQuery = '';
  }

  assignResults(): TeamMember[] {
    const q = this.assigneeQuery.trim().toLowerCase();
    if (!q) return this.teamMembers;
    return this.teamMembers.filter(m => m.name.toLowerCase().includes(q) || m.initials.toLowerCase().includes(q));
  }

  chooseAssignee(id: string): void {
    this.patch({ assigneeId: id });
    this.editingAssignee.set(false);
  }

  clearTaskAssignee(): void {
    this.patch({ assigneeId: undefined });
    this.editingAssignee.set(false);
  }

  // ── Description ──────────────────────────────────────────────────────
  startEditDesc(task: Task): void { this.descDraft = task.description; this.editingDesc.set(true); }
  cancelEditDesc(): void { this.editingDesc.set(false); }
  saveDesc(task: Task): void { this.service.updateTask(task.id, { description: this.descDraft.trim() }); this.editingDesc.set(false); }

  // ── Comments ─────────────────────────────────────────────────────────
  send(): void {
    if (!this.newComment.trim()) return;
    this.service.addComment(this.taskId(), this.newComment);
    this.newComment = '';
    this.mentionOpen.set(false);
  }

  startEditComment(c: { id: string; text: string }): void {
    this.editingCommentId.set(c.id);
    this.commentDraft = c.text;
  }
  cancelCommentEdit(): void { this.editingCommentId.set(null); }
  saveCommentEdit(c: { id: string }): void {
    this.service.updateComment(c.id, this.commentDraft);
    this.editingCommentId.set(null);
  }
  removeComment(c: { id: string }): void { this.service.deleteComment(c.id); }

  // ── @mentions ────────────────────────────────────────────────────────
  onCommentInput(event: Event, target: 'new' | 'edit'): void {
    const el = event.target as HTMLTextAreaElement;
    if (target === 'new') this.newComment = el.value;
    else this.commentDraft = el.value;
    this.mentionTarget = target;

    const pos = el.selectionStart ?? el.value.length;
    const upto = el.value.slice(0, pos);
    const match = upto.match(/(?:^|\s)@(\w*)$/);
    if (match) {
      this.mentionStart = pos - match[1].length - 1;
      this.mentionEnd = pos;
      const q = match[1].toLowerCase();
      this.mentionResults.set(
        this.teamMembers.filter(m => m.name.toLowerCase().includes(q) || m.initials.toLowerCase().includes(q)),
      );
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
    if (isNew) this.newComment = next;
    else this.commentDraft = next;
    this.mentionOpen.set(false);

    setTimeout(() => {
      const el = (isNew ? this.composer : this.editComposer)?.nativeElement;
      if (el) {
        const caret = (before + inserted).length;
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
  }

  segments(text: string): Segment[] {
    return text
      .split(this.mentionRegex)
      .filter(p => p !== '')
      .map(p => ({ text: p, mention: this.mentionTokens.has(p) }));
  }

  // ── Display helpers ──────────────────────────────────────────────────
  typeOf(task: Task): TaskTypeDef { return typeInfo(task); }
  resOf(res: Task['resolution']): ResolutionDef { return resolutionInfo(res); }
  memberOf(task: Task): TeamMember | undefined {
    return this.teamMembers.find(m => m.id === task.assigneeId);
  }
}
