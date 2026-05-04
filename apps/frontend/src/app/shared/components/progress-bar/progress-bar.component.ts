import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full bg-surface-container h-2 rounded-full overflow-hidden">
      <div
        class="h-full rounded-full transition-all duration-500"
        [style.width.%]="clampedValue"
        [style.background]="gradient"
      ></div>
    </div>
  `,
})
export class ProgressBarComponent {
  @Input() value = 0;
  @Input() gradient = 'linear-gradient(90deg, #451de3, #00c1fd)';

  get clampedValue(): number {
    return Math.min(100, Math.max(0, this.value));
  }
}
