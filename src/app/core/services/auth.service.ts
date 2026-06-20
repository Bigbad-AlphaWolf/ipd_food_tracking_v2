import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session, User } from '@supabase/supabase-js';
import { TranslateService } from '@ngx-translate/core';
import { SupabaseService } from './supabase.service';
import { LoadingService } from './loading.service';
import { ToastService } from './toast.service';
import { AppRole, Profile } from '../models/app.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly loadingService = inject(LoadingService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);

  private readonly sessionState = signal<Session | null>(null);
  private readonly profileState = signal<Profile | null>(null);
  private readonly initializedState = signal(false);
  private readonly bootstrapPromise: Promise<void>;

  readonly session = computed(() => this.sessionState());
  readonly profile = computed(() => this.profileState());
  readonly isAuthenticated = computed(() => !!this.sessionState()?.user);
  readonly roles = computed<AppRole[]>(() => this.resolveRoles(this.profileState()));
  readonly role = computed<AppRole | null>(() => {
    const roles = this.roles();

    if (roles.includes('admin')) {
      return 'admin';
    }

    return roles[0] ?? null;
  });
  readonly initialized = computed(() => this.initializedState());

  constructor() {
    this.bootstrapPromise = this.bootstrap();
  }

  ready(): Promise<void> {
    return this.bootstrapPromise;
  }

  async registerEmployee(payload: {
    fullName: string;
    email: string;
    password: string;
    phoneNumber?: string;
    department?: string;
  }): Promise<void> {
    this.loadingService.start();
    try {
      const normalizedEmail = payload.email.trim().toLowerCase();
      const { data, error } = await this.supabase.auth.signUp({
        email: normalizedEmail,
        password: payload.password,
        options: {
          data: {
            full_name: payload.fullName.trim(),
            phone_number: payload.phoneNumber?.trim() || null,
            department: payload.department?.trim() || null,
            role: 'employee',
            roles: ['employee']
          }
        }
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        await this.supabase.auth.signOut();
        this.sessionState.set(null);
        this.profileState.set(null);
      }

      await this.router.navigateByUrl('/login');
      this.toastService.success(
        this.translateService.instant('auth.toast.registrationTitle'),
        this.translateService.instant('auth.toast.registrationBody')
      );
    } finally {
      this.loadingService.stop();
    }
  }

  async signIn(identifier: string, password: string): Promise<void> {
    const email = await this.resolveIdentifier(identifier);

    this.loadingService.start();
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      this.sessionState.set(data.session);
      await this.loadProfile(data.user);
      await this.router.navigateByUrl(this.role() === 'admin' ? '/admin/dashboard' : '/employee/dashboard');
      this.toastService.success(
        this.translateService.instant('auth.toast.welcomeTitle'),
        this.translateService.instant('auth.toast.welcomeBody')
      );
    } finally {
      this.loadingService.stop();
    }
  }

  async signOut(): Promise<void> {
    this.loadingService.start();
    try {
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        throw error;
      }

      this.sessionState.set(null);
      this.profileState.set(null);
      await this.router.navigateByUrl('/login');
    } finally {
      this.loadingService.stop();
    }
  }

  private async bootstrap(): Promise<void> {
    try {
      const { data } = await this.supabase.auth.getSession();
      this.sessionState.set(data.session);

      if (data.session?.user) {
        await this.loadProfile(data.session.user);
      }

      this.supabase.auth.onAuthStateChange(async (_event, session) => {
        this.sessionState.set(session);

        if (session?.user) {
          await this.loadProfile(session.user);
        } else {
          this.profileState.set(null);
        }
      });
    } finally {
      this.initializedState.set(true);
    }
  }

  private async loadProfile(user: User | null): Promise<void> {
    if (!user) {
      this.profileState.set(null);
      return;
    }

    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single<Profile>();

    if (error) {
      throw error;
    }

    this.profileState.set({
      ...data,
      roles: this.resolveRoles(data)
    });
  }

  hasRole(role: AppRole): boolean {
    return this.roles().includes(role);
  }

  hasAnyRole(roles: AppRole[]): boolean {
    return roles.some((role) => this.hasRole(role));
  }

  private resolveRoles(profile: Profile | null): AppRole[] {
    if (!profile) {
      return [];
    }

    const fromArray = Array.isArray(profile.roles) ? profile.roles : [];
    const fromLegacyRole = profile.role ? [profile.role] : [];
    const merged = [...new Set([...fromArray, ...fromLegacyRole])].filter(
      (role): role is AppRole => role === 'admin' || role === 'employee'
    );

    return merged.length > 0 ? merged : ['employee'];
  }

  private async resolveIdentifier(identifier: string): Promise<string> {
    if (identifier.includes('@')) {
      return identifier.trim().toLowerCase();
    }

    const { data, error } = await this.supabase
      .rpc('resolve_auth_identifier', { input_identifier: identifier.trim() })
      .single<string>();

    if (error || !data) {
      throw error ?? new Error('No active account found for the supplied phone number.');
    }

    return data;
  }
}
