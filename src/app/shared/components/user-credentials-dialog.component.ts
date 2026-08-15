import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastService } from '../../core/services/toast.service';

/** Shown once right after a new user is provisioned, so the admin can copy/share their temporary password. */
@Component({
  selector: 'app-user-credentials-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, DialogModule, ButtonModule, InputTextModule],
  template: `
    <p-dialog
      [header]="'shared.userCredentials.header' | translate"
      [visible]="visible()"
      (visibleChange)="visibleChange.emit($event)"
      [modal]="true"
      [style]="{ width: 'min(30rem, 95vw)' }"
    >
      <p class="text-600 mt-0">{{ 'shared.userCredentials.body' | translate }}</p>

      <div class="flex flex-column gap-3">
        <div class="flex flex-column gap-2">
          <label>{{ 'shared.userCredentials.emailLabel' | translate }}</label>
          <div class="flex gap-2">
            <input pInputText [value]="email()" readonly class="flex-1" />
            <button pButton type="button" icon="pi pi-copy" severity="secondary" outlined (click)="copy(email())"></button>
          </div>
        </div>

        <div class="flex flex-column gap-2">
          <label>{{ 'shared.userCredentials.passwordLabel' | translate }}</label>
          <div class="flex gap-2">
            <input pInputText [value]="password()" readonly class="flex-1 font-mono" />
            <button pButton type="button" icon="pi pi-copy" severity="secondary" outlined (click)="copy(password())"></button>
          </div>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <button pButton type="button" [label]="'common.actions.close' | translate" (click)="visibleChange.emit(false)"></button>
      </ng-template>
    </p-dialog>
  `
})
export class UserCredentialsDialogComponent {
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  readonly visible = input(false);
  readonly email = input('');
  readonly password = input('');

  readonly visibleChange = output<boolean>();

  private readonly copying = signal(false);

  async copy(value: string): Promise<void> {
    if (this.copying() || !value) {
      return;
    }

    this.copying.set(true);

    try {
      await navigator.clipboard.writeText(value);
      this.toastService.success(
        this.translateService.instant('shared.userCredentials.toast.copiedTitle'),
        this.translateService.instant('shared.userCredentials.toast.copiedBody')
      );
    } catch (error) {
      console.error(error);
    } finally {
      this.copying.set(false);
    }
  }
}
