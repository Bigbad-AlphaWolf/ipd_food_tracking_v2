import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { DividerModule } from 'primeng/divider';
import { AuthService } from '../core/services/auth.service';
import { LoadingService } from '../core/services/loading.service';
import { LanguageSwitcherComponent } from '../shared/components/language-switcher.component';
import { LoadingSpinnerComponent } from '../shared/components/loading-spinner.component';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    TranslatePipe,
    CardModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    DividerModule,
    LanguageSwitcherComponent,
    LoadingSpinnerComponent
  ],
  template: `
    <div class="min-h-screen flex align-items-center justify-content-center p-3">
      <div class="w-full max-w-6xl">
        <div class="flex justify-content-end mb-3">
          <app-language-switcher></app-language-switcher>
        </div>

        <div class="grid align-items-center">
          <div class="col-12 lg:col-6">
            <div class="pr-0 lg:pr-8">
              <span class="text-sm text-primary font-semibold">{{ 'common.appName' | translate }}</span>
              <h1 class="text-5xl mt-2 mb-3">{{ 'auth.login.heroTitle' | translate }}</h1>
              <p class="text-lg text-600 line-height-3 mb-5">
                {{ 'auth.login.heroBody' | translate }}
              </p>
              <div class="grid">
                <div class="col-12 sm:col-6">
                  <div class="app-surface p-4 h-full">
                    <i class="pi pi-mobile text-2xl text-primary"></i>
                    <h3 class="mt-3 mb-2">{{ 'auth.login.mobileFirstTitle' | translate }}</h3>
                    <p class="m-0 text-600">{{ 'auth.login.mobileFirstBody' | translate }}</p>
                  </div>
                </div>
                <div class="col-12 sm:col-6">
                  <div class="app-surface p-4 h-full">
                    <i class="pi pi-chart-line text-2xl text-primary"></i>
                    <h3 class="mt-3 mb-2">{{ 'auth.login.reportsTitle' | translate }}</h3>
                    <p class="m-0 text-600">{{ 'auth.login.reportsBody' | translate }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="col-12 lg:col-6">
            <p-card styleClass="glass-card">
              <ng-template pTemplate="header">
                <div class="p-4 pb-0">
                  <span class="text-sm text-500">{{ 'auth.login.secureAccess' | translate }}</span>
                  <h2 class="mt-2 mb-1">{{ 'auth.login.title' | translate }}</h2>
                  <p class="m-0 text-600">{{ 'auth.login.subtitle' | translate }}</p>
                </div>
              </ng-template>

              <form class="flex flex-column gap-4" [formGroup]="form" (ngSubmit)="submit()">
                <div class="flex flex-column gap-2">
                  <label for="identifier" class="font-medium">{{ 'auth.login.identifierLabel' | translate }}</label>
                  <input pInputText id="identifier" formControlName="identifier" [placeholder]="'auth.login.identifierPlaceholder' | translate" />
                </div>

                <div class="flex flex-column gap-2">
                  <label for="password" class="font-medium">{{ 'auth.login.passwordLabel' | translate }}</label>
                  <p-password
                    inputId="password"
                    formControlName="password"
                    [feedback]="false"
                    [toggleMask]="true"
                    styleClass="w-full"
                    inputStyleClass="w-full"
                  ></p-password>
                </div>

                <button pButton type="submit" [label]="'auth.login.submit' | translate" [disabled]="form.invalid || loadingService.isLoading()"></button>
                <a pButton severity="secondary" outlined routerLink="/register-employee" [label]="'auth.login.registerAction' | translate"></a>
              </form>

              <p-divider></p-divider>
              <p class="m-0 text-sm text-500">{{ 'auth.login.accessNote' | translate }}</p>
            </p-card>
          </div>
        </div>
      </div>

      @if (loadingService.isLoading()) {
        <app-loading-spinner [overlay]="true"></app-loading-spinner>
      }
    </div>
  `
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly loadingService = inject(LoadingService);

  readonly form = this.fb.nonNullable.group({
    identifier: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { identifier, password } = this.form.getRawValue();
    await this.authService.signIn(identifier, password);
  }
}
