import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
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

/** Sensible default end-of-window so admins aren't forced to compute a time from scratch every time. */
function endOfToday(): Date {
  const date = new Date();
  date.setHours(23, 59, 0, 0);
  return date;
}

@Component({
  selector: 'app-surveys-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    TranslatePipe,
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
      [eyebrow]="'admin.eyebrow' | translate"
      [title]="'admin.surveys.title' | translate"
      [subtitle]="'admin.surveys.subtitle' | translate"
    ></app-page-header>

    <div class="flex justify-content-end mb-3">
      <button pButton type="button" [label]="'admin.surveys.newSurvey' | translate" icon="pi pi-plus" (click)="openCreate()"></button>
    </div>

    <p-table [value]="surveys()" [loading]="loading()" responsiveLayout="scroll" dataKey="id" styleClass="p-datatable-sm">
      <ng-template pTemplate="header">
        <tr>
          <th>{{ 'admin.surveys.table.date' | translate }}</th>
          <th>{{ 'admin.surveys.table.status' | translate }}</th>
          <th>{{ 'admin.surveys.table.window' | translate }}</th>
          <th>{{ 'admin.surveys.table.meals' | translate }}</th>
          <th class="w-12rem">{{ 'admin.surveys.table.actions' | translate }}</th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-survey>
        <tr>
          <td>{{ survey.survey_date | date: 'mediumDate' }}</td>
          <td>
            <p-tag
              [value]="('common.status.' + survey.status) | translate"
              [severity]="survey.status === 'open' ? 'success' : survey.status === 'closed' ? 'danger' : 'warn'"
            ></p-tag>
          </td>
          <td>{{ survey.voting_starts_at | date: 'short' }} &ndash; {{ survey.voting_ends_at | date: 'short' }}</td>
          <td>{{ mealNames(survey) }}</td>
          <td>
            <div class="flex align-items-center gap-1 flex-wrap">
              <button pButton type="button" icon="pi pi-pencil" text rounded (click)="openEdit(survey)"></button>
              <button pButton type="button" icon="pi pi-lock-open" text rounded [disabled]="survey.status === 'open'" (click)="changeStatus(survey, 'open')"></button>
              <button pButton type="button" icon="pi pi-lock" text rounded [disabled]="survey.status === 'closed'" (click)="changeStatus(survey, 'closed')"></button>
              <app-confirm-delete [message]="'admin.surveys.deleteConfirm' | translate" (confirmed)="deleteSurvey(survey.id)"></app-confirm-delete>
            </div>
          </td>
        </tr>
      </ng-template>
    </p-table>

    <p-dialog
      [header]="'admin.surveys.dialog.header' | translate"
      [visible]="dialogVisible()"
      (visibleChange)="dialogVisible.set($event)"
      [modal]="true"
      [style]="{ width: 'min(44rem, 96vw)' }"
    >
      <form class="flex flex-column gap-4" [formGroup]="form">
        <div class="grid">
          <div class="col-12 md:col-6 flex flex-column gap-2">
            <label for="survey-date">{{ 'admin.surveys.dialog.dateLabel' | translate }}</label>
            <p-datepicker inputId="survey-date" formControlName="surveyDate" [showIcon]="true" appendTo="body"></p-datepicker>
          </div>
          <div class="col-12 md:col-6 flex flex-column gap-2">
            <label for="survey-status">{{ 'admin.surveys.dialog.statusLabel' | translate }}</label>
            <p-select inputId="survey-status" [options]="statusOptions()" optionLabel="label" optionValue="value" formControlName="status"></p-select>
          </div>
          <div class="col-12 md:col-6 flex flex-column gap-2">
            <label for="survey-voting-starts">{{ 'admin.surveys.dialog.startLabel' | translate }}</label>
            <p-datepicker
              inputId="survey-voting-starts"
              formControlName="votingStartsAt"
              [showIcon]="true"
              [showTime]="true"
              hourFormat="24"
              appendTo="body"
            ></p-datepicker>
          </div>
          <div class="col-12 md:col-6 flex flex-column gap-2">
            <label for="survey-voting-ends">{{ 'admin.surveys.dialog.endLabel' | translate }}</label>
            <p-datepicker
              inputId="survey-voting-ends"
              formControlName="votingEndsAt"
              [showIcon]="true"
              [showTime]="true"
              hourFormat="24"
              appendTo="body"
            ></p-datepicker>
          </div>
          @if (form.hasError('votingWindowInvalid') && form.controls.votingEndsAt.touched) {
            <div class="col-12">
              <small class="text-red-500">{{ 'admin.surveys.dialog.votingWindowInvalid' | translate }}</small>
            </div>
          }
        </div>

        <div class="flex flex-column gap-2">
          <label for="survey-meals">{{ 'admin.surveys.dialog.mealsLabel' | translate }}</label>
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
        <button pButton type="button" [label]="'common.actions.cancel' | translate" severity="secondary" outlined (click)="dialogVisible.set(false)"></button>
        <button pButton type="button" [label]="'common.actions.save' | translate" [disabled]="form.invalid || saving()" (click)="save()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class SurveysManagementComponent {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly dialogVisible = signal(false);
  readonly surveys = signal<DailySurvey[]>([]);
  readonly meals = signal<Meal[]>([]);
  readonly editingId = signal<string | null>(null);

  readonly statusOptions = computed<SelectOption<DailySurvey['status']>[]>(() => {
    this.translateService.currentLang();
    return [
      { label: this.translateService.instant('common.status.draft'), value: 'draft' },
      { label: this.translateService.instant('common.status.open'), value: 'open' },
      { label: this.translateService.instant('common.status.closed'), value: 'closed' }
    ];
  });

  readonly form = this.fb.nonNullable.group(
    {
      surveyDate: [new Date(), Validators.required],
      status: ['draft' as DailySurvey['status'], Validators.required],
      votingStartsAt: [new Date(), Validators.required],
      votingEndsAt: [endOfToday(), Validators.required],
      mealIds: [[] as string[], Validators.required]
    },
    { validators: this.votingWindowValidator }
  );

  constructor() {
    void this.load();
  }

  private votingWindowValidator(control: AbstractControl): ValidationErrors | null {
    const start = control.get('votingStartsAt')?.value as Date | null;
    const end = control.get('votingEndsAt')?.value as Date | null;
    return start && end && end > start ? null : { votingWindowInvalid: true };
  }

  mealOptions(): SelectOption<string>[] {
    return this.meals().map((meal) => ({ label: meal.name, value: meal.id }));
  }

  mealNames(survey: DailySurvey): string {
    return (
      survey.survey_meals?.map((item) => item.meal?.name).filter(Boolean).join(', ') ||
      this.translateService.instant('admin.surveys.noMealsAssigned')
    );
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ surveyDate: new Date(), status: 'draft', votingStartsAt: new Date(), votingEndsAt: endOfToday(), mealIds: [] });
    this.dialogVisible.set(true);
  }

  openEdit(survey: DailySurvey): void {
    this.editingId.set(survey.id);
    this.form.reset({
      surveyDate: new Date(survey.survey_date),
      status: survey.status,
      votingStartsAt: new Date(survey.voting_starts_at),
      votingEndsAt: new Date(survey.voting_ends_at),
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
        voting_starts_at: survey.voting_starts_at,
        voting_ends_at: survey.voting_ends_at,
        mealIds: survey.survey_meals?.map((item) => item.meal_id) ?? []
      });
      this.toastService.success(
        this.translateService.instant('admin.surveys.toast.updatedTitle'),
        this.translateService.instant('admin.surveys.toast.updatedBody', { status: this.translateService.instant(`common.status.${status}`) })
      );
      await this.load();
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('admin.surveys.toast.statusUpdateFailedTitle'),
        this.translateService.instant('admin.surveys.toast.statusUpdateFailedBody')
      );
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
        voting_starts_at: value.votingStartsAt.toISOString(),
        voting_ends_at: value.votingEndsAt.toISOString(),
        mealIds: value.mealIds
      });
      this.toastService.success(
        this.translateService.instant('admin.surveys.toast.savedTitle'),
        this.translateService.instant('admin.surveys.toast.savedBody')
      );
      this.dialogVisible.set(false);
      await this.load();
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('admin.surveys.toast.saveFailedTitle'),
        this.translateService.instant('admin.surveys.toast.saveFailedBody')
      );
    } finally {
      this.saving.set(false);
    }
  }

  async deleteSurvey(id: string): Promise<void> {
    try {
      await this.adminService.deleteSurvey(id);
      this.toastService.success(
        this.translateService.instant('admin.surveys.toast.deletedTitle'),
        this.translateService.instant('admin.surveys.toast.deletedBody')
      );
      await this.load();
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('admin.surveys.toast.deleteFailedTitle'),
        this.translateService.instant('admin.surveys.toast.deleteFailedBody')
      );
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
      this.toastService.error(
        this.translateService.instant('admin.surveys.toast.unavailableTitle'),
        this.translateService.instant('admin.surveys.toast.unavailableBody')
      );
    } finally {
      this.loading.set(false);
    }
  }
}
