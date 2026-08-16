import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmployeeService } from '../services/employee.service';
import { ToastService } from '../../core/services/toast.service';
import { DailySurvey } from '../../core/models/app.models';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { TodaySurveyVoteCardComponent } from '../components/today-survey-vote-card.component';
import { SurveyVotersByMealComponent } from '../../shared/components/survey-voters-by-meal.component';

@Component({
  selector: 'app-today-survey',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslatePipe,
    CardModule,
    DatePickerModule,
    PageHeaderComponent,
    EmptyStateComponent,
    TodaySurveyVoteCardComponent,
    SurveyVotersByMealComponent
  ],
  template: `
    <app-page-header
      [eyebrow]="'employee.eyebrow' | translate"
      [title]="'employee.todaySurvey.title' | translate"
      [subtitle]="'employee.todaySurvey.subtitle' | translate"
      [badge]="'employee.todaySurvey.badge' | translate"
    ></app-page-header>

    @if (loading()) {
      <p-card>
        <p class="m-0 text-600">{{ 'employee.todaySurvey.loading' | translate }}</p>
      </p-card>
    } @else if (!survey()) {
      <app-empty-state
        [title]="'employee.todaySurvey.emptyTitle' | translate"
        [message]="'employee.todaySurvey.emptyMessage' | translate"
      ></app-empty-state>
    } @else {
      <app-today-survey-vote-card
        [survey]="survey()!"
        [selectedMealId]="selectedMealId()"
        [submitting]="submitting()"
        (voted)="vote($event)"
      ></app-today-survey-vote-card>
    }

    <p-card class="mt-4">
      <div class="flex flex-column gap-2 mb-4" style="max-width: 18rem;">
        <label for="voters-date">{{ 'shared.surveyVoters.dateLabel' | translate }}</label>
        <p-datepicker
          inputId="voters-date"
          [ngModel]="votersReportDate()"
          (ngModelChange)="setVotersReportDate($event)"
          [showIcon]="true"
          appendTo="body"
        ></p-datepicker>
      </div>

      <app-survey-voters-by-meal [reportDate]="votersReportDate()"></app-survey-voters-by-meal>
    </p-card>
  `
})
export class TodaySurveyComponent {
  private readonly employeeService = inject(EmployeeService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly survey = signal<DailySurvey | null>(null);
  readonly selectedMealId = signal<string | null>(null);

  /** Independent of today's vote card — lets the employee browse any date's voters, same as meal_coordinator. */
  readonly votersReportDate = signal(new Date());
  private readonly votersPanel = viewChild(SurveyVotersByMealComponent);

  constructor() {
    void this.load();
  }

  setVotersReportDate(value: Date | null): void {
    if (!value) {
      return;
    }

    this.votersReportDate.set(value);
  }

  async vote(mealId: string): Promise<void> {
    if (!this.survey()) {
      return;
    }

    this.submitting.set(true);

    try {
      await this.employeeService.submitVote(this.survey()!.id, mealId);
      this.selectedMealId.set(mealId);
      this.votersPanel()?.refresh();
      this.toastService.success(
        this.translateService.instant('employee.todaySurvey.toast.votedTitle'),
        this.translateService.instant('employee.todaySurvey.toast.votedBody')
      );
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('employee.todaySurvey.toast.voteFailedTitle'),
        this.translateService.instant('employee.todaySurvey.toast.voteFailedBody')
      );
    } finally {
      this.submitting.set(false);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);

    try {
      const { survey, selectedMealId } = await this.employeeService.getTodaySurvey();
      this.survey.set(survey);
      this.selectedMealId.set(selectedMealId);
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('employee.todaySurvey.toast.unavailableTitle'),
        this.translateService.instant('employee.todaySurvey.toast.unavailableBody')
      );
    } finally {
      this.loading.set(false);
    }
  }
}
