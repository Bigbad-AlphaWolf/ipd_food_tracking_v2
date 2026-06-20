import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
      eyebrow="Admin"
      title="Users Management"
      subtitle="Role assignment and account activation state."
    ></app-page-header>

    <app-search-toolbar [search]="search()" searchPlaceholder="Search employees" (searchChange)="setSearch($event)" (clear)="clearSearch()"></app-search-toolbar>

    <p-table [value]="users()" [loading]="loading()" responsiveLayout="scroll" dataKey="id" styleClass="p-datatable-sm">
      <ng-template pTemplate="header">
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Department</th>
          <th>Role</th>
          <th>Status</th>
          <th class="w-6rem">Action</th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-user>
        <tr>
          <td>{{ user.full_name }}</td>
          <td>{{ user.email }}</td>
          <td>{{ user.department || 'Unassigned' }}</td>
          <td>
            <div class="flex gap-1 flex-wrap">
              @for (role of normalizeRoles(user); track role) {
                <p-tag [value]="role" [severity]="role === 'admin' ? 'success' : 'info'"></p-tag>
              }
            </div>
          </td>
          <td><p-tag [value]="user.is_active ? 'active' : 'inactive'" [severity]="user.is_active ? 'success' : 'danger'"></p-tag></td>
          <td><button pButton type="button" icon="pi pi-pencil" text rounded (click)="openEdit(user)"></button></td>
        </tr>
      </ng-template>
    </p-table>

    <p-dialog
      header="User access"
      [visible]="dialogVisible()"
      (visibleChange)="dialogVisible.set($event)"
      [modal]="true"
      [style]="{ width: 'min(32rem, 95vw)' }"
    >
      <form class="flex flex-column gap-4" [formGroup]="form">
        <div class="flex flex-column gap-2">
          <label>Name</label>
          <input pInputText [value]="selectedUser()?.full_name || ''" readonly />
        </div>

        <div class="flex flex-column gap-2">
          <label>Roles</label>
          <p-multiSelect
            [options]="roleOptions"
            optionLabel="label"
            optionValue="value"
            formControlName="roles"
            appendTo="body"
            display="chip"
          ></p-multiSelect>
        </div>

        <div class="flex align-items-center gap-2">
          <p-toggleswitch formControlName="is_active"></p-toggleswitch>
          <span>Active account</span>
        </div>
      </form>

      <ng-template pTemplate="footer">
        <button pButton type="button" label="Cancel" severity="secondary" outlined (click)="dialogVisible.set(false)"></button>
        <button pButton type="button" label="Save" [disabled]="form.invalid || saving()" (click)="save()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class UsersManagementComponent {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly toastService = inject(ToastService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly search = signal('');
  readonly dialogVisible = signal(false);
  readonly users = signal<Profile[]>([]);
  readonly selectedUser = signal<Profile | null>(null);

  readonly roleOptions: SelectOption<NonNullable<Profile['role']>>[] = [
    { label: 'Employee', value: 'employee' },
    { label: 'Admin', value: 'admin' }
  ];

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
      this.toastService.success('User updated', 'Roles and activation state were saved.');
      this.dialogVisible.set(false);
      await this.load();
    } catch (error) {
      console.error(error);
      this.toastService.error('Update failed', 'Unable to update user access.');
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
      this.toastService.error('Users unavailable', 'Unable to load user roles.');
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
