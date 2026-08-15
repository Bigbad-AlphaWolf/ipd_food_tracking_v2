import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthApiError } from '@supabase/supabase-js';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-force-password-change',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, CardModule, ButtonModule, PasswordModule],
  template: `
    <div class="min-h-screen flex align-items-center justify-content-center p-3">
      <p-card class="w-full" [style]="{ maxWidth: '28rem' }">
        <h2 class="mt-0 mb-2">{{ 'auth.forcePasswordChange.title' | translate }}</h2>
        <p class="text-600 mt-0 mb-4">{{ 'auth.forcePasswordChange.subtitle' | translate }}</p>

        <form class="flex flex-column gap-4" [formGroup]="form" (ngSubmit)="submit()">
          <div class="flex flex-column gap-2">
            <label for="new-password" class="font-medium">{{ 'auth.forcePasswordChange.newPasswordLabel' | translate }}</label>
            <p-password
              inputId="new-password"
              formControlName="newPassword"
              [feedback]="true"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
            ></p-password>
          </div>

          <div class="flex flex-column gap-2">
            <label for="confirm-password" class="font-medium">{{ 'auth.forcePasswordChange.confirmPasswordLabel' | translate }}</label>
            <p-password
              inputId="confirm-password"
              formControlName="confirmPassword"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
            ></p-password>
          </div>

          @if (form.hasError('passwordMismatch') && form.controls.confirmPassword.touched) {
            <small class="text-red-500">{{ 'auth.forcePasswordChange.passwordMismatch' | translate }}</small>
          }

          @if (form.controls.newPassword.hasError('samePassword')) {
            <small class="text-red-500">{{ 'auth.forcePasswordChange.samePassword' | translate }}</small>
          }

          <button pButton type="submit" [label]="'auth.forcePasswordChange.submit' | translate" [disabled]="form.invalid || saving()"></button>
        </form>
      </p-card>
    </div>
  `
})
export class ForcePasswordChangeComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(6)]]
    },
    { validators: this.passwordsMatchValidator }
  );

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);

    try {
      await this.authService.completeForcedPasswordChange(this.form.getRawValue().newPassword);
      this.toastService.success(
        this.translateService.instant('auth.forcePasswordChange.toast.successTitle'),
        this.translateService.instant('auth.forcePasswordChange.toast.successBody')
      );
    } catch (error) {
      console.error(error);

      if (error instanceof AuthApiError && error.code === 'same_password') {
        this.form.controls.newPassword.setErrors({ samePassword: true });
        this.toastService.error(
          this.translateService.instant('auth.forcePasswordChange.toast.samePasswordTitle'),
          this.translateService.instant('auth.forcePasswordChange.toast.samePasswordBody')
        );
      } else {
        this.toastService.error(
          this.translateService.instant('auth.forcePasswordChange.toast.failureTitle'),
          this.translateService.instant('auth.forcePasswordChange.toast.failureBody')
        );
      }
    } finally {
      this.saving.set(false);
    }
  }

  private passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPassword = control.get('newPassword')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }
}
