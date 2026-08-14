import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
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
  private readonly translateService = inject(TranslateService);

  readonly header = input<string | null>(null);
  readonly message = input<string | null>(null);
  readonly confirmed = output<void>();

  confirm(): void {
    this.confirmationService.confirm({
      header: this.header() ?? this.translateService.instant('common.confirmDelete.title'),
      message: this.message() ?? this.translateService.instant('common.confirmDelete.defaultMessage'),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.confirmed.emit()
    });
  }
}
