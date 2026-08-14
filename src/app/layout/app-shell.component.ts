import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MenuItem } from 'primeng/api';
import { AuthService } from '../core/services/auth.service';
import { ThemeService } from '../core/services/theme.service';
import { LoadingService } from '../core/services/loading.service';
import { LoadingSpinnerComponent } from '../shared/components/loading-spinner.component';
import { LanguageSwitcherComponent } from '../shared/components/language-switcher.component';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
    DrawerModule,
    ButtonModule,
    AvatarModule,
    TagModule,
    DividerModule,
    ToastModule,
    ConfirmDialogModule,
    LanguageSwitcherComponent,
    LoadingSpinnerComponent
  ],
  template: `
    <p-toast position="top-right"></p-toast>
    <p-confirmDialog></p-confirmDialog>

    <div class="shell-layout min-h-screen">
      <header class="app-topbar">
        <div class="app-topbar-inner">
          <div class="app-topbar-left">
            <button
              pButton
              type="button"
              icon="pi pi-bars"
              text
              rounded
              class="icon-btn lg:hidden"
              [attr.aria-label]="'shell.navigation' | translate"
              (click)="drawerVisible.set(true)"
            ></button>

            <a routerLink="/" class="app-brand">
              <span class="app-brand-mark"><i class="pi pi-apple"></i></span>
              <span class="app-brand-text hidden sm:flex">
                <span class="app-brand-name">{{ 'common.appName' | translate }}</span>
                <span class="app-brand-subtitle">{{ 'shell.subtitle' | translate }}</span>
              </span>
            </a>

            <nav class="app-topbar-nav hidden lg:flex" [attr.aria-label]="'shell.navigation' | translate">
              @for (item of menuItems(); track item.label) {
                <a class="app-nav-link" [routerLink]="item.routerLink" routerLinkActive="active">
                  <i [class]="item.icon"></i>
                  <span>{{ item.label }}</span>
                </a>
              }
            </nav>
          </div>

          <div class="app-topbar-right">
            <div class="hidden md:flex align-items-center gap-2">
              <app-language-switcher></app-language-switcher>
              <p-tag [value]="roleLabel()" severity="contrast"></p-tag>
            </div>

            <button
              pButton
              type="button"
              [icon]="themeService.isDarkMode() ? 'pi pi-sun' : 'pi pi-moon'"
              text
              rounded
              class="icon-btn"
              [attr.aria-label]="'shell.toggleTheme' | translate"
              (click)="themeService.toggle()"
            ></button>

            <a routerLink="/employee/profile" class="app-avatar-link" [attr.aria-label]="'shell.menu.profile' | translate">
              <p-avatar [label]="initials()" shape="circle" size="large"></p-avatar>
            </a>

            <button
              pButton
              type="button"
              [label]="'common.actions.logout' | translate"
              icon="pi pi-sign-out"
              text
              class="hidden lg:inline-flex"
              (click)="logout()"
            ></button>
          </div>
        </div>
      </header>

      <p-drawer [visible]="drawerVisible()" (visibleChange)="drawerVisible.set($event)" [modal]="true" position="left" styleClass="w-18rem">
        <ng-template pTemplate="header">
          <div class="flex align-items-center gap-2">
            <span class="app-brand-mark"><i class="pi pi-apple"></i></span>
            <div>
              <div class="font-semibold">{{ 'common.appName' | translate }}</div>
              <small class="text-500">{{ authService.profile()?.full_name }}</small>
            </div>
          </div>
        </ng-template>

        <nav class="flex flex-column gap-1 mt-3" [attr.aria-label]="'shell.navigation' | translate">
          @for (item of menuItems(); track item.label) {
            <a
              class="app-nav-link app-nav-link-block"
              [routerLink]="item.routerLink"
              routerLinkActive="active"
              (click)="drawerVisible.set(false)"
            >
              <i [class]="item.icon"></i>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>

        <p-divider></p-divider>

        <div class="flex flex-column gap-3">
          <div class="flex align-items-center justify-content-between">
            <span class="text-sm text-500">{{ 'employee.profile.eyebrow' | translate }}</span>
            <p-tag [value]="roleLabel()" severity="contrast"></p-tag>
          </div>

          <div class="flex align-items-center justify-content-between">
            <app-language-switcher></app-language-switcher>
            <button
              pButton
              type="button"
              [icon]="themeService.isDarkMode() ? 'pi pi-sun' : 'pi pi-moon'"
              text
              rounded
              class="icon-btn"
              [attr.aria-label]="'shell.toggleTheme' | translate"
              (click)="themeService.toggle()"
            ></button>
          </div>

          <button
            pButton
            type="button"
            [label]="'common.actions.logout' | translate"
            icon="pi pi-sign-out"
            severity="secondary"
            outlined
            (click)="logout()"
          ></button>
        </div>
      </p-drawer>

      <main class="app-page">
        <router-outlet></router-outlet>
      </main>

      @if (loadingService.isLoading()) {
        <app-loading-spinner [overlay]="true"></app-loading-spinner>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .shell-layout {
        padding-bottom: 2rem;
      }

      .icon-btn {
        width: 2.75rem;
        height: 2.75rem;
      }

      .app-topbar {
        position: sticky;
        top: 0;
        z-index: 1000;
        background: rgba(255, 255, 255, 0.86);
        backdrop-filter: blur(14px);
        border-bottom: 1px solid rgba(23, 32, 51, 0.06);
      }

      :host-context(.app-dark) .app-topbar {
        background: rgba(15, 23, 40, 0.88);
        border-bottom-color: rgba(255, 255, 255, 0.06);
      }

      @media (min-width: 768px) {
        .app-topbar {
          margin: 0.75rem;
          border-radius: 1.25rem;
          border-bottom: none;
          box-shadow: 0 12px 30px rgba(15, 23, 40, 0.06);
        }
      }

      .app-topbar-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
      }

      @media (min-width: 768px) {
        .app-topbar-inner {
          padding: 0.75rem 1.25rem;
        }
      }

      .app-topbar-left,
      .app-topbar-right {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
      }

      .app-brand {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        min-width: 0;
      }

      .app-brand-mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 0.75rem;
        background: linear-gradient(135deg, var(--p-primary-color), #fb923c);
        color: #ffffff;
        font-size: 1.05rem;
        flex-shrink: 0;
      }

      .app-brand-text {
        flex-direction: column;
        line-height: 1.15;
        overflow: hidden;
      }

      .app-brand-name {
        font-weight: 700;
        font-size: 0.95rem;
        white-space: nowrap;
      }

      .app-brand-subtitle {
        font-size: 0.7rem;
        color: var(--p-text-muted-color);
        white-space: nowrap;
      }

      .app-topbar-nav {
        align-items: center;
        gap: 0.25rem;
        margin-left: 1rem;
      }

      .app-nav-link {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.875rem;
        border-radius: 0.75rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--p-text-muted-color);
        transition:
          background-color 150ms ease,
          color 150ms ease;
      }

      .app-nav-link:hover {
        background: var(--p-surface-100);
        color: var(--p-text-color);
      }

      .app-nav-link.active {
        background: var(--p-primary-50);
        color: var(--p-primary-700);
      }

      :host-context(.app-dark) .app-nav-link:hover {
        background: rgba(255, 255, 255, 0.06);
      }

      :host-context(.app-dark) .app-nav-link.active {
        background: rgba(251, 146, 60, 0.16);
        color: var(--p-primary-300);
      }

      .app-nav-link-block {
        min-height: 2.75rem;
      }

      .app-avatar-link {
        display: inline-flex;
        border-radius: 50%;
      }
    `
  ]
})
export class AppShellComponent {
  readonly authService = inject(AuthService);
  private readonly translateService = inject(TranslateService);
  readonly themeService = inject(ThemeService);
  readonly loadingService = inject(LoadingService);
  readonly drawerVisible = signal(false);

  readonly initials = computed(() => {
    const name = this.authService.profile()?.full_name ?? 'Food Tracker';
    return name
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  });

  readonly roleLabel = computed(() => {
    this.translateService.currentLang();
    const roles = this.authService.roles();

    if (roles.length === 0) {
      return this.translateService.instant('common.user');
    }

    return roles.map((role) => this.translateService.instant(`roles.${role}`)).join(', ');
  });

  readonly menuItems = computed<MenuItem[]>(() => {
    this.translateService.currentLang();
    const hasAdminRole = this.authService.hasRole('admin');
    const common: MenuItem[] = [
      { label: this.translateService.instant('shell.menu.profile'), icon: 'pi pi-user', routerLink: '/employee/profile' }
    ];

    if (hasAdminRole) {
      return [
        { label: this.translateService.instant('shell.menu.dashboard'), icon: 'pi pi-chart-bar', routerLink: '/admin/dashboard' },
        { label: this.translateService.instant('shell.menu.meals'), icon: 'pi pi-apple', routerLink: '/admin/meals' },
        { label: this.translateService.instant('shell.menu.surveys'), icon: 'pi pi-calendar', routerLink: '/admin/surveys' },
        { label: this.translateService.instant('shell.menu.users'), icon: 'pi pi-users', routerLink: '/admin/users' },
        { label: this.translateService.instant('shell.menu.reports'), icon: 'pi pi-file-export', routerLink: '/admin/reports' },
        ...common
      ];
    }

    return [
      { label: this.translateService.instant('shell.menu.dashboard'), icon: 'pi pi-home', routerLink: '/employee/dashboard' },
      { label: this.translateService.instant('shell.menu.todaySurvey'), icon: 'pi pi-megaphone', routerLink: '/employee/today-survey' },
      { label: this.translateService.instant('shell.menu.history'), icon: 'pi pi-history', routerLink: '/employee/history' },
      ...common
    ];
  });

  async logout(): Promise<void> {
    await this.authService.signOut();
  }
}
