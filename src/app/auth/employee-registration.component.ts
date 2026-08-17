import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MultiSelectModule } from 'primeng/multiselect';
import { AuthService } from '../core/services/auth.service';
import { LoadingService } from '../core/services/loading.service';
import { ToastService } from '../core/services/toast.service';
import { LanguageSwitcherComponent } from '../shared/components/language-switcher.component';
import { LoadingSpinnerComponent } from '../shared/components/loading-spinner.component';
import { SelectOption } from '../core/models/app.models';
import { RegistrationError } from '../core/utils/registration-error.util';

@Component({
  selector: 'app-employee-registration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    TranslatePipe,
    CardModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    MultiSelectModule,
    LanguageSwitcherComponent,
    LoadingSpinnerComponent
  ],
  templateUrl: './employee-registration.component.html',
  styleUrl: './employee-registration.component.css'
})
export class EmployeeRegistrationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  readonly loadingService = inject(LoadingService);

  readonly organizationOptions = signal<SelectOption<string>[]>([]);
  readonly loadingOrganizations = signal(true);

  readonly form = this.fb.nonNullable.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      organizationIds: [[] as string[], Validators.required],
      phoneNumber: [''],
      department: [''],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(6)]]
    },
    { validators: this.passwordsMatchValidator }
  );

  constructor() {
    void this.loadOrganizations();
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    try {
      await this.authService.registerEmployee({
        fullName: value.fullName,
        email: value.email,
        password: value.password,
        organizationIds: value.organizationIds,
        phoneNumber: value.phoneNumber,
        department: value.department
      });
    } catch (error) {
      console.error(error);

      if (error instanceof RegistrationError && error.reason === 'email_taken') {
        this.form.controls.email.setErrors({ emailTaken: true });
        this.toastService.error(
          this.translateService.instant('auth.registration.toast.emailTakenTitle'),
          this.translateService.instant('auth.registration.toast.emailTakenBody')
        );
      } else if (error instanceof RegistrationError && error.reason === 'phone_taken') {
        this.form.controls.phoneNumber.setErrors({ phoneTaken: true });
        this.toastService.error(
          this.translateService.instant('auth.registration.toast.phoneTakenTitle'),
          this.translateService.instant('auth.registration.toast.phoneTakenBody')
        );
      } else {
        this.toastService.error(
          this.translateService.instant('auth.registration.toast.failureTitle'),
          this.translateService.instant('auth.registration.toast.failureBody')
        );
      }
    }
  }

  private async loadOrganizations(): Promise<void> {
    this.loadingOrganizations.set(true);
    try {
      const organizations = await this.authService.getRegistrableOrganizations();
      this.organizationOptions.set(organizations.map((org) => ({ label: `${org.name} (${org.code})`, value: org.id })));
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('auth.registration.toast.organizationsUnavailableTitle'),
        this.translateService.instant('auth.registration.toast.organizationsUnavailableBody')
      );
    } finally {
      this.loadingOrganizations.set(false);
    }
  }

  private passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }
}
