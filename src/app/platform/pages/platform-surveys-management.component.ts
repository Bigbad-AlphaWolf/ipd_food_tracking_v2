import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { PlatformService } from '../services/platform.service';
import { AdminService } from '../../admin/services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDeleteComponent } from '../../shared/components/confirm-delete.component';
import { DailySurvey, Meal, Organization, SelectOption } from '../../core/models/app.models';

@Component({
  selector: 'app-platform-surveys-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
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
      [eyebrow]="'platform.eyebrow' | translate"
      [title]="'platform.surveys.title' | translate"
      [subtitle]="'platform.surveys.subtitle' | translate"
    ></app-page-header>

    <div class="app-surface p-3 mb-4">
      <div class="grid align-items-end">
        <div class="col-12 md:col-8">
          <p-select
            [options]="organizationFilterOptions()"
            optionLabel="label"
            optionValue="value"
            [ngModel]="organizationFilter()"
            [ngModelOptions]="{ standalone: true }"
            (ngModelChange)="setOrganizationFilter($event)"
            [placeholder]="'platform.surveys.organizationFilterPlaceholder' | translate"
            [showClear]="true"
            class="w-full"
          ></p-select>
        </div>

        <div class="col-12 md:col-4 flex justify-content-end">
          <button pButton type="button" [label]="'platform.surveys.newSurvey' | translate" icon="pi pi-plus" (click)="openCreate()"></button>
        </div>
      </div>
    </div>

    <p-table [value]="surveys()" [loading]="loading()" responsiveLayout="scroll" dataKey="id" styleClass="p-datatable-sm">
      <ng-template pTemplate="header">
        <tr>
          <th>{{ 'admin.surveys.table.date' | translate }}</th>
          <th>{{ 'platform.surveys.table.organization' | translate }}</th>
          <th>{{ 'admin.surveys.table.status' | translate }}</th>
          <th>{{ 'admin.surveys.table.meals' | translate }}</th>
          <th class="w-12rem">{{ 'admin.surveys.table.actions' | translate }}</th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-survey>
        <tr>
          <td>{{ survey.survey_date | date: 'mediumDate' }}</td>
          <td><p-tag [value]="survey.organization?.name" severity="info"></p-tag></td>
          <td>
            <p-tag
              [value]="('common.status.' + survey.status) | translate"
              [severity]="survey.status === 'open' ? 'success' : survey.status === 'closed' ? 'danger' : 'warn'"
            ></p-tag>
          </td>
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
        <div class="flex flex-column gap-2">
          <label for="survey-organization">{{ 'platform.surveys.dialog.organizationLabel' | translate }}</label>
          <p-select
            inputId="survey-organization"
            [options]="organizationOptions()"
            optionLabel="label"
            optionValue="value"
            formControlName="organizationId"
            appendTo="body"
          ></p-select>
        </div>

        <div class="grid">
          <div class="col-12 md:col-6 flex flex-column gap-2">
            <label for="survey-date">{{ 'admin.surveys.dialog.dateLabel' | translate }}</label>
            <p-datepicker inputId="survey-date" formControlName="surveyDate" [showIcon]="true" appendTo="body"></p-datepicker>
          </div>
          <div class="col-12 md:col-6 flex flex-column gap-2">
            <label for="survey-status">{{ 'admin.surveys.dialog.statusLabel' | translate }}</label>
            <p-select inputId="survey-status" [options]="statusOptions()" optionLabel="label" optionValue="value" formControlName="status"></p-select>
          </div>
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
export class PlatformSurveysManagementComponent {
  private readonly fb = inject(FormBuilder);
  private readonly platformService = inject(PlatformService);
  private readonly adminService = inject(AdminService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly dialogVisible = signal(false);
  readonly organizationFilter = signal<string | null>(null);
  readonly surveys = signal<DailySurvey[]>([]);
  readonly meals = signal<Meal[]>([]);
  readonly organizations = signal<Organization[]>([]);
  readonly editingId = signal<string | null>(null);

  readonly statusOptions = computed<SelectOption<DailySurvey['status']>[]>(() => {
    this.translateService.currentLang();
    return [
      { label: this.translateService.instant('common.status.draft'), value: 'draft' },
      { label: this.translateService.instant('common.status.open'), value: 'open' },
      { label: this.translateService.instant('common.status.closed'), value: 'closed' }
    ];
  });

  readonly organizationOptions = computed<SelectOption<string>[]>(() =>
    this.organizations().map((organization) => ({ label: organization.name, value: organization.id }))
  );

  readonly organizationFilterOptions = computed<SelectOption<string>[]>(() => this.organizationOptions());

  readonly form = this.fb.nonNullable.group({
    organizationId: ['', Validators.required],
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
    return (
      survey.survey_meals?.map((item) => item.meal?.name).filter(Boolean).join(', ') ||
      this.translateService.instant('admin.surveys.noMealsAssigned')
    );
  }

  setOrganizationFilter(value: string | null): void {
    this.organizationFilter.set(value);
    void this.loadSurveys();
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ organizationId: this.organizationFilter() ?? '', surveyDate: new Date(), status: 'draft', mealIds: [] });
    this.dialogVisible.set(true);
  }

  openEdit(survey: DailySurvey): void {
    this.editingId.set(survey.id);
    this.form.reset({
      organizationId: survey.organization_id ?? '',
      surveyDate: new Date(survey.survey_date),
      status: survey.status,
      mealIds: survey.survey_meals?.map((item) => item.meal_id) ?? []
    });
    this.dialogVisible.set(true);
  }

  async changeStatus(survey: DailySurvey, status: DailySurvey['status']): Promise<void> {
    try {
      await this.platformService.saveSurvey({
        id: survey.id,
        organizationId: survey.organization_id!,
        survey_date: survey.survey_date,
        status,
        mealIds: survey.survey_meals?.map((item) => item.meal_id) ?? []
      });
      this.toastService.success(
        this.translateService.instant('admin.surveys.toast.updatedTitle'),
        this.translateService.instant('admin.surveys.toast.updatedBody', { status: this.translateService.instant(`common.status.${status}`) })
      );
      await this.loadSurveys();
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
      await this.platformService.saveSurvey({
        id: this.editingId() ?? undefined,
        organizationId: value.organizationId,
        survey_date: value.surveyDate.toISOString().slice(0, 10),
        status: value.status,
        mealIds: value.mealIds
      });
      this.toastService.success(
        this.translateService.instant('admin.surveys.toast.savedTitle'),
        this.translateService.instant('admin.surveys.toast.savedBody')
      );
      this.dialogVisible.set(false);
      await this.loadSurveys();
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
      await this.platformService.deleteSurvey(id);
      this.toastService.success(
        this.translateService.instant('admin.surveys.toast.deletedTitle'),
        this.translateService.instant('admin.surveys.toast.deletedBody')
      );
      await this.loadSurveys();
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
      const [surveys, meals, organizations] = await Promise.all([
        this.platformService.getSurveys(this.organizationFilter()),
        this.adminService.getMeals(),
        this.platformService.getOrganizations()
      ]);
      this.surveys.set(surveys);
      this.meals.set(meals.filter((meal) => meal.is_active));
      this.organizations.set(organizations);
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

  private async loadSurveys(): Promise<void> {
    this.loading.set(true);

    try {
      this.surveys.set(await this.platformService.getSurveys(this.organizationFilter()));
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
