import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { AdminService } from '../services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDeleteComponent } from '../../shared/components/confirm-delete.component';
import { DailySurvey, Meal, SelectOption } from '../../core/models/app.models';

@Component({
  selector: 'app-surveys-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    PageHeaderComponent,
    TableModule,
    DialogModule,
    ButtonModule,
    MultiSelectModule,
    SelectModule,
    DatePickerModule,
    TagModule,
    ConfirmDeleteComponent
  ],
  template: `
    <app-page-header
      eyebrow="Admin"
      title="Surveys Management"
      subtitle="Build date-based surveys, assign meals, and change status."
    ></app-page-header>

    <div class="flex justify-content-end mb-3">
      <button pButton type="button" label="New survey" icon="pi pi-plus" (click)="openCreate()"></button>
    </div>

    <p-table [value]="surveys()" [loading]="loading()" responsiveLayout="scroll" dataKey="id" styleClass="p-datatable-sm">
      <ng-template pTemplate="header">
        <tr>
          <th>Date</th>
          <th>Status</th>
          <th>Meals</th>
          <th class="w-12rem">Actions</th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-survey>
        <tr>
          <td>{{ survey.survey_date | date: 'mediumDate' }}</td>
          <td><p-tag [value]="survey.status" [severity]="survey.status === 'open' ? 'success' : survey.status === 'closed' ? 'danger' : 'warn'"></p-tag></td>
          <td>{{ mealNames(survey) }}</td>
          <td>
            <div class="flex align-items-center gap-1 flex-wrap">
              <button pButton type="button" icon="pi pi-pencil" text rounded (click)="openEdit(survey)"></button>
              <button pButton type="button" icon="pi pi-lock-open" text rounded [disabled]="survey.status === 'open'" (click)="changeStatus(survey, 'open')"></button>
              <button pButton type="button" icon="pi pi-lock" text rounded [disabled]="survey.status === 'closed'" (click)="changeStatus(survey, 'closed')"></button>
              <app-confirm-delete message="Delete this survey and all related meal mappings?" (confirmed)="deleteSurvey(survey.id)"></app-confirm-delete>
            </div>
          </td>
        </tr>
      </ng-template>
    </p-table>

    <p-dialog
      header="Survey"
      [visible]="dialogVisible()"
      (visibleChange)="dialogVisible.set($event)"
      [modal]="true"
      [style]="{ width: 'min(44rem, 96vw)' }"
    >
      <form class="flex flex-column gap-4" [formGroup]="form">
        <div class="grid">
          <div class="col-12 md:col-6 flex flex-column gap-2">
            <label for="survey-date">Survey date</label>
            <p-datepicker inputId="survey-date" formControlName="surveyDate" [showIcon]="true" appendTo="body"></p-datepicker>
          </div>
          <div class="col-12 md:col-6 flex flex-column gap-2">
            <label for="survey-status">Status</label>
            <p-select inputId="survey-status" [options]="statusOptions" optionLabel="label" optionValue="value" formControlName="status"></p-select>
          </div>
        </div>

        <div class="flex flex-column gap-2">
          <label for="survey-meals">Meals</label>
          <p-multiSelect
            inputId="survey-meals"
            [options]="mealOptions()"
            optionLabel="label"
            optionValue="value"
            formControlName="mealIds"
            appendTo="body"
            display="chip"
          ></p-multiSelect>
        </div>
      </form>

      <ng-template pTemplate="footer">
        <button pButton type="button" label="Cancel" severity="secondary" outlined (click)="dialogVisible.set(false)"></button>
        <button pButton type="button" label="Save" [disabled]="form.invalid || saving()" (click)="save()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class SurveysManagementComponent {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly toastService = inject(ToastService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly dialogVisible = signal(false);
  readonly surveys = signal<DailySurvey[]>([]);
  readonly meals = signal<Meal[]>([]);
  readonly editingId = signal<string | null>(null);

  readonly statusOptions: SelectOption<DailySurvey['status']>[] = [
    { label: 'Draft', value: 'draft' },
    { label: 'Open', value: 'open' },
    { label: 'Closed', value: 'closed' }
  ];

  readonly form = this.fb.nonNullable.group({
    surveyDate: [new Date(), Validators.required],
    status: ['draft' as DailySurvey['status'], Validators.required],
    mealIds: [[] as string[], Validators.required]
  });

  constructor() {
    void this.load();
  }

  mealOptions(): SelectOption<string>[] {
    return this.meals().map((meal) => ({ label: meal.name, value: meal.id }));
  }

  mealNames(survey: DailySurvey): string {
    return survey.survey_meals?.map((item) => item.meal?.name).filter(Boolean).join(', ') || 'No meals assigned';
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ surveyDate: new Date(), status: 'draft', mealIds: [] });
    this.dialogVisible.set(true);
  }

  openEdit(survey: DailySurvey): void {
    this.editingId.set(survey.id);
    this.form.reset({
      surveyDate: new Date(survey.survey_date),
      status: survey.status,
      mealIds: survey.survey_meals?.map((item) => item.meal_id) ?? []
    });
    this.dialogVisible.set(true);
  }

  async changeStatus(survey: DailySurvey, status: DailySurvey['status']): Promise<void> {
    try {
      await this.adminService.saveSurvey({
        id: survey.id,
        survey_date: survey.survey_date,
        status,
        mealIds: survey.survey_meals?.map((item) => item.meal_id) ?? []
      });
      this.toastService.success('Survey updated', `Survey marked as ${status}.`);
      await this.load();
    } catch (error) {
      console.error(error);
      this.toastService.error('Status update failed', 'Unable to update the survey status.');
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);

    try {
      const value = this.form.getRawValue();
      await this.adminService.saveSurvey({
        id: this.editingId() ?? undefined,
        survey_date: value.surveyDate.toISOString().slice(0, 10),
        status: value.status,
        mealIds: value.mealIds
      });
      this.toastService.success('Survey saved', 'Survey scheduling has been updated.');
      this.dialogVisible.set(false);
      await this.load();
    } catch (error) {
      console.error(error);
      this.toastService.error('Save failed', 'Unable to save this survey.');
    } finally {
      this.saving.set(false);
    }
  }

  async deleteSurvey(id: string): Promise<void> {
    try {
      await this.adminService.deleteSurvey(id);
      this.toastService.success('Survey deleted', 'The survey has been removed.');
      await this.load();
    } catch (error) {
      console.error(error);
      this.toastService.error('Delete failed', 'Unable to delete this survey.');
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);

    try {
      const [surveys, meals] = await Promise.all([this.adminService.getSurveys(), this.adminService.getMeals()]);
      this.surveys.set(surveys);
      this.meals.set(meals.filter((meal) => meal.is_active));
    } catch (error) {
      console.error(error);
      this.toastService.error('Surveys unavailable', 'Unable to load survey configuration.');
    } finally {
      this.loading.set(false);
    }
  }
}
