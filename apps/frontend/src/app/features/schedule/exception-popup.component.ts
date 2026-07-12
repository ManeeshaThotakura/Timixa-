import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-exception-popup',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-6"
         style="background:rgba(26,28,30,0.4); backdrop-filter:blur(4px);"
         (click)="no.emit(remember)">
      <div class="bg-surface-container-lowest w-full max-w-sm rounded-[20px] overflow-hidden border border-outline-variant/10"
           style="box-shadow:0 24px 48px rgba(0,0,0,0.12);"
           (click)="$event.stopPropagation()"
           data-testid="exception-popup">
        <div class="p-6">
          <h3 class="font-bold text-[20px] text-on-surface" style="font-family:Manrope;"
              data-testid="exception-popup-title">{{ title }}</h3>
          <label *ngIf="showRemember"
                 class="mt-4 flex items-center gap-2 cursor-pointer select-none"
                 data-testid="exception-popup-remember">
            <input type="checkbox"
                   [checked]="remember"
                   (change)="remember = $any($event.target).checked"
                   class="w-4 h-4 accent-primary" />
            <span class="text-[13px] text-on-surface-variant">Remember my choice while I'm here</span>
          </label>
        </div>
        <div class="flex gap-3 p-4 border-t border-outline-variant/10"
             style="background:rgba(238,238,240,0.3);">
          <button (click)="no.emit(remember)"
                  class="flex-1 py-3 text-on-surface-variant font-semibold hover:bg-surface-container-high rounded-xl transition-colors"
                  data-testid="exception-popup-no">{{ noLabel }}</button>
          <button (click)="yes.emit(remember)"
                  class="flex-1 py-3 text-white font-semibold rounded-xl transition-all active:scale-95"
                  style="background:#5e43fb; box-shadow:0 4px 12px rgba(94,67,251,0.3);"
                  data-testid="exception-popup-yes">{{ yesLabel }}</button>
        </div>
      </div>
    </div>
  `,
})
export class ExceptionPopupComponent {
  @Input() title = '';
  @Input() yesLabel = 'Yes, every week';
  @Input() noLabel = 'No, just this date';
  @Input() showRemember = false;
  @Output() yes = new EventEmitter<boolean>();
  @Output() no = new EventEmitter<boolean>();

  remember = false;
}
