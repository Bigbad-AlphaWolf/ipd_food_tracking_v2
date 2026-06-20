import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SearchToolbarComponent } from '../../shared/components/search-toolbar.component';
import { AppTableComponent } from '../../shared/components/app-table.component';
import { AdminService } from '../services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { AppTableColumn, MonthlyReportRow, SelectOption } from '../../core/models/app.models';

@Component({
  selector: 'app-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, PageHeaderComponent, SearchToolbarComponent, AppTableComponent],
  template: `
    <app-page-header
      eyebrow="Admin"
      title="Reports"
      subtitle="Monthly employee meal consumption with exports."
      badge="CSV + Excel"
    ></app-page-header>

    <app-search-toolbar
      [search]="search()"
      [showMonth]="true"
      [showYear]="true"
      [month]="month()"
      [year]="year()"
      [monthOptions]="monthOptions"
      [yearOptions]="yearOptions"
      searchPlaceholder="Search employee"
      (searchChange)="search.set($event)"
      (monthChange)="setMonth($event)"
      (yearChange)="setYear($event)"
      (clear)="resetFilters()"
    ></app-search-toolbar>

    <div class="flex justify-content-end gap-2 mb-3 flex-wrap">
      <button pButton type="button" icon="pi pi-file-export" label="Export CSV" severity="secondary" outlined [disabled]="rows().length === 0" (click)="exportCsv()"></button>
      <button pButton type="button" icon="pi pi-file-excel" label="Export Excel" [disabled]="rows().length === 0" (click)="exportExcel()"></button>
    </div>

    <app-table [columns]="columns" [rows]="tableRows()" [loading]="loading()" emptyMessage="No report rows found for the selected period."></app-table>
  `
})
export class ReportsComponent {
  private readonly adminService = inject(AdminService);
  private readonly toastService = inject(ToastService);

  readonly loading = signal(false);
  readonly search = signal('');
  readonly month = signal(new Date().getMonth() + 1);
  readonly year = signal(new Date().getFullYear());
  readonly rows = signal<MonthlyReportRow[]>([]);

  readonly columns: AppTableColumn[] = [
    { field: 'employeeName', header: 'Employee' },
    { field: 'email', header: 'Email' },
    { field: 'department', header: 'Department' },
    { field: 'month', header: 'Month' },
    { field: 'totalVotes', header: 'Total Votes', type: 'number' },
    { field: 'favoriteMeal', header: 'Favorite Meal' }
  ];

  readonly monthOptions: SelectOption<number>[] = [
    { label: 'January', value: 1 },
    { label: 'February', value: 2 },
    { label: 'March', value: 3 },
    { label: 'April', value: 4 },
    { label: 'May', value: 5 },
    { label: 'June', value: 6 },
    { label: 'July', value: 7 },
    { label: 'August', value: 8 },
    { label: 'September', value: 9 },
    { label: 'October', value: 10 },
    { label: 'November', value: 11 },
    { label: 'December', value: 12 }
  ];

  readonly yearOptions: SelectOption<number>[] = Array.from({ length: 5 }, (_, index) => {
    const value = new Date().getFullYear() - index;
    return { label: String(value), value };
  });

  readonly tableRows = computed(() => this.rows());

  constructor() {
    void this.load();
  }

  setMonth(value: number | null): void {
    if (!value) {
      return;
    }

    this.month.set(value);
    void this.load();
  }

  setYear(value: number | null): void {
    if (!value) {
      return;
    }

    this.year.set(value);
    void this.load();
  }

  resetFilters(): void {
    const now = new Date();
    this.search.set('');
    this.month.set(now.getMonth() + 1);
    this.year.set(now.getFullYear());
    void this.load();
  }

  exportCsv(): void {
    this.adminService.exportCsv(this.rows(), `food-tracker-report-${this.year()}-${this.month()}`);
  }

  exportExcel(): void {
    this.adminService.exportExcel(this.rows(), `food-tracker-report-${this.year()}-${this.month()}`);
  }

  private async load(): Promise<void> {
    this.loading.set(true);

    try {
      this.rows.set(await this.adminService.getMonthlyReport(this.month(), this.year(), this.search()));
    } catch (error) {
      console.error(error);
      this.toastService.error('Report unavailable', 'Unable to load the monthly report.');
    } finally {
      this.loading.set(false);
    }
  }
}
