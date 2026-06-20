import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { AppTableComponent } from '../../shared/components/app-table.component';
import { SearchToolbarComponent } from '../../shared/components/search-toolbar.component';
import { EmployeeService } from '../services/employee.service';
import { ToastService } from '../../core/services/toast.service';
import { AppTableColumn, EmployeeHistoryRow, SelectOption } from '../../core/models/app.models';

@Component({
  selector: 'app-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, AppTableComponent, SearchToolbarComponent],
  template: `
    <app-page-header
      eyebrow="Employee"
      title="My History"
      subtitle="Monthly voting history with searchable meal records."
      badge="By month"
    ></app-page-header>

    <app-search-toolbar
      [search]="search()"
      [showMonth]="true"
      [showYear]="true"
      [month]="month()"
      [year]="year()"
      [monthOptions]="monthOptions"
      [yearOptions]="yearOptions"
      searchPlaceholder="Search by meal name"
      (searchChange)="search.set($event)"
      (monthChange)="setMonth($event)"
      (yearChange)="setYear($event)"
      (clear)="resetFilters()"
    ></app-search-toolbar>

    <app-table [columns]="columns" [rows]="filteredRows()" [loading]="loading()" emptyMessage="No meal history found for the selected month."></app-table>
  `
})
export class HistoryComponent {
  private readonly employeeService = inject(EmployeeService);
  private readonly toastService = inject(ToastService);

  readonly loading = signal(false);
  readonly search = signal('');
  readonly month = signal(new Date().getMonth() + 1);
  readonly year = signal(new Date().getFullYear());
  readonly rows = signal<EmployeeHistoryRow[]>([]);

  readonly columns: AppTableColumn[] = [
    { field: 'surveyDate', header: 'Survey Date', type: 'date' },
    { field: 'mealName', header: 'Meal' },
    { field: 'votedAt', header: 'Voted At', type: 'datetime' },
    { field: 'status', header: 'Status', type: 'tag' }
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

  readonly filteredRows = computed(() => {
    const searchTerm = this.search().trim().toLowerCase();
    return this.rows().filter((row) => row.mealName.toLowerCase().includes(searchTerm));
  });

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

  private async load(): Promise<void> {
    this.loading.set(true);

    try {
      this.rows.set(await this.employeeService.getHistory(this.month(), this.year()));
    } catch (error) {
      console.error(error);
      this.toastService.error('History unavailable', 'Unable to load your meal history.');
    } finally {
      this.loading.set(false);
    }
  }
}
