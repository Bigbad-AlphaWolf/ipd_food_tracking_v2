import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MenubarModule } from 'primeng/menubar';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
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
    MenubarModule,
    DrawerModule,
    ButtonModule,
    AvatarModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    LanguageSwitcherComponent,
    LoadingSpinnerComponent
  ],
  template: `
    <p-toast position="top-right"></p-toast>
    <p-confirmDialog></p-confirmDialog>

    <div class="shell-layout min-h-screen">
      <p-menubar [model]="menuItems()" styleClass="shadow-none border-none shell-menubar">
        <ng-template pTemplate="start">
          <div class="flex align-items-center gap-3">
            <button pButton type="button" icon="pi pi-bars" text rounded class="lg:hidden" (click)="drawerVisible.set(true)"></button>
            <div>
              <div class="text-sm text-500">{{ 'common.appName' | translate }}</div>
              <div class="font-semibold">{{ 'shell.subtitle' | translate }}</div>
            </div>
          </div>
        </ng-template>

        <ng-template pTemplate="end">
          <div class="flex align-items-center gap-2">
            <app-language-switcher></app-language-switcher>
            <button
              pButton
              type="button"
              [icon]="themeService.isDarkMode() ? 'pi pi-sun' : 'pi pi-moon'"
              text
              rounded
              (click)="themeService.toggle()"
            ></button>
            <p-tag [value]="roleLabel()" severity="contrast"></p-tag>
            <p-avatar [label]="initials()" shape="circle"></p-avatar>
            <button pButton type="button" [label]="'common.actions.logout' | translate" text (click)="logout()"></button>
          </div>
        </ng-template>
      </p-menubar>

      <p-drawer [visible]="drawerVisible()" (visibleChange)="drawerVisible.set($event)" [modal]="true" position="left" styleClass="w-18rem">
        <ng-template pTemplate="header">
          <div>
            <div class="font-semibold">{{ 'shell.navigation' | translate }}</div>
            <small class="text-500">{{ authService.profile()?.full_name }}</small>
          </div>
        </ng-template>

        <nav class="flex flex-column gap-2 mt-4">
          @for (item of menuItems(); track item.label) {
            <a
              class="p-3 border-round hover:surface-100 transition-duration-150"
              [routerLink]="item.routerLink"
              routerLinkActive="surface-200"
              (click)="drawerVisible.set(false)"
            >
              <i [class]="item.icon"></i>
              <span class="ml-2">{{ item.label }}</span>
            </a>
          }
        </nav>
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

      .shell-menubar {
        position: sticky;
        top: 0;
        z-index: 1000;
        margin: 0.75rem;
        border-radius: 1rem;
        background: rgba(255, 255, 255, 0.82);
        backdrop-filter: blur(14px);
      }

      :host-context(.app-dark) .shell-menubar {
        background: rgba(15, 23, 40, 0.86);
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
