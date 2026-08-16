import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectOption } from '../../core/models/app.models';

@Component({
  selector: 'app-search-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe, ButtonModule, InputTextModule, SelectModule],
  template: `
    <div class="app-surface p-3 mb-4">
      <div class="grid align-items-end">
        <div class="col-12 md:col-5">
          <span class="p-input-icon-left w-full">
            <i class="pi pi-search"></i>
            <input
              pInputText
              class="w-full"
              [ngModel]="search()"
              (ngModelChange)="searchChange.emit($event)"
              [placeholder]="searchPlaceholder()"
            />
          </span>
        </div>

        @if (showMonth()) {
          <div class="col-6 md:col-3">
            <p-select
              [options]="monthOptions()"
              optionLabel="label"
              optionValue="value"
              appendTo="body"
              [ngModel]="month()"
              (ngModelChange)="monthChange.emit($event)"
              [placeholder]="'common.filters.month' | translate"
              class="w-full"
            ></p-select>
          </div>
        }

        @if (showYear()) {
          <div class="col-6 md:col-2">
            <p-select
              [options]="yearOptions()"
              optionLabel="label"
              optionValue="value"
              appendTo="body"
              [ngModel]="year()"
              (ngModelChange)="yearChange.emit($event)"
              [placeholder]="'common.filters.year' | translate"
              class="w-full"
            ></p-select>
          </div>
        }

        <div class="col-12 md:col-2 flex md:justify-content-end">
          <button pButton type="button" [label]="'common.actions.clear' | translate" severity="secondary" outlined (click)="clear.emit()"></button>
        </div>
      </div>
    </div>
  `
})
export class SearchToolbarComponent {
  readonly searchPlaceholder = input('Search');
  readonly search = input('');
  readonly showMonth = input(false);
  readonly showYear = input(false);
  readonly month = input<number | null>(null);
  readonly year = input<number | null>(null);
  readonly monthOptions = input<SelectOption<number>[]>([]);
  readonly yearOptions = input<SelectOption<number>[]>([]);

  readonly searchChange = output<string>();
  readonly monthChange = output<number | null>();
  readonly yearChange = output<number | null>();
  readonly clear = output<void>();
}
