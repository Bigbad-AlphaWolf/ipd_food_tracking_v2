import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-confirm-delete',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule],
  template: `
    <button pButton type="button" icon="pi pi-trash" severity="danger" text rounded (click)="confirm()"></button>
  `
})
export class ConfirmDeleteComponent {
  private readonly confirmationService = inject(ConfirmationService);

  readonly header = input('Confirm deletion');
  readonly message = input('This action cannot be undone.');
  readonly confirmed = output<void>();

  confirm(): void {
    this.confirmationService.confirm({
      header: this.header(),
      message: this.message(),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.confirmed.emit()
    });
  }
}
