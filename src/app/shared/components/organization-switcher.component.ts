import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { SelectModule } from 'primeng/select';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-organization-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule, TranslatePipe],
  template: `
    @if (authService.organizations().length > 1) {
      <p-select
        [options]="authService.organizations()"
        optionLabel="name"
        optionValue="id"
        [ngModel]="authService.activeOrganization()?.id ?? null"
        (ngModelChange)="switchOrganization($event)"
        [disabled]="switching()"
        [placeholder]="'shell.switchOrganization' | translate"
        [attr.aria-label]="'shell.switchOrganization' | translate"
        appendTo="body"
        class="w-full"
      ></p-select>
    }
  `
})
export class OrganizationSwitcherComponent {
  readonly authService = inject(AuthService);
  readonly switching = signal(false);

  async switchOrganization(organizationId: string | null): Promise<void> {
    if (!organizationId || organizationId === this.authService.activeOrganization()?.id) {
      return;
    }

    this.switching.set(true);
    try {
      await this.authService.switchOrganization(organizationId);
    } finally {
      this.switching.set(false);
    }
  }
}
