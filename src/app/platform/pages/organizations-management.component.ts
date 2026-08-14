import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TagModule } from 'primeng/tag';
import { PlatformService } from '../services/platform.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDeleteComponent } from '../../shared/components/confirm-delete.component';
import { Organization } from '../../core/models/app.models';

@Component({
  selector: 'app-organizations-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    TranslatePipe,
    PageHeaderComponent,
    TableModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    ToggleSwitchModule,
    TagModule,
    ConfirmDeleteComponent
  ],
  template: `
    <app-page-header
      [eyebrow]="'platform.eyebrow' | translate"
      [title]="'platform.organizations.title' | translate"
      [subtitle]="'platform.organizations.subtitle' | translate"
    ></app-page-header>

    <div class="flex justify-content-end mb-3">
      <button pButton type="button" [label]="'platform.organizations.newOrganization' | translate" icon="pi pi-plus" (click)="openCreate()"></button>
    </div>

    <p-table [value]="organizations()" [loading]="loading()" responsiveLayout="scroll" dataKey="id" styleClass="p-datatable-sm">
      <ng-template pTemplate="header">
        <tr>
          <th>{{ 'platform.organizations.table.name' | translate }}</th>
          <th>{{ 'platform.organizations.table.code' | translate }}</th>
          <th>{{ 'platform.organizations.table.description' | translate }}</th>
          <th>{{ 'platform.organizations.table.status' | translate }}</th>
          <th>{{ 'platform.organizations.table.created' | translate }}</th>
          <th class="w-8rem">{{ 'platform.organizations.table.actions' | translate }}</th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-organization>
        <tr>
          <td>{{ organization.name }}</td>
          <td><p-tag [value]="organization.code" severity="info"></p-tag></td>
          <td>{{ organization.description || ('common.placeholders.noDescription' | translate) }}</td>
          <td>
            <p-tag
              [value]="(organization.is_active ? 'common.status.active' : 'common.status.inactive') | translate"
              [severity]="organization.is_active ? 'success' : 'danger'"
            ></p-tag>
          </td>
          <td>{{ organization.created_at | date: 'mediumDate' }}</td>
          <td>
            <div class="flex align-items-center gap-1">
              <button pButton type="button" icon="pi pi-pencil" text rounded (click)="openEdit(organization)"></button>
              <app-confirm-delete [message]="'platform.organizations.deleteConfirm' | translate" (confirmed)="deleteOrganization(organization.id)"></app-confirm-delete>
            </div>
          </td>
        </tr>
      </ng-template>
    </p-table>

    <p-dialog
      [header]="'platform.organizations.dialog.header' | translate"
      [visible]="dialogVisible()"
      (visibleChange)="dialogVisible.set($event)"
      [modal]="true"
      [style]="{ width: 'min(42rem, 95vw)' }"
    >
      <form class="flex flex-column gap-4" [formGroup]="form">
        <div class="flex flex-column gap-2">
          <label for="organization-name">{{ 'platform.organizations.dialog.nameLabel' | translate }}</label>
          <input pInputText id="organization-name" formControlName="name" />
        </div>

        <div class="flex flex-column gap-2">
          <label for="organization-code">{{ 'platform.organizations.dialog.codeLabel' | translate }}</label>
          <input
            pInputText
            id="organization-code"
            formControlName="code"
            [placeholder]="'platform.organizations.dialog.codePlaceholder' | translate"
          />
        </div>

        <div class="flex flex-column gap-2">
          <label for="organization-description">{{ 'platform.organizations.dialog.descriptionLabel' | translate }}</label>
          <textarea pTextarea id="organization-description" rows="4" formControlName="description"></textarea>
        </div>

        <div class="flex align-items-center gap-2">
          <p-toggleswitch formControlName="is_active"></p-toggleswitch>
          <label for="">{{ 'platform.organizations.dialog.activeLabel' | translate }}</label>
        </div>
      </form>

      <ng-template pTemplate="footer">
        <button pButton type="button" [label]="'common.actions.cancel' | translate" severity="secondary" outlined (click)="dialogVisible.set(false)"></button>
        <button pButton type="button" [label]="'common.actions.save' | translate" [disabled]="form.invalid || saving()" (click)="save()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class OrganizationsManagementComponent {
  private readonly fb = inject(FormBuilder);
  private readonly platformService = inject(PlatformService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly dialogVisible = signal(false);
  readonly organizations = signal<Organization[]>([]);
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    code: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    is_active: true
  });

  constructor() {
    void this.load();
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ name: '', code: '', description: '', is_active: true });
    this.dialogVisible.set(true);
  }

  openEdit(organization: Organization): void {
    this.editingId.set(organization.id);
    this.form.reset({
      name: organization.name,
      code: organization.code,
      description: organization.description ?? '',
      is_active: organization.is_active
    });
    this.dialogVisible.set(true);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);

    try {
      const value = this.form.getRawValue();
      await this.platformService.saveOrganization({
        id: this.editingId() ?? undefined,
        name: value.name,
        code: value.code.trim().toUpperCase(),
        description: value.description || null,
        is_active: value.is_active
      });
      this.toastService.success(
        this.translateService.instant('platform.organizations.toast.savedTitle'),
        this.translateService.instant('platform.organizations.toast.savedBody')
      );
      this.dialogVisible.set(false);
      await this.load();
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('platform.organizations.toast.saveFailedTitle'),
        this.translateService.instant('platform.organizations.toast.saveFailedBody')
      );
    } finally {
      this.saving.set(false);
    }
  }

  async deleteOrganization(id: string): Promise<void> {
    try {
      await this.platformService.deleteOrganization(id);
      this.toastService.success(
        this.translateService.instant('platform.organizations.toast.deletedTitle'),
        this.translateService.instant('platform.organizations.toast.deletedBody')
      );
      await this.load();
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('platform.organizations.toast.deleteFailedTitle'),
        this.translateService.instant('platform.organizations.toast.deleteFailedBody')
      );
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);

    try {
      this.organizations.set(await this.platformService.getOrganizations());
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('platform.organizations.toast.unavailableTitle'),
        this.translateService.instant('platform.organizations.toast.unavailableBody')
      );
    } finally {
      this.loading.set(false);
    }
  }
}
