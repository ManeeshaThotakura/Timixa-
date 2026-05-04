import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../../core/services/project.service';
import { ProjectCardComponent } from '../../../shared/components/project-card/project-card.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { FabComponent } from '../../../shared/components/fab/fab.component';

@Component({
  selector: 'app-projects-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ProjectCardComponent, StatCardComponent, FabComponent],
  template: `
    <div class="px-margin-page pt-stack-lg pb-4">

      <!-- Header -->
      <section class="flex flex-col gap-1 mb-stack-lg">
        <div class="flex justify-between items-end">
          <div>
            <h1 class="font-manrope font-bold text-h1 text-on-surface">Projects</h1>
            <p class="text-on-surface-variant text-sm mt-0.5">Manage your active workflows</p>
          </div>
          <!-- List / Grid toggle -->
          <div class="bg-surface-container-high p-1 rounded-xl flex gap-1">
            <button (click)="viewMode = 'list'"
                    class="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all"
                    [class]="viewMode === 'list' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant'">
              <span class="material-symbols-outlined text-[16px]">list</span>
              List
            </button>
            <button (click)="viewMode = 'grid'"
                    class="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all"
                    [class]="viewMode === 'grid' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant'">
              <span class="material-symbols-outlined text-[16px]">grid_view</span>
              Grid
            </button>
          </div>
        </div>
      </section>

      <!-- Stats Row -->
      <section class="grid grid-cols-3 gap-3 mb-stack-lg">
        <div class="col-span-1">
          <app-stat-card
            icon="rocket_launch"
            [value]="stats().activeCount"
            label="Active Projects"
            iconBg="rgba(69,29,227,0.1)"
            iconColor="#451de3"
            trend="up"
            trendLabel="+2 this week"
          />
        </div>
        <div class="col-span-1">
          <app-stat-card
            icon="done_all"
            [value]="stats().velocity + '%'"
            label="Velocity"
            iconBg="rgba(0,102,136,0.1)"
            iconColor="#006688"
          />
        </div>
        <div class="col-span-1">
          <app-stat-card
            icon="schedule"
            [value]="stats().dueSoonCount"
            label="Due Soon"
            iconBg="rgba(186,26,26,0.1)"
            iconColor="#ba1a1a"
          />
        </div>
      </section>

      <!-- Project List / Grid -->
      <section>
        <div class="flex items-center justify-between mb-stack-md">
          <h3 class="font-manrope font-bold text-[18px] text-on-surface">All Projects</h3>
          <span class="font-label-sm text-label-sm text-on-surface-variant">{{ projects().length }} total</span>
        </div>

        <div [class]="viewMode === 'grid' ? 'grid grid-cols-2 gap-4' : 'flex flex-col gap-4'">
          <app-project-card
            *ngFor="let project of projects()"
            [project]="project"
            (clicked)="openKanban($event)"
          />
        </div>
      </section>
    </div>

    <!-- FAB -->
    <div class="fixed bottom-28 right-6 z-40">
      <app-fab (clicked)="showModal = true" />
    </div>

    <!-- New Project Modal -->
    <div *ngIf="showModal"
         class="fixed inset-0 z-50 flex items-end justify-center"
         (click)="showModal = false">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
      <div class="relative bg-surface-container-lowest rounded-t-[28px] w-full p-6 pb-10 shadow-card-active"
           (click)="$event.stopPropagation()">
        <div class="w-12 h-1 rounded-full bg-outline-variant mx-auto mb-6"></div>
        <h3 class="font-manrope font-bold text-h2 text-on-surface mb-5">New Project</h3>
        <input type="text" [(ngModel)]="newProjectTitle" placeholder="Project title"
               class="input-ghost mb-3" />
        <input type="text" [(ngModel)]="newProjectDesc" placeholder="Short description"
               class="input-ghost mb-4" />
        <div class="flex gap-3">
          <button (click)="showModal = false" class="btn-ghost flex-1">Cancel</button>
          <button (click)="addProject()" class="btn-primary flex-1">Create</button>
        </div>
      </div>
    </div>
  `,
})
export class ProjectsDashboardComponent implements OnInit {
  private projectService = inject(ProjectService);
  private router = inject(Router);

  projects = this.projectService.projects;
  stats = this.projectService.stats;
  viewMode: 'list' | 'grid' = 'list';
  showModal = false;
  newProjectTitle = '';
  newProjectDesc = '';

  ngOnInit(): void {
    this.projectService.load();
  }

  openKanban(projectId: string): void {
    this.router.navigate(['/projects', projectId, 'board']);
  }

  addProject(): void {
    this.newProjectTitle = '';
    this.newProjectDesc = '';
    this.showModal = false;
  }
}
