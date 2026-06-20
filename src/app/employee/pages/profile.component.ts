import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../../core/services/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardModule, TagModule, PageHeaderComponent],
  template: `
    <app-page-header
      eyebrow="Account"
      title="Profile"
      subtitle="Your profile metadata comes from the Supabase profiles table."
    ></app-page-header>

    <p-card>
      <div class="flex flex-column gap-3">
        <div>
          <small class="text-500">Full name</small>
          <div class="font-semibold">{{ authService.profile()?.full_name || 'Not available' }}</div>
        </div>
        <div>
          <small class="text-500">Email</small>
          <div>{{ authService.profile()?.email || 'Not available' }}</div>
        </div>
        <div class="flex align-items-center justify-content-between gap-2 flex-wrap">
          <div>
            <small class="text-500">Department</small>
            <div>{{ authService.profile()?.department || 'Not assigned' }}</div>
          </div>
          <p-tag [value]="authService.roles().join(', ') || 'employee'" severity="info"></p-tag>
        </div>
      </div>
    </p-card>
  `
})
export class ProfileComponent {
  readonly authService = inject(AuthService);
}
