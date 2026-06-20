import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
  imports: [CardModule, ButtonModule, SkeletonModule, RouterLink, PageHeaderComponent],
  template: `
    <app-page-header
      eyebrow="Employee"
      title="Dashboard"
      subtitle="Your meal voting activity and today's action items."
      badge="Live"
    ></app-page-header>

    <div class="grid">
      <div class="col-12 md:col-6 xl:col-3">
        <p-card styleClass="stat-card h-full">
          @if (loading()) {
            <p-skeleton width="8rem" height="1.5rem"></p-skeleton>
            <p-skeleton width="100%" height="3rem" styleClass="mt-3"></p-skeleton>
          } @else {
            <h3>Today's survey</h3>
            <p class="text-600">{{ summary().hasOpenSurvey ? 'A survey is available for voting.' : 'No open survey for today.' }}</p>
          }
        </p-card>
      </div>
      <div class="col-12 md:col-6 xl:col-3">
        <p-card styleClass="stat-card h-full">
          @if (loading()) {
            <p-skeleton width="8rem" height="1.5rem"></p-skeleton>
            <p-skeleton width="6rem" height="2rem" styleClass="mt-3"></p-skeleton>
          } @else {
            <h3>This month</h3>
            <p class="text-600">{{ summary().monthVoteCount }} meals selected so far.</p>
          }
        </p-card>
      </div>
      <div class="col-12 md:col-6 xl:col-3">
        <p-card styleClass="stat-card h-full">
          @if (loading()) {
            <p-skeleton width="8rem" height="1.5rem"></p-skeleton>
            <p-skeleton width="100%" height="3rem" styleClass="mt-3"></p-skeleton>
          } @else {
            <h3>Last selected meal</h3>
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
            <h3>Status</h3>
            <p class="text-600">{{ summary().hasVotedToday ? "Today's vote is already locked in." : "You can still vote today." }}</p>
          }
        </p-card>
      </div>
      <div class="col-12">
        <p-card>
          <div class="flex flex-column gap-3 md:flex-row md:justify-content-between md:align-items-center">
            <div>
              <h3 class="mt-0 mb-2">Quick actions</h3>
              <p class="m-0 text-600">Jump into voting or inspect your monthly history.</p>
            </div>
            <div class="flex gap-2 flex-wrap">
              <a pButton routerLink="/employee/today-survey" label="Open today's survey"></a>
              <a pButton routerLink="/employee/history" severity="secondary" outlined label="View my history"></a>
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

  readonly loading = signal(true);
  readonly summary = signal<EmployeeDashboardSummary>({
    hasOpenSurvey: false,
    hasVotedToday: false,
    monthVoteCount: 0,
    lastMealName: 'No meal yet'
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);

    try {
      const now = new Date();
      this.summary.set(await this.employeeService.getDashboardSummary(now.getMonth() + 1, now.getFullYear()));
      console.log(this.summary());

    } catch (error) {
      console.error(error);
      this.toastService.error('Dashboard unavailable', 'Unable to load your employee dashboard.');
    } finally {
      this.loading.set(false);
    }
  }
}
