import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { AppTableColumn } from '../../core/models/app.models';

@Component({
  selector: 'app-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, NgClass, TranslatePipe, TableModule, TagModule, SkeletonModule],
  template: `
    <p-table
      [value]="rows()"
      [loading]="loading()"
      [paginator]="rows().length > 10"
      [rows]="10"
      [dataKey]="dataKey()"
      responsiveLayout="scroll"
      styleClass="p-datatable-sm"
    >
      <ng-template pTemplate="header">
        <tr>
          @for (column of columns(); track column.field) {
            <th>{{ column.header }}</th>
          }
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-row>
        <tr>
          @for (column of columns(); track column.field) {
            <td>
              @switch (column.type || 'text') {
                @case ('date') {
                  {{ dateValue(row, column.field) | date: 'mediumDate' }}
                }
                @case ('datetime') {
                  {{ dateValue(row, column.field) | date: 'medium' }}
                }
                @case ('boolean') {
                  <span [ngClass]="valueOf(row, column.field) ? 'text-green-500' : 'text-500'">
                    {{ (valueOf(row, column.field) ? 'common.status.yes' : 'common.status.no') | translate }}
                  </span>
                }
                @case ('tag') {
                  <p-tag [value]="stringValue(row, column.field)" [severity]="tagSeverity(stringValue(row, column.field))"></p-tag>
                }
                @case ('number') {
                  {{ valueOf(row, column.field) }}
                }
                @default {
                  {{ valueOf(row, column.field) }}
                }
              }
            </td>
          }
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr>
          <td [attr.colspan]="columns().length" class="text-center py-6 text-500">
            {{ emptyMessage() ?? ('common.table.emptyDefault' | translate) }}
          </td>
        </tr>
      </ng-template>
    </p-table>
  `
})
export class AppTableComponent {
  readonly columns = input.required<AppTableColumn[]>();
  readonly rows = input<unknown[]>([]);
  readonly loading = input(false);
  readonly dataKey = input('id');
  readonly emptyMessage = input<string | null>(null);

  valueOf(row: unknown, field: string): unknown {
    return this.recordOf(row)[field];
  }

  dateValue(row: unknown, field: string): string | number | Date | null | undefined {
    const value = this.recordOf(row)[field];
    return typeof value === 'string' || typeof value === 'number' || value instanceof Date || value == null
      ? value
      : undefined;
  }

  stringValue(row: unknown, field: string): string {
    const value = this.recordOf(row)[field];
    return typeof value === 'string' ? value : String(value ?? '');
  }

  private recordOf(row: unknown): Record<string, unknown> {
    return typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : {};
  }

  tagSeverity(value: string): 'success' | 'warn' | 'danger' | 'info' | 'secondary' | 'contrast' {
    switch (value) {
      case 'open':
      case 'active':
      case 'admin':
        return 'success';
      case 'closed':
      case 'inactive':
        return 'danger';
      case 'draft':
        return 'warn';
      default:
        return 'info';
    }
  }
}
