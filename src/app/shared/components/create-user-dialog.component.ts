import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { PasswordModule } from 'primeng/password';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { AppRole, CreateUserPayload, SelectOption } from '../../core/models/app.models';
import { generateTemporaryPassword } from '../../core/utils/temporary-password.util';

/**
 * Reusable "create a new user" form, shared by the platform admin's All
 * Users page and the org admin's Users page — each passes in the roles and
 * organizations it's allowed to grant/assign, and the edge function it
 * ultimately calls enforces the rest server-side.
 */
@Component({
  selector: 'app-create-user-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ReactiveFormsModule, TranslatePipe, DialogModule, ButtonModule, InputTextModule, MultiSelectModule, PasswordModule, ToggleSwitchModule],
  template: `
    <p-dialog
      [header]="'shared.createUser.header' | translate"
      [visible]="visible()"
      (visibleChange)="visibleChange.emit($event)"
      [modal]="true"
      [style]="{ width: 'min(36rem, 96vw)' }"
    >
      <form class="flex flex-column gap-4" [formGroup]="form">
        <div class="grid">
          <div class="col-12 md:col-6 flex flex-column gap-2">
            <label for="create-user-full-name">{{ 'shared.createUser.fullNameLabel' | translate }}</label>
            <input pInputText id="create-user-full-name" formControlName="fullName" />
          </div>
          <div class="col-12 md:col-6 flex flex-column gap-2">
            <label for="create-user-email">{{ 'shared.createUser.emailLabel' | translate }}</label>
            <input pInputText id="create-user-email" type="email" formControlName="email" />
          </div>
          <div class="col-12 md:col-6 flex flex-column gap-2">
            <label for="create-user-department">{{ 'shared.createUser.departmentLabel' | translate }}</label>
            <input pInputText id="create-user-department" formControlName="department" />
          </div>
          <div class="col-12 md:col-6 flex flex-column gap-2">
            <label for="create-user-phone">{{ 'shared.createUser.phoneLabel' | translate }}</label>
            <input pInputText id="create-user-phone" formControlName="phoneNumber" />
          </div>
        </div>

        <div class="flex flex-column gap-2">
          <label>{{ 'shared.createUser.rolesLabel' | translate }}</label>
          <p-multiSelect
            [options]="roleOptions()"
            optionLabel="label"
            optionValue="value"
            formControlName="roles"
            appendTo="body"
            display="chip"
          ></p-multiSelect>
        </div>

        @if (!isPlatformAdminSelection()) {
          <div class="flex flex-column gap-2">
            <label>{{ 'shared.createUser.organizationLabel' | translate }}</label>
            <p-multiSelect
              [options]="organizationOptions()"
              optionLabel="label"
              optionValue="value"
              formControlName="organizationIds"
              appendTo="body"
              display="chip"
            ></p-multiSelect>
            @if (form.hasError('organizationRequired') && form.controls.organizationIds.touched) {
              <small class="text-red-500">{{ 'shared.createUser.organizationRequired' | translate }}</small>
            }
          </div>
        }

        <div class="flex align-items-center gap-2">
          <p-toggleswitch [ngModel]="generateMode()" [ngModelOptions]="{ standalone: true }" (ngModelChange)="setGenerateMode($event)"></p-toggleswitch>
          <span>{{ 'shared.createUser.generatePasswordLabel' | translate }}</span>
        </div>

        @if (generateMode()) {
          <div class="flex flex-column gap-2">
            <label>{{ 'shared.createUser.temporaryPasswordLabel' | translate }}</label>
            <div class="flex gap-2">
              <input pInputText [value]="generatedPassword()" readonly class="flex-1 font-mono" />
              <button
                pButton
                type="button"
                icon="pi pi-refresh"
                severity="secondary"
                outlined
                [attr.aria-label]="'shared.createUser.regenerate' | translate"
                (click)="regeneratePassword()"
              ></button>
            </div>
          </div>
        } @else {
          <div class="grid">
            <div class="col-12 md:col-6 flex flex-column gap-2">
              <label for="create-user-password">{{ 'shared.createUser.temporaryPasswordLabel' | translate }}</label>
              <p-password
                inputId="create-user-password"
                formControlName="password"
                [feedback]="true"
                [toggleMask]="true"
                styleClass="w-full"
                inputStyleClass="w-full"
              ></p-password>
            </div>
            <div class="col-12 md:col-6 flex flex-column gap-2">
              <label for="create-user-confirm-password">{{ 'shared.createUser.confirmPasswordLabel' | translate }}</label>
              <p-password
                inputId="create-user-confirm-password"
                formControlName="confirmPassword"
                [feedback]="false"
                [toggleMask]="true"
                styleClass="w-full"
                inputStyleClass="w-full"
              ></p-password>
            </div>
            @if (form.hasError('passwordMismatch') && form.controls.confirmPassword.touched) {
              <div class="col-12">
                <small class="text-red-500">{{ 'shared.createUser.passwordMismatch' | translate }}</small>
              </div>
            }
          </div>
        }
      </form>

      <ng-template pTemplate="footer">
        <button pButton type="button" [label]="'common.actions.cancel' | translate" severity="secondary" outlined (click)="visibleChange.emit(false)"></button>
        <button pButton type="button" [label]="'shared.createUser.submit' | translate" [disabled]="form.invalid || saving()" (click)="submit()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class CreateUserDialogComponent {
  private readonly fb = inject(FormBuilder);

  readonly visible = input(false);
  readonly saving = input(false);
  readonly roleOptions = input.required<SelectOption<AppRole>[]>();
  readonly organizationOptions = input<SelectOption<string>[]>([]);

  readonly visibleChange = output<boolean>();
  readonly created = output<CreateUserPayload>();

  readonly generateMode = signal(true);
  readonly generatedPassword = signal(generateTemporaryPassword());

  readonly form = this.fb.nonNullable.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      department: [''],
      phoneNumber: [''],
      roles: [[] as AppRole[], Validators.required],
      organizationIds: [[] as string[]],
      password: [''],
      confirmPassword: ['']
    },
    { validators: [this.organizationRequiredValidator, this.passwordsMatchValidator] }
  );

  readonly isPlatformAdminSelection = computed(() => this.form.controls.roles.value.includes('platform_administrator'));

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.resetForm();
      }
    });

    this.form.controls.roles.valueChanges.subscribe((roles) => {
      if (roles.includes('platform_administrator')) {
        this.form.controls.organizationIds.setValue([]);
      }
    });
  }

  setGenerateMode(value: boolean): void {
    this.generateMode.set(value);

    const passwordControl = this.form.controls.password;
    const confirmControl = this.form.controls.confirmPassword;

    if (value) {
      passwordControl.clearValidators();
      confirmControl.clearValidators();
      passwordControl.setValue('');
      confirmControl.setValue('');
    } else {
      passwordControl.setValidators([Validators.required, Validators.minLength(6)]);
      confirmControl.setValidators([Validators.required, Validators.minLength(6)]);
    }

    passwordControl.updateValueAndValidity();
    confirmControl.updateValueAndValidity();
  }

  regeneratePassword(): void {
    this.generatedPassword.set(generateTemporaryPassword());
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const password = this.generateMode() ? this.generatedPassword() : value.password;

    this.created.emit({
      email: value.email.trim().toLowerCase(),
      fullName: value.fullName.trim(),
      password,
      roles: value.roles,
      organizationIds: value.organizationIds,
      department: value.department.trim() || undefined,
      phoneNumber: value.phoneNumber.trim() || undefined
    });
  }

  private resetForm(): void {
    this.form.reset({
      fullName: '',
      email: '',
      department: '',
      phoneNumber: '',
      roles: [],
      organizationIds: [],
      password: '',
      confirmPassword: ''
    });
    this.form.controls.password.clearValidators();
    this.form.controls.confirmPassword.clearValidators();
    this.form.controls.password.updateValueAndValidity();
    this.form.controls.confirmPassword.updateValueAndValidity();
    this.generateMode.set(true);
    this.regeneratePassword();
  }

  private organizationRequiredValidator(control: AbstractControl): ValidationErrors | null {
    const roles = (control.get('roles')?.value as AppRole[] | null) ?? [];

    if (roles.includes('platform_administrator')) {
      return null;
    }

    const organizationIds = (control.get('organizationIds')?.value as string[] | null) ?? [];
    return organizationIds.length > 0 ? null : { organizationRequired: true };
  }

  private passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }
}
