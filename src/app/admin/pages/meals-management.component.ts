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
import { AdminService } from '../services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDeleteComponent } from '../../shared/components/confirm-delete.component';
import { Meal } from '../../core/models/app.models';

@Component({
  selector: 'app-meals-management',
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
      [eyebrow]="'admin.eyebrow' | translate"
      [title]="'admin.meals.title' | translate"
      [subtitle]="'admin.meals.subtitle' | translate"
    ></app-page-header>

    <div class="flex justify-content-end mb-3">
      <button pButton type="button" [label]="'admin.meals.newMeal' | translate" icon="pi pi-plus" (click)="openCreate()"></button>
    </div>

    <p-table [value]="meals()" [loading]="loading()" responsiveLayout="scroll" dataKey="id" styleClass="p-datatable-sm">
      <ng-template pTemplate="header">
        <tr>
          <th>{{ 'admin.meals.table.name' | translate }}</th>
          <th>{{ 'admin.meals.table.description' | translate }}</th>
          <th>{{ 'admin.meals.table.status' | translate }}</th>
          <th>{{ 'admin.meals.table.created' | translate }}</th>
          <th class="w-8rem">{{ 'admin.meals.table.actions' | translate }}</th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-meal>
        <tr>
          <td>{{ meal.name }}</td>
          <td>{{ meal.description || ('common.placeholders.noDescription' | translate) }}</td>
          <td>
            <p-tag
              [value]="(meal.is_active ? 'common.status.active' : 'common.status.inactive') | translate"
              [severity]="meal.is_active ? 'success' : 'danger'"
            ></p-tag>
          </td>
          <td>{{ meal.created_at | date: 'mediumDate' }}</td>
          <td>
            <div class="flex align-items-center gap-1">
              <button pButton type="button" icon="pi pi-pencil" text rounded (click)="openEdit(meal)"></button>
              <app-confirm-delete [message]="'admin.meals.deleteConfirm' | translate" (confirmed)="deleteMeal(meal.id)"></app-confirm-delete>
            </div>
          </td>
        </tr>
      </ng-template>
    </p-table>

    <p-dialog
      [header]="'admin.meals.dialog.header' | translate"
      [visible]="dialogVisible()"
      (visibleChange)="dialogVisible.set($event)"
      [modal]="true"
      [style]="{ width: 'min(42rem, 95vw)' }"
    >
      <form class="flex flex-column gap-4" [formGroup]="form">
        <div class="flex flex-column gap-2">
          <label for="meal-name">{{ 'admin.meals.dialog.nameLabel' | translate }}</label>
          <input pInputText id="meal-name" formControlName="name" />
        </div>

        <div class="flex flex-column gap-2">
          <label for="meal-description">{{ 'admin.meals.dialog.descriptionLabel' | translate }}</label>
          <textarea pTextarea id="meal-description" rows="4" formControlName="description"></textarea>
        </div>

        <div class="flex align-items-center gap-2">
          <p-toggleswitch formControlName="is_active"></p-toggleswitch>
          <label for="">{{ 'admin.meals.dialog.activeLabel' | translate }}</label>
        </div>
      </form>

      <ng-template pTemplate="footer">
        <button pButton type="button" [label]="'common.actions.cancel' | translate" severity="secondary" outlined (click)="dialogVisible.set(false)"></button>
        <button pButton type="button" [label]="'common.actions.save' | translate" [disabled]="form.invalid || saving()" (click)="save()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class MealsManagementComponent {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly dialogVisible = signal(false);
  readonly meals = signal<Meal[]>([]);
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    is_active: true
  });

  constructor() {
    void this.load();
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ name: '', description: '', is_active: true });
    this.dialogVisible.set(true);
  }

  openEdit(meal: Meal): void {
    this.editingId.set(meal.id);
    this.form.reset({ name: meal.name, description: meal.description ?? '', is_active: meal.is_active });
    this.dialogVisible.set(true);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);

    try {
      await this.adminService.saveMeal({ id: this.editingId() ?? undefined, ...this.form.getRawValue() });
      this.toastService.success(
        this.translateService.instant('admin.meals.toast.savedTitle'),
        this.translateService.instant('admin.meals.toast.savedBody')
      );
      this.dialogVisible.set(false);
      await this.load();
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('admin.meals.toast.saveFailedTitle'),
        this.translateService.instant('admin.meals.toast.saveFailedBody')
      );
    } finally {
      this.saving.set(false);
    }
  }

  async deleteMeal(id: string): Promise<void> {
    try {
      await this.adminService.deleteMeal(id);
      this.toastService.success(
        this.translateService.instant('admin.meals.toast.deletedTitle'),
        this.translateService.instant('admin.meals.toast.deletedBody')
      );
      await this.load();
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('admin.meals.toast.deleteFailedTitle'),
        this.translateService.instant('admin.meals.toast.deleteFailedBody')
      );
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);

    try {
      this.meals.set(await this.adminService.getMeals());
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('admin.meals.toast.unavailableTitle'),
        this.translateService.instant('admin.meals.toast.unavailableBody')
      );
    } finally {
      this.loading.set(false);
    }
  }
}
