import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../core/services/auth.service';
import { LoadingService } from '../core/services/loading.service';
import { LanguageSwitcherComponent } from '../shared/components/language-switcher.component';
import { LoadingSpinnerComponent } from '../shared/components/loading-spinner.component';

const MIN_ORGANIZATION_CODES = 1;

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
    LanguageSwitcherComponent,
    LoadingSpinnerComponent
  ],
  templateUrl: './employee-registration.component.html',
  styleUrl: './employee-registration.component.css'
})
export class EmployeeRegistrationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly loadingService = inject(LoadingService);

  readonly form = this.fb.nonNullable.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      organizationCodes: this.fb.nonNullable.array(
        [this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)])],
        Validators.minLength(MIN_ORGANIZATION_CODES)
      ),
      phoneNumber: [''],
      department: [''],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(6)]]
    },
    { validators: this.passwordsMatchValidator }
  );

  get organizationCodes() {
    return this.form.controls.organizationCodes;
  }

  addOrganizationCode(): void {
    this.organizationCodes.push(this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]));
  }

  removeOrganizationCode(index: number): void {
    if (this.organizationCodes.length <= MIN_ORGANIZATION_CODES) {
      return;
    }

    this.organizationCodes.removeAt(index);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    await this.authService.registerEmployee({
      fullName: value.fullName,
      email: value.email,
      password: value.password,
      organizationCodes: value.organizationCodes,
      phoneNumber: value.phoneNumber,
      department: value.department
    });
  }

  private passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }
}
