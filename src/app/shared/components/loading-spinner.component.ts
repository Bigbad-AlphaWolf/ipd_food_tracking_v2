import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  selector: 'app-loading-spinner',
  imports: [ProgressSpinnerModule, TranslatePipe],
  template: `
    <div class="loading-wrapper" [class.loading-overlay]="overlay()">
      <p-progressSpinner [ariaLabel]="'common.loading' | translate"></p-progressSpinner>
    </div>
  `,
  styles: [
    `
      .loading-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 8rem;
      }

      .loading-overlay {
        position: fixed;
        inset: 0;
        z-index: 1100;
        background: rgba(15, 23, 40, 0.22);
        backdrop-filter: blur(6px);
      }
    `
  ]
})
export class LoadingSpinnerComponent {
  readonly overlay = input(false);
}
