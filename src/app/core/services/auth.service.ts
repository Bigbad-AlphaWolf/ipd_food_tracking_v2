import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthApiError, Session, User } from '@supabase/supabase-js';
import { TranslateService } from '@ngx-translate/core';
import { SupabaseService } from './supabase.service';
import { LoadingService } from './loading.service';
import { ToastService } from './toast.service';
import { AppRole, Organization, Profile } from '../models/app.models';
import { RegistrationError } from '../utils/registration-error.util';

interface ProfileRow extends Profile {
  organization_members?: { organization: Organization | null }[] | null;
}

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

    if (roles.includes('platform_administrator')) {
      return 'platform_administrator';
    }

    if (roles.includes('admin')) {
      return 'admin';
    }

    return roles[0] ?? null;
  });
  readonly initialized = computed(() => this.initializedState());

  /** All organizations the current user belongs to (admin/employee can belong to several). */
  readonly organizations = computed<Organization[]>(() => this.profileState()?.organizations ?? []);
  /** The organization currently selected — every query/RLS check scopes to this one. */
  readonly activeOrganization = computed<Organization | null>(() => this.profileState()?.active_organization ?? null);

  /** Landing route for the current user, by role precedence: platform admin > org admin > meal coordinator > employee. */
  readonly homeRoute = computed<string>(() => {
    if (this.hasRole('platform_administrator')) {
      return '/platform';
    }

    if (this.hasRole('admin')) {
      return '/admin/dashboard';
    }

    if (this.hasRole('meal_coordinator')) {
      return '/kitchen/dashboard';
    }

    return '/employee/dashboard';
  });

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
    organizationIds: string[];
    phoneNumber?: string;
    department?: string;
  }): Promise<void> {
    this.loadingService.start();
    try {
      const organizationIds = [...new Set(payload.organizationIds.filter(Boolean))];

      if (organizationIds.length === 0) {
        throw new Error('At least one organization is required.');
      }

      const normalizedEmail = payload.email.trim().toLowerCase();
      const normalizedPhone = payload.phoneNumber?.trim() || null;

      if (normalizedPhone) {
        const { data: phoneTaken, error: phoneCheckError } = await this.supabase.rpc('is_phone_number_taken', {
          input_phone: normalizedPhone
        });

        if (phoneCheckError) {
          throw phoneCheckError;
        }

        if (phoneTaken) {
          throw new RegistrationError('phone_taken');
        }
      }

      const { data, error } = await this.supabase.auth.signUp({
        email: normalizedEmail,
        password: payload.password,
        options: {
          data: {
            full_name: payload.fullName.trim(),
            phone_number: normalizedPhone,
            department: payload.department?.trim() || null,
            role: 'employee',
            roles: ['employee'],
            organization_ids: organizationIds
          }
        }
      });

      if (error) {
        throw this.mapRegistrationError(error);
      }

      // When email confirmation is on, Supabase silently returns a fake user with
      // no identities for an already-registered, already-confirmed email instead
      // of an error, to avoid leaking which emails exist.
      if (data.user && data.user.identities?.length === 0) {
        throw new RegistrationError('email_taken');
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
      await this.router.navigateByUrl(this.homeRoute());
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
      .select('*, active_organization:organizations!active_organization_id(*), organization_members(organization:organizations(*))')
      .eq('id', user.id)
      .single<ProfileRow>();

    if (error) {
      throw error;
    }

    const { organization_members, ...profile } = data;

    this.profileState.set({
      ...profile,
      roles: this.resolveRoles(profile),
      organizations: (organization_members ?? []).map((member) => member.organization).filter((org): org is Organization => !!org)
    });
  }

  /**
   * Sets a new password for the signed-in user and clears must_change_password.
   * Used the first time an admin-provisioned account (created with a
   * temporary password) logs in.
   */
  async completeForcedPasswordChange(newPassword: string): Promise<void> {
    const profile = this.profileState();

    if (!profile) {
      throw new Error('You must be signed in to change your password.');
    }

    this.loadingService.start();
    try {
      const { error: passwordError } = await this.supabase.auth.updateUser({ password: newPassword });

      if (passwordError) {
        throw passwordError;
      }

      const { error: profileError } = await this.supabase
        .from('profiles')
        .update({ must_change_password: false, updated_at: new Date().toISOString() })
        .eq('id', profile.id);

      if (profileError) {
        throw profileError;
      }

      this.profileState.set({ ...profile, must_change_password: false });
    } finally {
      this.loadingService.stop();
    }
  }

  /** Switches the active organization and reloads so every page refetches under the new scope. */
  async switchOrganization(organizationId: string): Promise<void> {
    this.loadingService.start();
    try {
      const { error } = await this.supabase.rpc('switch_active_organization', { target_organization_id: organizationId });

      if (error) {
        throw error;
      }

      globalThis.location?.reload();
    } finally {
      this.loadingService.stop();
    }
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
      (role): role is AppRole =>
        role === 'admin' || role === 'employee' || role === 'platform_administrator' || role === 'meal_coordinator'
    );

    return merged.length > 0 ? merged : ['employee'];
  }

  /** Public organization list for the unauthenticated self-registration page's dropdown. */
  async getRegistrableOrganizations(): Promise<Pick<Organization, 'id' | 'name' | 'code'>[]> {
    const { data, error } = await this.supabase.rpc('list_active_organizations');

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * GoTrue's own duplicate-email error for signUp() — when it does surface one
   * instead of the identities-less-user response handled above.
   */
  private mapRegistrationError(error: unknown): Error {
    if (error instanceof AuthApiError && (error.code === 'user_already_exists' || error.message.toLowerCase().includes('already registered'))) {
      return new RegistrationError('email_taken');
    }

    // Defensive fallback for the (rare) race where the phone number check above
    // passes but a concurrent signup wins first: handle_new_user's insert into
    // profiles then fails the profiles_phone_number_key unique constraint,
    // which rolls back the whole signUp() transaction with a generic error.
    if (error instanceof Error && error.message.includes('profiles_phone_number_key')) {
      return new RegistrationError('phone_taken');
    }

    return error instanceof Error ? error : new Error('Registration failed.');
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
