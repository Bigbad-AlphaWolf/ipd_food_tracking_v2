import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmployeeService } from '../services/employee.service';
import { ToastService } from '../../core/services/toast.service';
import { DailySurvey } from '../../core/models/app.models';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { TodaySurveyVoteCardComponent } from '../components/today-survey-vote-card.component';

@Component({
  selector: 'app-today-survey',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, CardModule, PageHeaderComponent, EmptyStateComponent, TodaySurveyVoteCardComponent],
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

  constructor() {
    void this.load();
  }

  async vote(mealId: string): Promise<void> {
    if (!this.survey()) {
      return;
    }

    this.submitting.set(true);

    try {
      await this.employeeService.submitVote(this.survey()!.id, mealId);
      this.selectedMealId.set(mealId);
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
