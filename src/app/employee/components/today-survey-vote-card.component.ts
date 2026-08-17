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
 * is submitted. Once voted, meal selection locks until the employee opts
 * into editing via "Change vote" — available as long as the survey is still
 * open and within its voting window (mirrors the votes UPDATE RLS policy).
 */
@Component({
  selector: 'app-today-survey-vote-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, CardModule, ButtonModule, TagModule],
  template: `
    <div class="grid">
      @for (surveyMeal of survey().survey_meals ?? []; track surveyMeal.id) {
        <div class="col-12 md:col-6 xl:col-4">
          <p-card
            styleClass="h-full"
            [style]="cardStyle(surveyMeal.meal_id)"
            role="button"
            [attr.tabindex]="isLocked() ? -1 : 0"
            [attr.aria-pressed]="pendingMealId() === surveyMeal.meal_id"
            [attr.aria-disabled]="isLocked()"
            (click)="selectMeal(surveyMeal.meal_id)"
            (keydown.enter)="selectMeal(surveyMeal.meal_id)"
            (keydown.space)="$event.preventDefault(); selectMeal(surveyMeal.meal_id)"
          >
            <div class="flex justify-content-between gap-3 align-items-start">
              <div>
                <h3 class="mt-0 mb-2">{{ surveyMeal.meal?.name }}</h3>
                <p class="m-0 text-600 line-height-3">{{ surveyMeal.meal?.description || ('employee.todaySurvey.noDescription' | translate) }}</p>
              </div>
              @if (pendingMealId() === surveyMeal.meal_id) {
                <p-tag
                  [value]="(selectedMealId() === surveyMeal.meal_id ? 'employee.todaySurvey.selectedTag' : 'employee.todaySurvey.pickedTag') | translate"
                  [severity]="selectedMealId() === surveyMeal.meal_id ? 'success' : 'info'"
                ></p-tag>
              }
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

        <div class="flex gap-2">
          @if (isLocked()) {
            @if (canEditVote()) {
              <button
                pButton
                type="button"
                severity="secondary"
                outlined
                [label]="'employee.todaySurvey.changeVote' | translate"
                (click)="startEditing()"
              ></button>
            }
          } @else {
            @if (editing()) {
              <button
                pButton
                type="button"
                severity="secondary"
                text
                [label]="'employee.todaySurvey.cancelEdit' | translate"
                [disabled]="submitting()"
                (click)="cancelEditing()"
              ></button>
            }
            <button
              pButton
              type="button"
              [label]="(editing() ? 'employee.todaySurvey.updateVote' : 'employee.todaySurvey.submitVote') | translate"
              [disabled]="!pendingMealId() || submitting()"
              (click)="submit()"
            ></button>
          }
        </div>
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
  readonly editing = signal(false);
  readonly hasVoted = computed(() => !!this.selectedMealId());
  /** Meal cards are only clickable before the first vote, or while editing an existing one. */
  readonly isLocked = computed(() => this.hasVoted() && !this.editing());

  /** Editing is only allowed while the survey is still open and within its voting window — mirrors the votes UPDATE RLS policy. */
  readonly canEditVote = computed(() => {
    const survey = this.survey();

    if (survey.status !== 'open') {
      return false;
    }

    const now = new Date();
    return now >= new Date(survey.voting_starts_at) && now <= new Date(survey.voting_ends_at);
  });

  constructor() {
    // Resync the local pick whenever the server-confirmed vote or the
    // survey itself changes (new day, or a vote just landed), and drop out
    // of editing mode since the edit just completed (or the survey changed).
    effect(() => {
      const survey = this.survey();
      const selected = this.selectedMealId();
      this.pendingMealId.set(selected ?? survey.survey_meals?.[0]?.meal_id ?? null);
      this.editing.set(false);
    });
  }

  cardStyle(mealId: string): Record<string, string> {
    return {
      cursor: this.isLocked() ? 'default' : 'pointer',
      ...(this.pendingMealId() === mealId ? { border: '1px solid var(--p-primary-color)' } : {})
    };
  }

  selectMeal(mealId: string): void {
    if (this.isLocked()) {
      return;
    }

    this.pendingMealId.set(mealId);
  }

  startEditing(): void {
    if (!this.canEditVote()) {
      return;
    }

    this.editing.set(true);
  }

  cancelEditing(): void {
    this.editing.set(false);
    this.pendingMealId.set(this.selectedMealId());
  }

  submit(): void {
    const mealId = this.pendingMealId();

    if (!mealId || this.isLocked() || this.submitting()) {
      return;
    }

    this.voted.emit(mealId);
  }
}
