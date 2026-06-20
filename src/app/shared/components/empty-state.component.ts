import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule],
  template: `
    <div class="app-surface p-5 text-center flex flex-column align-items-center gap-3">
      <i [class]="icon()" class="text-4xl text-primary"></i>
      <div>
        <h3 class="m-0">{{ title() }}</h3>
        <p class="mt-2 mb-0 text-600">{{ message() }}</p>
      </div>

      @if (actionLabel()) {
        <button pButton type="button" [label]="actionLabel()" (click)="onAction()"></button>
      }
    </div>
  `
})
export class EmptyStateComponent {
  readonly icon = input('pi pi-inbox');
  readonly title = input('Nothing to show');
  readonly message = input('There are no records available right now.');
  readonly actionLabel = input('');
  readonly action = input<(() => void) | null>(null);

  onAction(): void {
    this.action()?.();
  }
}
