import { Component, input } from '@angular/core';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'app-page-header',
  imports: [TagModule],
  template: `
    <div class="flex flex-column gap-2 md:flex-row md:align-items-end md:justify-content-between mb-4">
      <div>
        <span class="text-sm text-500">{{ eyebrow() }}</span>
        <h1 class="m-0 text-3xl">{{ title() }}</h1>
        <p class="mt-2 mb-0 text-600">{{ subtitle() }}</p>
      </div>

      @if (badge()) {
        <p-tag [value]="badge()" severity="success"></p-tag>
      }
    </div>
  `
})
export class PageHeaderComponent {
  readonly eyebrow = input('Overview');
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly badge = input('');
}
