import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { AppTableComponent } from '../../shared/components/app-table.component';
import { SearchToolbarComponent } from '../../shared/components/search-toolbar.component';
import { EmployeeService } from '../services/employee.service';
import { ToastService } from '../../core/services/toast.service';
import { AppTableColumn, EmployeeHistoryRow, SelectOption } from '../../core/models/app.models';

@Component({
  selector: 'app-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, PageHeaderComponent, AppTableComponent, SearchToolbarComponent],
  template: `
    <app-page-header
      [eyebrow]="'employee.eyebrow' | translate"
      [title]="'employee.history.title' | translate"
      [subtitle]="'employee.history.subtitle' | translate"
      [badge]="'employee.history.badge' | translate"
    ></app-page-header>

    <app-search-toolbar
      [search]="search()"
      [showMonth]="true"
      [showYear]="true"
      [month]="month()"
      [year]="year()"
      [monthOptions]="monthOptions()"
      [yearOptions]="yearOptions"
      [searchPlaceholder]="'employee.history.searchPlaceholder' | translate"
      (searchChange)="search.set($event)"
      (monthChange)="setMonth($event)"
      (yearChange)="setYear($event)"
      (clear)="resetFilters()"
    ></app-search-toolbar>

    <app-table [columns]="columns()" [rows]="filteredRows()" [loading]="loading()" [emptyMessage]="'employee.history.emptyMessage' | translate"></app-table>
  `
})
export class HistoryComponent {
  private readonly employeeService = inject(EmployeeService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  readonly loading = signal(false);
  readonly search = signal('');
  readonly month = signal(new Date().getMonth() + 1);
  readonly year = signal(new Date().getFullYear());
  readonly rows = signal<EmployeeHistoryRow[]>([]);

  readonly columns = computed<AppTableColumn[]>(() => {
    this.translateService.currentLang();
    return [
      { field: 'surveyDate', header: this.translateService.instant('employee.history.table.surveyDate'), type: 'date' },
      { field: 'mealName', header: this.translateService.instant('employee.history.table.meal') },
      { field: 'votedAt', header: this.translateService.instant('employee.history.table.votedAt'), type: 'datetime' },
      { field: 'status', header: this.translateService.instant('employee.history.table.status'), type: 'tag' }
    ];
  });

  readonly monthOptions = computed<SelectOption<number>[]>(() => {
    this.translateService.currentLang();
    return Array.from({ length: 12 }, (_, index) => {
      const value = index + 1;
      return { label: this.translateService.instant(`common.months.${value}`), value };
    });
  });

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
      this.toastService.error(
        this.translateService.instant('employee.history.toast.unavailableTitle'),
        this.translateService.instant('employee.history.toast.unavailableBody')
      );
    } finally {
      this.loading.set(false);
    }
  }
}
