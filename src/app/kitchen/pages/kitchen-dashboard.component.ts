import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DatePickerModule } from 'primeng/datepicker';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { KitchenService } from '../services/kitchen.service';
import { ToastService } from '../../core/services/toast.service';
import { MealVoteCount } from '../../core/models/app.models';

@Component({
  selector: 'app-kitchen-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe, DatePickerModule, TableModule, TagModule, PageHeaderComponent, EmptyStateComponent],
  template: `
    <app-page-header
      [eyebrow]="'kitchen.eyebrow' | translate"
      [title]="'kitchen.dashboard.title' | translate"
      [subtitle]="'kitchen.dashboard.subtitle' | translate"
    ></app-page-header>

    <div class="app-surface p-3 mb-4">
      <div class="grid align-items-end">
        <div class="col-12 md:col-6 flex flex-column gap-2">
          <label for="report-date">{{ 'kitchen.dashboard.dateLabel' | translate }}</label>
          <p-datepicker
            inputId="report-date"
            [ngModel]="reportDate()"
            (ngModelChange)="setReportDate($event)"
            [showIcon]="true"
            appendTo="body"
          ></p-datepicker>
        </div>

        @if (surveyStatus(); as status) {
          <div class="col-12 md:col-6 flex md:justify-content-end">
            <p-tag
              [value]="('common.status.' + status) | translate"
              [severity]="status === 'open' ? 'success' : status === 'closed' ? 'danger' : 'warn'"
            ></p-tag>
          </div>
        }
      </div>
    </div>

    @if (!loading() && rows().length === 0) {
      <app-empty-state
        icon="pi pi-calendar-times"
        [title]="'kitchen.dashboard.emptyTitle' | translate"
        [message]="'kitchen.dashboard.emptyMessage' | translate"
      ></app-empty-state>
    } @else {
      <p-table [value]="rows()" [loading]="loading()" dataKey="meal_id" responsiveLayout="scroll" styleClass="p-datatable-sm">
        <ng-template pTemplate="header">
          <tr>
            <th>{{ 'kitchen.dashboard.table.meal' | translate }}</th>
            <th class="text-right">{{ 'kitchen.dashboard.table.count' | translate }}</th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-row>
          <tr>
            <td>{{ row.meal_name }}</td>
            <td class="text-right font-semibold">{{ row.vote_count }}</td>
          </tr>
        </ng-template>

        <ng-template pTemplate="footer">
          <tr>
            <td class="font-bold">{{ 'kitchen.dashboard.table.total' | translate }}</td>
            <td class="text-right font-bold">{{ totalVotes() }}</td>
          </tr>
        </ng-template>
      </p-table>
    }
  `
})
export class KitchenDashboardComponent {
  private readonly kitchenService = inject(KitchenService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  readonly loading = signal(false);
  readonly reportDate = signal(new Date());
  readonly rows = signal<MealVoteCount[]>([]);

  readonly surveyStatus = computed(() => this.rows()[0]?.survey_status ?? null);
  readonly totalVotes = computed(() => this.rows().reduce((sum, row) => sum + row.vote_count, 0));

  constructor() {
    void this.load();
  }

  setReportDate(value: Date | null): void {
    if (!value) {
      return;
    }

    this.reportDate.set(value);
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);

    try {
      const dateParam = this.reportDate().toISOString().slice(0, 10);
      this.rows.set(await this.kitchenService.getMealVoteCounts(dateParam));
    } catch (error) {
      console.error(error);
      this.toastService.error(
        this.translateService.instant('kitchen.dashboard.toast.unavailableTitle'),
        this.translateService.instant('kitchen.dashboard.toast.unavailableBody')
      );
    } finally {
      this.loading.set(false);
    }
  }
}
