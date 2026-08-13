import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { SearchToolbarComponent } from '../../shared/components/search-toolbar.component';
import { AdminService } from '../services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { Profile, SelectOption } from '../../core/models/app.models';

@Component({
  selector: 'app-users-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
    SearchToolbarComponent
  ],
  template: `
    <app-page-header
      [eyebrow]="'admin.eyebrow' | translate"
      [title]="'admin.users.title' | translate"
      [subtitle]="'admin.users.subtitle' | translate"
    ></app-page-header>

    <app-search-toolbar
      [search]="search()"
      [searchPlaceholder]="'admin.users.searchPlaceholder' | translate"
      (searchChange)="setSearch($event)"
      (clear)="clearSearch()"
    ></app-search-toolbar>

    <p-table [value]="users()" [loading]="loading()" responsiveLayout="scroll" dataKey="id" styleClass="p-datatable-sm">
      <ng-template pTemplate="header">
        <tr>
          <th>{{ 'admin.users.table.name' | translate }}</th>
          <th>{{ 'admin.users.table.email' | translate }}</th>
          <th>{{ 'admin.users.table.department' | translate }}</th>
          <th>{{ 'admin.users.table.role' | translate }}</th>
          <th>{{ 'admin.users.table.status' | translate }}</th>
          <th class="w-6rem">{{ 'admin.users.table.action' | translate }}</th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-user>
        <tr>
          <td>{{ user.full_name }}</td>
          <td>{{ user.email }}</td>
          <td>{{ user.department || ('common.placeholders.unassigned' | translate) }}</td>
          <td>
            <div class="flex gap-1 flex-wrap">
              @for (role of normalizeRoles(user); track role) {
                <p-tag [value]="('roles.' + role) | translate" [severity]="role === 'admin' ? 'success' : 'info'"></p-tag>
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
      [header]="'admin.users.dialog.header' | translate"
      [visible]="dialogVisible()"
      (visibleChange)="dialogVisible.set($event)"
      [modal]="true"
      [style]="{ width: 'min(32rem, 95vw)' }"
    >
      <form class="flex flex-column gap-4" [formGroup]="form">
        <div class="flex flex-column gap-2">
          <label>{{ 'admin.users.dialog.nameLabel' | translate }}</label>
          <input pInputText [value]="selectedUser()?.full_name || ''" readonly />
        </div>

        <div class="flex flex-column gap-2">
          <label>{{ 'admin.users.dialog.rolesLabel' | translate }}</label>
          <p-multiSelect
            [options]="roleOptions()"
            optionLabel="label"
            optionValue="value"
            formControlName="roles"
            appendTo="body"
            display="chip"
          ></p-multiSelect>
        </div>

        <div class="flex align-items-center gap-2">
          <p-toggleswitch formControlName="is_active"></p-toggleswitch>
          <span>{{ 'admin.users.dialog.activeAccountLabel' | translate }}</span>
        </div>
      </form>

      <ng-template pTemplate="footer">
        <button pButton type="button" [label]="'common.actions.cancel' | translate" severity="secondary" outlined (click)="dialogVisible.set(false)"></button>
        <button pButton type="button" [label]="'common.actions.save' | translate" [disabled]="form.invalid || saving()" (click)="save()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class UsersManagementComponent {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly search = signal('');
  readonly dialogVisible = signal(false);
  readonly users = signal<Profile[]>([]);
  readonly selectedUser = signal<Profile | null>(null);

  readonly roleOptions = computed<SelectOption<NonNullable<Profile['role']>>[]>(() => {
    this.translateService.currentLang();
    return [
      { label: this.translateService.instant('roles.employee'), value: 'employee' },
      { label: this.translateService.instant('roles.admin'), value: 'admin' }
    ];
  });

  readonly form = this.fb.nonNullable.group({
    roles: [['employee'] as NonNullable<Profile['role']>[], Validators.required],
    is_active: true
  });

  constructor() {
    void this.load();
  }

  setSearch(value: string): void {
    this.search.set(value);
    void this.load();
  }

  clearSearch(): void {
    this.search.set('');
    void this.load();
  }

  openEdit(user: Profile): void {
    this.selectedUser.set(user);
    this.form.reset({ roles: this.normalizeRoles(user), is_active: user.is_active });
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
      await this.adminService.updateUserRoles(user.id, value.roles, value.is_active);
      this.toastService.success(
        this.translateService.instant('admin.users.toast.updatedTitle'),
        this.translateService.instant('admin.users.toast.updatedBody')
      );
      this.dialogVisible.set(false);
      await this.load();
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('admin.users.toast.updateFailedTitle'),
        this.translateService.instant('admin.users.toast.updateFailedBody')
      );
    } finally {
      this.saving.set(false);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);

    try {
      this.users.set(await this.adminService.getUsers(this.search()));
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('admin.users.toast.unavailableTitle'),
        this.translateService.instant('admin.users.toast.unavailableBody')
      );
    } finally {
      this.loading.set(false);
    }
  }

  normalizeRoles(user: Profile): NonNullable<Profile['role']>[] {
    const fromArray = Array.isArray(user.roles) ? user.roles : [];
    const fromLegacy = user.role ? [user.role] : [];
    const merged = [...new Set([...fromArray, ...fromLegacy])].filter(
      (role): role is NonNullable<Profile['role']> => role === 'admin' || role === 'employee'
    );

    return merged.length > 0 ? merged : ['employee'];
  }
}
