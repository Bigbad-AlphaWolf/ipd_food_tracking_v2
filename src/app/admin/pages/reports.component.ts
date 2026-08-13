import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
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
  imports: [TranslatePipe, ButtonModule, PageHeaderComponent, SearchToolbarComponent, AppTableComponent],
  template: `
    <app-page-header
      [eyebrow]="'admin.eyebrow' | translate"
      [title]="'admin.reports.title' | translate"
      [subtitle]="'admin.reports.subtitle' | translate"
      [badge]="'admin.reports.badge' | translate"
    ></app-page-header>

    <app-search-toolbar
      [search]="search()"
      [showMonth]="true"
      [showYear]="true"
      [month]="month()"
      [year]="year()"
      [monthOptions]="monthOptions()"
      [yearOptions]="yearOptions"
      [searchPlaceholder]="'admin.reports.searchPlaceholder' | translate"
      (searchChange)="search.set($event)"
      (monthChange)="setMonth($event)"
      (yearChange)="setYear($event)"
      (clear)="resetFilters()"
    ></app-search-toolbar>

    <div class="flex justify-content-end gap-2 mb-3 flex-wrap">
      <button
        pButton
        type="button"
        icon="pi pi-file-export"
        [label]="'admin.reports.exportCsv' | translate"
        severity="secondary"
        outlined
        [disabled]="rows().length === 0"
        (click)="exportCsv()"
      ></button>
      <button
        pButton
        type="button"
        icon="pi pi-file-excel"
        [label]="'admin.reports.exportExcel' | translate"
        [disabled]="rows().length === 0"
        (click)="exportExcel()"
      ></button>
    </div>

    <app-table [columns]="columns()" [rows]="tableRows()" [loading]="loading()" [emptyMessage]="'admin.reports.emptyMessage' | translate"></app-table>
  `
})
export class ReportsComponent {
  private readonly adminService = inject(AdminService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  readonly loading = signal(false);
  readonly search = signal('');
  readonly month = signal(new Date().getMonth() + 1);
  readonly year = signal(new Date().getFullYear());
  readonly rows = signal<MonthlyReportRow[]>([]);

  readonly columns = computed<AppTableColumn[]>(() => {
    this.translateService.currentLang();
    return [
      { field: 'employeeName', header: this.translateService.instant('admin.reports.table.employee') },
      { field: 'email', header: this.translateService.instant('admin.reports.table.email') },
      { field: 'department', header: this.translateService.instant('admin.reports.table.department') },
      { field: 'month', header: this.translateService.instant('admin.reports.table.month') },
      { field: 'totalVotes', header: this.translateService.instant('admin.reports.table.totalVotes'), type: 'number' },
      { field: 'favoriteMeal', header: this.translateService.instant('admin.reports.table.favoriteMeal') }
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
      this.toastService.error(
        this.translateService.instant('admin.reports.toast.unavailableTitle'),
        this.translateService.instant('admin.reports.toast.unavailableBody')
      );
    } finally {
      this.loading.set(false);
    }
  }
}
