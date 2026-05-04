import { Component, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-fab',
  standalone: true,
  template: `
    <button
      (click)="clicked.emit()"
      class="w-14 h-14 rounded-full flex items-center justify-center shadow-card-active
             active:scale-90 transition-all duration-200 z-40"
      style="background: linear-gradient(135deg, #451de3, #00c1fd)">
      <span class="material-symbols-outlined text-white text-[28px]">add</span>
    </button>
  `,
})
export class FabComponent {
  @Output() clicked = new EventEmitter<void>();
}
