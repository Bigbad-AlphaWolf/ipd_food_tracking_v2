import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmployeeService } from '../services/employee.service';
import { ToastService } from '../../core/services/toast.service';
import { EmployeeDashboardSummary } from '../../core/models/app.models';

@Component({
  selector: 'app-employee-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, CardModule, ButtonModule, SkeletonModule, RouterLink, PageHeaderComponent],
  template: `
    <app-page-header
      [eyebrow]="'employee.eyebrow' | translate"
      [title]="'employee.dashboard.title' | translate"
      [subtitle]="'employee.dashboard.subtitle' | translate"
      [badge]="'employee.dashboard.badge' | translate"
    ></app-page-header>

    <div class="grid">
      <div class="col-12 md:col-6 xl:col-3">
        <p-card styleClass="stat-card h-full">
          @if (loading()) {
            <p-skeleton width="8rem" height="1.5rem"></p-skeleton>
            <p-skeleton width="100%" height="3rem" styleClass="mt-3"></p-skeleton>
          } @else {
            <h3>{{ 'employee.dashboard.todaySurveyTitle' | translate }}</h3>
            <p class="text-600">
              {{ (summary().hasOpenSurvey ? 'employee.dashboard.hasOpenSurvey' : 'employee.dashboard.noOpenSurvey') | translate }}
            </p>
          }
        </p-card>
      </div>
      <div class="col-12 md:col-6 xl:col-3">
        <p-card styleClass="stat-card h-full">
          @if (loading()) {
            <p-skeleton width="8rem" height="1.5rem"></p-skeleton>
            <p-skeleton width="6rem" height="2rem" styleClass="mt-3"></p-skeleton>
          } @else {
            <h3>{{ 'employee.dashboard.monthTitle' | translate }}</h3>
            <p class="text-600">{{ 'employee.dashboard.monthBody' | translate: { count: summary().monthVoteCount } }}</p>
          }
        </p-card>
      </div>
      <div class="col-12 md:col-6 xl:col-3">
        <p-card styleClass="stat-card h-full">
          @if (loading()) {
            <p-skeleton width="8rem" height="1.5rem"></p-skeleton>
            <p-skeleton width="100%" height="3rem" styleClass="mt-3"></p-skeleton>
          } @else {
            <h3>{{ 'employee.dashboard.lastMealTitle' | translate }}</h3>
            <p class="text-600">{{ summary().lastMealName }}</p>
          }
        </p-card>
      </div>
      <div class="col-12 md:col-6 xl:col-3">
        <p-card styleClass="stat-card h-full">
          @if (loading()) {
            <p-skeleton width="8rem" height="1.5rem"></p-skeleton>
            <p-skeleton width="100%" height="3rem" styleClass="mt-3"></p-skeleton>
          } @else {
            <h3>{{ 'employee.dashboard.statusTitle' | translate }}</h3>
            <p class="text-600">{{ (summary().hasVotedToday ? 'employee.dashboard.votedToday' : 'employee.dashboard.canVote') | translate }}</p>
          }
        </p-card>
      </div>
      <div class="col-12">
        <p-card>
          <div class="flex flex-column gap-3 md:flex-row md:justify-content-between md:align-items-center">
            <div>
              <h3 class="mt-0 mb-2">{{ 'employee.dashboard.quickActionsTitle' | translate }}</h3>
              <p class="m-0 text-600">{{ 'employee.dashboard.quickActionsBody' | translate }}</p>
            </div>
            <div class="flex gap-2 flex-wrap">
              <a pButton routerLink="/employee/today-survey" [label]="'employee.dashboard.openSurveyAction' | translate"></a>
              <a pButton routerLink="/employee/history" severity="secondary" outlined [label]="'employee.dashboard.viewHistoryAction' | translate"></a>
            </div>
          </div>
        </p-card>
      </div>
    </div>
  `
})
export class EmployeeDashboardComponent {
  private readonly employeeService = inject(EmployeeService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  readonly loading = signal(true);
  readonly summary = signal<EmployeeDashboardSummary>({
    hasOpenSurvey: false,
    hasVotedToday: false,
    monthVoteCount: 0,
    lastMealName: this.translateService.instant('employee.dashboard.noMealYet')
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);

    try {
      const now = new Date();
      this.summary.set(await this.employeeService.getDashboardSummary(now.getMonth() + 1, now.getFullYear()));
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('employee.dashboard.toast.unavailableTitle'),
        this.translateService.instant('employee.dashboard.toast.unavailableBody')
      );
    } finally {
      this.loading.set(false);
    }
  }
}
