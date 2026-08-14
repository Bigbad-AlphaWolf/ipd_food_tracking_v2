import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../../core/services/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, CardModule, TagModule, PageHeaderComponent],
  template: `
    <app-page-header
      [eyebrow]="'employee.profile.eyebrow' | translate"
      [title]="'employee.profile.title' | translate"
      [subtitle]="'employee.profile.subtitle' | translate"
    ></app-page-header>

    <p-card>
      <div class="flex flex-column gap-3">
        <div>
          <small class="text-500">{{ 'employee.profile.fullNameLabel' | translate }}</small>
          <div class="font-semibold">{{ authService.profile()?.full_name || ('common.placeholders.notAvailable' | translate) }}</div>
        </div>
        <div>
          <small class="text-500">{{ 'employee.profile.emailLabel' | translate }}</small>
          <div>{{ authService.profile()?.email || ('common.placeholders.notAvailable' | translate) }}</div>
        </div>
        <div class="flex align-items-center justify-content-between gap-2 flex-wrap">
          <div>
            <small class="text-500">{{ 'employee.profile.departmentLabel' | translate }}</small>
            <div>{{ authService.profile()?.department || ('common.placeholders.notAssigned' | translate) }}</div>
          </div>
          <p-tag [value]="roleLabels()" severity="info"></p-tag>
        </div>
      </div>
    </p-card>
  `
})
export class ProfileComponent {
  readonly authService = inject(AuthService);
  private readonly translateService = inject(TranslateService);

  readonly roleLabels = computed(() => {
    this.translateService.currentLang();
    const roles = this.authService.roles();
    const labels = roles.map((role) => this.translateService.instant(`roles.${role}`));
    return labels.length > 0 ? labels.join(', ') : this.translateService.instant('roles.employee');
  });
}
