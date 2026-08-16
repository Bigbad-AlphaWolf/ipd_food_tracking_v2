import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AccordionModule } from 'primeng/accordion';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { SurveyVotersService } from '../../core/services/survey-voters.service';
import { ToastService } from '../../core/services/toast.service';
import { MealVoterGroup } from '../../core/models/app.models';

/**
 * "Who's voting for what" — every meal in the given day's survey, each with
 * the list of employees who chose it. Visible to any role; org-scoped
 * server-side (see get_survey_voters_by_meal). Self-contained: fetches its
 * own data whenever `reportDate` changes, so a host page just needs to pass
 * a date.
 */
@Component({
  selector: 'app-survey-voters-by-meal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, AccordionModule, TagModule, SkeletonModule],
  template: `
    <div>
      <h3 class="mt-0 mb-1">{{ 'shared.surveyVoters.title' | translate }}</h3>
      <p class="mt-0 mb-3 text-600">{{ 'shared.surveyVoters.subtitle' | translate }}</p>

      @if (loading()) {
        <p-skeleton width="100%" height="3rem" styleClass="mb-2"></p-skeleton>
        <p-skeleton width="100%" height="3rem"></p-skeleton>
      } @else if (groups().length === 0) {
        <p class="text-600 m-0">{{ 'shared.surveyVoters.emptyMessage' | translate }}</p>
      } @else {
        <p-accordion [value]="expandedIds()" (valueChange)="setExpandedIds($event)" [multiple]="true">
          @for (group of groups(); track group.meal_id) {
            <p-accordion-panel [value]="group.meal_id">
              <p-accordion-header>
                <div class="flex align-items-center justify-content-between gap-2 w-full pr-3">
                  <span class="font-medium">{{ group.meal_name }}</span>
                  <p-tag [value]="'shared.surveyVoters.voterCount' | translate: { count: group.voters.length }" severity="info"></p-tag>
                </div>
              </p-accordion-header>
              <p-accordion-content>
                @if (group.voters.length === 0) {
                  <p class="text-600 m-0">{{ 'shared.surveyVoters.noVotersYet' | translate }}</p>
                } @else {
                  <div class="flex flex-wrap gap-2">
                    @for (voter of group.voters; track voter.id) {
                      <p-tag [value]="voter.full_name" severity="secondary"></p-tag>
                    }
                  </div>
                }
              </p-accordion-content>
            </p-accordion-panel>
          }
        </p-accordion>
      }
    </div>
  `
})
export class SurveyVotersByMealComponent {
  private readonly surveyVotersService = inject(SurveyVotersService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  readonly reportDate = input.required<Date>();
  /** A platform administrator has no active organization of their own and must pass one explicitly. */
  readonly organizationId = input<string | null>(null);

  readonly loading = signal(true);
  readonly groups = signal<MealVoterGroup[]>([]);
  readonly expandedIds = signal<string[]>([]);

  constructor() {
    effect(() => {
      const reportDate = this.reportDate();
      const organizationId = this.organizationId();
      void this.load(reportDate, organizationId);
    });
  }

  /** Lets a host page re-fetch after a vote is cast, without waiting for reportDate to change. */
  refresh(): void {
    void this.load(this.reportDate(), this.organizationId());
  }

  /** p-accordion's valueChange is typed for both single/multiple modes; this is always used in `multiple` mode with string meal ids. */
  setExpandedIds(value: string | number | string[] | number[] | null | undefined): void {
    if (Array.isArray(value)) {
      this.expandedIds.set(value.map(String));
    } else {
      this.expandedIds.set(value == null ? [] : [String(value)]);
    }
  }

  private async load(reportDate: Date, organizationId: string | null): Promise<void> {
    this.loading.set(true);

    try {
      const dateParam = reportDate.toISOString().slice(0, 10);
      const groups = await this.surveyVotersService.getSurveyVotersByMeal(dateParam, organizationId);
      this.groups.set(groups);
      this.expandedIds.set(groups.map((group) => group.meal_id));
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('shared.surveyVoters.toast.unavailableTitle'),
        this.translateService.instant('shared.surveyVoters.toast.unavailableBody')
      );
    } finally {
      this.loading.set(false);
    }
  }
}
