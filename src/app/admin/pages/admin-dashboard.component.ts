import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { AdminService } from '../services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { AdminDashboardMetrics, TrendPoint } from '../../core/models/app.models';

@Component({
  selector: 'app-admin-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, CardModule, ChartModule, SkeletonModule, PageHeaderComponent],
  template: `
    <app-page-header
      [eyebrow]="'admin.eyebrow' | translate"
      [title]="'admin.dashboard.title' | translate"
      [subtitle]="'admin.dashboard.subtitle' | translate"
      [badge]="'admin.dashboard.badge' | translate"
    ></app-page-header>

    <div class="grid">
      <div class="col-12 md:col-6 xl:col-3">
        <p-card styleClass="stat-card h-full">
          @if (loading()) {
            <p-skeleton width="7rem" height="1.5rem"></p-skeleton>
            <p-skeleton width="5rem" height="2rem" styleClass="mt-3"></p-skeleton>
          } @else {
            <h3>{{ 'admin.dashboard.participationTitle' | translate }}</h3>
            <p class="text-600">
              {{
                'admin.dashboard.participationBody'
                  | translate: { rate: metrics().participationRate, votes: metrics().votesToday, eligible: metrics().eligibleEmployees }
              }}
            </p>
          }
        </p-card>
      </div>
      <div class="col-12 md:col-6 xl:col-3">
        <p-card styleClass="stat-card h-full">
          <h3>{{ 'admin.dashboard.monthlyMealsTitle' | translate }}</h3>
          <p class="text-600">{{ 'admin.dashboard.monthlyMealsBody' | translate: { count: metrics().totalMealsThisMonth } }}</p>
        </p-card>
      </div>
      <div class="col-12 md:col-6 xl:col-3">
        <p-card styleClass="stat-card h-full">
          <h3>{{ 'admin.dashboard.topMealTitle' | translate }}</h3>
          <p class="text-600">{{ metrics().mostPopularMeal }}</p>
        </p-card>
      </div>
      <div class="col-12 md:col-6 xl:col-3">
        <p-card styleClass="stat-card h-full">
          <h3>{{ 'admin.dashboard.reportHealthTitle' | translate }}</h3>
          <p class="text-600">{{ 'admin.dashboard.reportHealthBody' | translate }}</p>
        </p-card>
      </div>
      <div class="col-12">
        <p-card>
          <h3 class="mt-0">{{ 'admin.dashboard.monthlyTrendTitle' | translate }}</h3>
          <p-chart type="line" [data]="chartData()"></p-chart>
        </p-card>
      </div>
    </div>
  `
})
export class AdminDashboardComponent {
  private readonly adminService = inject(AdminService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  readonly loading = signal(true);
  readonly metrics = signal<AdminDashboardMetrics>({
    participationRate: 0,
    totalMealsThisMonth: 0,
    mostPopularMeal: this.translateService.instant('common.placeholders.noData'),
    votesToday: 0,
    eligibleEmployees: 0
  });
  readonly trend = signal<TrendPoint[]>([]);

  readonly chartData = computed(() => ({
    labels: this.trend().map((point) => point.label),
    datasets: [
      {
        label: this.translateService.instant('admin.dashboard.chartVotesLabel'),
        data: this.trend().map((point) => point.value),
        fill: true,
        tension: 0.35
      }
    ]
  }));

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);

    try {
      const { metrics, trend } = await this.adminService.getDashboardMetrics();
      this.metrics.set(metrics);
      this.trend.set(trend);
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('admin.dashboard.toast.unavailableTitle'),
        this.translateService.instant('admin.dashboard.toast.unavailableBody')
      );
    } finally {
      this.loading.set(false);
    }
  }
}
