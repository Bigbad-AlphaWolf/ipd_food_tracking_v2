import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DailySurvey } from '../../core/models/app.models';

/**
 * The actual "pick a meal and vote" UI for today's open survey — shared by
 * the employee dashboard (quick vote) and the dedicated Today's Survey page.
 * `survey`/`selectedMealId` are the source of truth from the server; the
 * component only tracks which meal is currently highlighted before the vote
 * is submitted.
 */
@Component({
  selector: 'app-today-survey-vote-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, CardModule, ButtonModule, TagModule],
  template: `
    <div class="grid">
      @for (surveyMeal of survey().survey_meals ?? []; track surveyMeal.id) {
        <div class="col-12 md:col-6 xl:col-4">
          <p-card styleClass="h-full" [style]="cardStyle(surveyMeal.meal_id)">
            <div class="flex justify-content-between gap-3 align-items-start">
              <div>
                <h3 class="mt-0 mb-2">{{ surveyMeal.meal?.name }}</h3>
                <p class="m-0 text-600 line-height-3">{{ surveyMeal.meal?.description || ('employee.todaySurvey.noDescription' | translate) }}</p>
              </div>
              @if (selectedMealId() === surveyMeal.meal_id) {
                <p-tag [value]="'employee.todaySurvey.selectedTag' | translate" severity="success"></p-tag>
              }
            </div>

            <div class="mt-4 flex justify-content-between align-items-center gap-2">
              <button
                pButton
                type="button"
                [label]="(pendingMealId() === surveyMeal.meal_id ? 'employee.todaySurvey.selectedTag' : 'employee.todaySurvey.chooseMeal') | translate"
                [outlined]="pendingMealId() !== surveyMeal.meal_id"
                [disabled]="hasVoted()"
                (click)="pendingMealId.set(surveyMeal.meal_id)"
              ></button>
            </div>
          </p-card>
        </div>
      }
    </div>

    <p-card class="mt-4">
      <div class="flex flex-column gap-3 md:flex-row md:justify-content-between md:align-items-center">
        <div>
          <h3 class="mt-0 mb-2">{{ 'employee.todaySurvey.submitSectionTitle' | translate }}</h3>
          <p class="m-0 text-600">
            {{ (hasVoted() ? 'employee.todaySurvey.votedNote' : 'employee.todaySurvey.notVotedNote') | translate }}
          </p>
        </div>
        <button
          pButton
          type="button"
          [label]="'employee.todaySurvey.submitVote' | translate"
          [disabled]="!pendingMealId() || hasVoted() || submitting()"
          (click)="submit()"
        ></button>
      </div>
    </p-card>
  `
})
export class TodaySurveyVoteCardComponent {
  readonly survey = input.required<DailySurvey>();
  readonly selectedMealId = input<string | null>(null);
  readonly submitting = input(false);

  readonly voted = output<string>();

  readonly pendingMealId = signal<string | null>(null);
  readonly hasVoted = computed(() => !!this.selectedMealId());

  constructor() {
    // Resync the local pick whenever the server-confirmed vote or the
    // survey itself changes (new day, or a vote just landed).
    effect(() => {
      const survey = this.survey();
      const selected = this.selectedMealId();
      this.pendingMealId.set(selected ?? survey.survey_meals?.[0]?.meal_id ?? null);
    });
  }

  cardStyle(mealId: string): Record<string, string> {
    return this.pendingMealId() === mealId ? { border: '1px solid var(--p-primary-color)' } : {};
  }

  submit(): void {
    const mealId = this.pendingMealId();

    if (!mealId || this.hasVoted() || this.submitting()) {
      return;
    }

    this.voted.emit(mealId);
  }
}
