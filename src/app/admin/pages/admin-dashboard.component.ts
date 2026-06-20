import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
  imports: [CardModule, ChartModule, SkeletonModule, PageHeaderComponent],
  template: `
    <app-page-header
      eyebrow="Admin"
      title="Dashboard"
      subtitle="Participation, consumption, and trend monitoring across the current month."
      badge="KPIs"
    ></app-page-header>

    <div class="grid">
      <div class="col-12 md:col-6 xl:col-3">
        <p-card styleClass="stat-card h-full">
          @if (loading()) {
            <p-skeleton width="7rem" height="1.5rem"></p-skeleton>
            <p-skeleton width="5rem" height="2rem" styleClass="mt-3"></p-skeleton>
          } @else {
            <h3>Participation</h3>
            <p class="text-600">{{ metrics().participationRate }}% today ({{ metrics().votesToday }}/{{ metrics().eligibleEmployees }})</p>
          }
        </p-card>
      </div>
      <div class="col-12 md:col-6 xl:col-3">
        <p-card styleClass="stat-card h-full">
          <h3>Monthly meals</h3>
          <p class="text-600">{{ metrics().totalMealsThisMonth }} meals consumed this month.</p>
        </p-card>
      </div>
      <div class="col-12 md:col-6 xl:col-3">
        <p-card styleClass="stat-card h-full">
          <h3>Top meal</h3>
          <p class="text-600">{{ metrics().mostPopularMeal }}</p>
        </p-card>
      </div>
      <div class="col-12 md:col-6 xl:col-3">
        <p-card styleClass="stat-card h-full">
          <h3>Report health</h3>
          <p class="text-600">Exports are driven by the monthly report SQL function.</p>
        </p-card>
      </div>
      <div class="col-12">
        <p-card>
          <h3 class="mt-0">Monthly trend</h3>
          <p-chart type="line" [data]="chartData()"></p-chart>
        </p-card>
      </div>
    </div>
  `
})
export class AdminDashboardComponent {
  private readonly adminService = inject(AdminService);
  private readonly toastService = inject(ToastService);

  readonly loading = signal(true);
  readonly metrics = signal<AdminDashboardMetrics>({
    participationRate: 0,
    totalMealsThisMonth: 0,
    mostPopularMeal: 'No data',
    votesToday: 0,
    eligibleEmployees: 0
  });
  readonly trend = signal<TrendPoint[]>([]);

  readonly chartData = computed(() => ({
    labels: this.trend().map((point) => point.label),
    datasets: [
      {
        label: 'Votes',
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
      this.toastService.error('Dashboard unavailable', 'Unable to load admin metrics.');
    } finally {
      this.loading.set(false);
    }
  }
}
