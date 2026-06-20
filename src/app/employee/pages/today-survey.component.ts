import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmployeeService } from '../services/employee.service';
import { ToastService } from '../../core/services/toast.service';
import { DailySurvey } from '../../core/models/app.models';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

@Component({
  selector: 'app-today-survey',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CardModule, ButtonModule, TagModule, PageHeaderComponent, EmptyStateComponent],
  template: `
    <app-page-header
      eyebrow="Employee"
      title="Today's Survey"
      subtitle="Open surveys appear here with meal choices and vote status."
      badge="Single vote"
    ></app-page-header>

    @if (loading()) {
      <p-card>
        <p class="m-0 text-600">Loading today's survey...</p>
      </p-card>
    } @else if (!survey()) {
      <app-empty-state title="No survey today" message="There is no open survey for today yet."></app-empty-state>
    } @else {
      <div class="grid">
        @for (surveyMeal of survey()?.survey_meals ?? []; track surveyMeal.id) {
          <div class="col-12 md:col-6 xl:col-4">
            <p-card styleClass="h-full" [style]="cardStyle(surveyMeal.meal_id)">
              <div class="flex justify-content-between gap-3 align-items-start">
                <div>
                  <h3 class="mt-0 mb-2">{{ surveyMeal.meal?.name }}</h3>
                  <p class="m-0 text-600 line-height-3">{{ surveyMeal.meal?.description || 'No description provided.' }}</p>
                </div>
                @if (selectedMealId() === surveyMeal.meal_id) {
                  <p-tag value="Selected" severity="success"></p-tag>
                }
              </div>

              <div class="mt-4 flex justify-content-between align-items-center gap-2">
                <button
                  pButton
                  type="button"
                  [label]="selectedMealId() === surveyMeal.meal_id ? 'Selected' : 'Choose meal'"
                  [outlined]="selectedMealId() !== surveyMeal.meal_id"
                  [disabled]="hasVoted()"
                  (click)="form.controls.mealId.setValue(surveyMeal.meal_id)"
                ></button>
              </div>
            </p-card>
          </div>
        }
      </div>

      <p-card class="mt-4">
        <div class="flex flex-column gap-3 md:flex-row md:justify-content-between md:align-items-center">
          <div>
            <h3 class="mt-0 mb-2">Submit your vote</h3>
            <p class="m-0 text-600">
              {{ hasVoted() ? 'Your vote has been recorded for today.' : 'Once submitted, the vote is locked for the day.' }}
            </p>
          </div>
          <button
            pButton
            type="button"
            label="Submit vote"
            [disabled]="form.invalid || hasVoted() || submitting()"
            (click)="submit()"
          ></button>
        </div>
      </p-card>
    }
  `
})
export class TodaySurveyComponent {
  private readonly fb = inject(FormBuilder);
  private readonly employeeService = inject(EmployeeService);
  private readonly toastService = inject(ToastService);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly survey = signal<DailySurvey | null>(null);
  readonly selectedMealId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    mealId: ['', Validators.required]
  });

  constructor() {
    void this.load();
  }

  hasVoted(): boolean {
    return !!this.selectedMealId();
  }

  cardStyle(mealId: string): Record<string, string> {
    return this.form.controls.mealId.value === mealId
      ? { border: '1px solid var(--p-primary-color)' }
      : {};
  }

  async submit(): Promise<void> {
    if (this.form.invalid || !this.survey()) {
      return;
    }

    this.submitting.set(true);

    try {
      await this.employeeService.submitVote(this.survey()!.id, this.form.controls.mealId.value);
      this.selectedMealId.set(this.form.controls.mealId.value);
      this.toastService.success('Vote recorded', 'Your meal choice has been saved for today.');
    } catch (error) {
      console.error(error);
      this.toastService.error('Vote failed', 'Unable to submit your vote. If you already voted, the record remains unchanged.');
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

      const defaultMealId = selectedMealId ?? survey?.survey_meals?.[0]?.meal_id ?? '';
      this.form.controls.mealId.setValue(defaultMealId);
    } catch (error) {
      console.error(error);
      this.toastService.error('Survey unavailable', 'Unable to load today\'s survey.');
    } finally {
      this.loading.set(false);
    }
  }
}
