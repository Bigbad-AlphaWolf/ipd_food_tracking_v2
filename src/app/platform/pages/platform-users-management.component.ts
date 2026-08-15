import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TagModule } from 'primeng/tag';
import { PlatformService } from '../services/platform.service';
import { ToastService } from '../../core/services/toast.service';
import { CreateUserDialogComponent } from '../../shared/components/create-user-dialog.component';
import { UserCredentialsDialogComponent } from '../../shared/components/user-credentials-dialog.component';
import { AppRole, CreateUserPayload, Organization, Profile, SelectOption } from '../../core/models/app.models';

@Component({
  selector: 'app-platform-users-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TranslatePipe,
    PageHeaderComponent,
    TableModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    MultiSelectModule,
    ToggleSwitchModule,
    TagModule,
    CreateUserDialogComponent,
    UserCredentialsDialogComponent
  ],
  template: `
    <app-page-header
      [eyebrow]="'platform.eyebrow' | translate"
      [title]="'platform.users.title' | translate"
      [subtitle]="'platform.users.subtitle' | translate"
    ></app-page-header>

    <div class="flex justify-content-end mb-3">
      <button pButton type="button" [label]="'shared.createUser.newUser' | translate" icon="pi pi-user-plus" (click)="createDialogVisible.set(true)"></button>
    </div>

    <div class="app-surface p-3 mb-4">
      <div class="grid align-items-end">
        <div class="col-12 md:col-5">
          <span class="p-input-icon-left w-full">
            <i class="pi pi-search"></i>
            <input
              pInputText
              class="w-full"
              [ngModel]="search()"
              [ngModelOptions]="{ standalone: true }"
              (ngModelChange)="setSearch($event)"
              [placeholder]="'platform.users.searchPlaceholder' | translate"
            />
          </span>
        </div>

        <div class="col-12 md:col-5">
          <p-select
            [options]="organizationFilterOptions()"
            optionLabel="label"
            optionValue="value"
            [ngModel]="organizationFilter()"
            [ngModelOptions]="{ standalone: true }"
            (ngModelChange)="setOrganizationFilter($event)"
            [placeholder]="'platform.users.organizationFilterPlaceholder' | translate"
            [showClear]="true"
            class="w-full"
          ></p-select>
        </div>

        <div class="col-12 md:col-2 flex md:justify-content-end">
          <button pButton type="button" [label]="'common.actions.clear' | translate" severity="secondary" outlined (click)="clearFilters()"></button>
        </div>
      </div>
    </div>

    <p-table [value]="users()" [loading]="loading()" responsiveLayout="scroll" dataKey="id" styleClass="p-datatable-sm">
      <ng-template pTemplate="header">
        <tr>
          <th>{{ 'platform.users.table.name' | translate }}</th>
          <th>{{ 'platform.users.table.email' | translate }}</th>
          <th>{{ 'platform.users.table.organization' | translate }}</th>
          <th>{{ 'platform.users.table.role' | translate }}</th>
          <th>{{ 'platform.users.table.status' | translate }}</th>
          <th class="w-6rem">{{ 'platform.users.table.action' | translate }}</th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-user>
        <tr>
          <td>{{ user.full_name }}</td>
          <td>{{ user.email }}</td>
          <td>
            <div class="flex gap-1 flex-wrap">
              @for (organization of user.organizations; track organization.id) {
                <p-tag [value]="organization.name" severity="info"></p-tag>
              } @empty {
                {{ 'platform.users.noOrganization' | translate }}
              }
            </div>
          </td>
          <td>
            <div class="flex gap-1 flex-wrap">
              @for (role of normalizeRoles(user); track role) {
                <p-tag [value]="('roles.' + role) | translate" [severity]="roleSeverity(role)"></p-tag>
              }
            </div>
          </td>
          <td>
            <p-tag
              [value]="(user.is_active ? 'common.status.active' : 'common.status.inactive') | translate"
              [severity]="user.is_active ? 'success' : 'danger'"
            ></p-tag>
          </td>
          <td><button pButton type="button" icon="pi pi-pencil" text rounded (click)="openEdit(user)"></button></td>
        </tr>
      </ng-template>
    </p-table>

    <p-dialog
      [header]="'platform.users.dialog.header' | translate"
      [visible]="dialogVisible()"
      (visibleChange)="dialogVisible.set($event)"
      [modal]="true"
      [style]="{ width: 'min(32rem, 95vw)' }"
    >
      <form class="flex flex-column gap-4" [formGroup]="form">
        <div class="flex flex-column gap-2">
          <label>{{ 'platform.users.dialog.nameLabel' | translate }}</label>
          <input pInputText [value]="selectedUser()?.full_name || ''" readonly />
        </div>

        <div class="flex flex-column gap-2">
          <label>{{ 'platform.users.dialog.rolesLabel' | translate }}</label>
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
            <label>{{ 'platform.users.dialog.organizationLabel' | translate }}</label>
            <p-multiSelect
              [options]="organizationOptions()"
              optionLabel="label"
              optionValue="value"
              formControlName="organizationIds"
              appendTo="body"
              display="chip"
            ></p-multiSelect>
            @if (form.hasError('organizationRequired') && form.controls.organizationIds.touched) {
              <small class="text-red-500">{{ 'platform.users.dialog.organizationRequired' | translate }}</small>
            }
          </div>
        }

        <div class="flex align-items-center gap-2">
          <p-toggleswitch formControlName="is_active"></p-toggleswitch>
          <span>{{ 'platform.users.dialog.activeAccountLabel' | translate }}</span>
        </div>
      </form>

      <ng-template pTemplate="footer">
        <button pButton type="button" [label]="'common.actions.cancel' | translate" severity="secondary" outlined (click)="dialogVisible.set(false)"></button>
        <button pButton type="button" [label]="'common.actions.save' | translate" [disabled]="form.invalid || saving()" (click)="save()"></button>
      </ng-template>
    </p-dialog>

    <app-create-user-dialog
      [visible]="createDialogVisible()"
      (visibleChange)="createDialogVisible.set($event)"
      [roleOptions]="roleOptions()"
      [organizationOptions]="organizationOptions()"
      [saving]="creating()"
      (created)="createUser($event)"
    ></app-create-user-dialog>

    <app-user-credentials-dialog
      [visible]="credentialsDialogVisible()"
      (visibleChange)="credentialsDialogVisible.set($event)"
      [email]="createdCredentials()?.email ?? ''"
      [password]="createdCredentials()?.password ?? ''"
    ></app-user-credentials-dialog>
  `
})
export class PlatformUsersManagementComponent {
  private readonly fb = inject(FormBuilder);
  private readonly platformService = inject(PlatformService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly search = signal('');
  readonly organizationFilter = signal<string | null>(null);
  readonly dialogVisible = signal(false);
  readonly users = signal<Profile[]>([]);
  readonly organizations = signal<Organization[]>([]);
  readonly selectedUser = signal<Profile | null>(null);

  readonly creating = signal(false);
  readonly createDialogVisible = signal(false);
  readonly credentialsDialogVisible = signal(false);
  readonly createdCredentials = signal<{ email: string; password: string } | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      roles: [['employee'] as AppRole[], Validators.required],
      organizationIds: [[] as string[]],
      is_active: true
    },
    { validators: this.organizationRequiredValidator }
  );

  readonly isPlatformAdminSelection = computed(() => this.form.controls.roles.value.includes('platform_administrator'));

  readonly roleOptions = computed<SelectOption<AppRole>[]>(() => {
    this.translateService.currentLang();
    return [
      { label: this.translateService.instant('roles.employee'), value: 'employee' },
      { label: this.translateService.instant('roles.admin'), value: 'admin' },
      { label: this.translateService.instant('roles.meal_coordinator'), value: 'meal_coordinator' },
      { label: this.translateService.instant('roles.platform_administrator'), value: 'platform_administrator' }
    ];
  });

  readonly organizationOptions = computed<SelectOption<string>[]>(() =>
    this.organizations().map((organization) => ({ label: organization.name, value: organization.id }))
  );

  readonly organizationFilterOptions = computed<SelectOption<string>[]>(() => this.organizationOptions());

  constructor() {
    void this.load();

    this.form.controls.roles.valueChanges.subscribe((roles) => {
      if (roles.includes('platform_administrator')) {
        this.form.controls.organizationIds.setValue([]);
      }
    });
  }

  private organizationRequiredValidator(control: AbstractControl): ValidationErrors | null {
    const roles = (control.get('roles')?.value as AppRole[] | null) ?? [];

    if (roles.includes('platform_administrator')) {
      return null;
    }

    const organizationIds = (control.get('organizationIds')?.value as string[] | null) ?? [];
    return organizationIds.length > 0 ? null : { organizationRequired: true };
  }

  setSearch(value: string): void {
    this.search.set(value);
    void this.loadUsers();
  }

  setOrganizationFilter(value: string | null): void {
    this.organizationFilter.set(value);
    void this.loadUsers();
  }

  clearFilters(): void {
    this.search.set('');
    this.organizationFilter.set(null);
    void this.loadUsers();
  }

  roleSeverity(role: AppRole): 'success' | 'warn' | 'info' {
    if (role === 'platform_administrator') {
      return 'warn';
    }

    return role === 'admin' ? 'success' : 'info';
  }

  normalizeRoles(user: Profile): AppRole[] {
    const fromArray = Array.isArray(user.roles) ? user.roles : [];
    const fromLegacy = user.role ? [user.role] : [];
    const merged = [...new Set([...fromArray, ...fromLegacy])].filter(
      (role): role is AppRole =>
        role === 'admin' || role === 'employee' || role === 'platform_administrator' || role === 'meal_coordinator'
    );

    return merged.length > 0 ? merged : ['employee'];
  }

  openEdit(user: Profile): void {
    this.selectedUser.set(user);
    this.form.reset({
      roles: this.normalizeRoles(user),
      organizationIds: (user.organizations ?? []).map((organization) => organization.id),
      is_active: user.is_active
    });
    this.dialogVisible.set(true);
  }

  async save(): Promise<void> {
    const user = this.selectedUser();

    if (!user) {
      return;
    }

    this.saving.set(true);

    try {
      const value = this.form.getRawValue();
      await this.platformService.updateUser(user.id, {
        roles: value.roles,
        organizationIds: value.organizationIds,
        isActive: value.is_active
      });
      this.toastService.success(
        this.translateService.instant('platform.users.toast.updatedTitle'),
        this.translateService.instant('platform.users.toast.updatedBody')
      );
      this.dialogVisible.set(false);
      await this.loadUsers();
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('platform.users.toast.updateFailedTitle'),
        this.translateService.instant('platform.users.toast.updateFailedBody')
      );
    } finally {
      this.saving.set(false);
    }
  }

  async createUser(payload: CreateUserPayload): Promise<void> {
    this.creating.set(true);

    try {
      await this.platformService.createUser(payload);
      this.createDialogVisible.set(false);
      this.createdCredentials.set({ email: payload.email, password: payload.password });
      this.credentialsDialogVisible.set(true);
      this.toastService.success(
        this.translateService.instant('shared.createUser.toast.createdTitle'),
        this.translateService.instant('shared.createUser.toast.createdBody')
      );
      await this.loadUsers();
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('shared.createUser.toast.createFailedTitle'),
        this.translateService.instant('shared.createUser.toast.createFailedBody')
      );
    } finally {
      this.creating.set(false);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);

    try {
      const [users, organizations] = await Promise.all([
        this.platformService.getAllUsers(this.search(), this.organizationFilter()),
        this.platformService.getOrganizations()
      ]);
      this.users.set(users);
      this.organizations.set(organizations);
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('platform.users.toast.unavailableTitle'),
        this.translateService.instant('platform.users.toast.unavailableBody')
      );
    } finally {
      this.loading.set(false);
    }
  }

  private async loadUsers(): Promise<void> {
    this.loading.set(true);

    try {
      this.users.set(await this.platformService.getAllUsers(this.search(), this.organizationFilter()));
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('platform.users.toast.unavailableTitle'),
        this.translateService.instant('platform.users.toast.unavailableBody')
      );
    } finally {
      this.loading.set(false);
    }
  }
}
