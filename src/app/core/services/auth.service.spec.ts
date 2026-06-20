import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { LoadingService } from './loading.service';
import { ToastService } from './toast.service';

describe('AuthService', () => {
  const profile = {
    id: 'user-1',
    full_name: 'Employee One',
    email: 'employee@example.com',
    phone_number: '5551000',
    department: 'Operations',
    role: 'employee' as const,
    roles: ['employee'] as const,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  function createProfilesQuery() {
    return {
      select: jasmine.createSpy().and.returnValue({
        eq: jasmine.createSpy().and.returnValue({
          single: jasmine.createSpy().and.resolveTo({ data: profile, error: null })
        })
      })
    };
  }

  it('resolves phone identifiers before signing in', async () => {
    const profilesQuery = createProfilesQuery();
    const client = {
      auth: {
        getSession: jasmine.createSpy().and.resolveTo({ data: { session: null } }),
        onAuthStateChange: jasmine.createSpy(),
        signInWithPassword: jasmine.createSpy().and.resolveTo({
          data: { session: { user: { id: 'user-1' } }, user: { id: 'user-1' } },
          error: null
        }),
        signOut: jasmine.createSpy().and.resolveTo({ error: null })
      },
      from: jasmine.createSpy().and.callFake((table: string) => {
        if (table === 'profiles') {
          return profilesQuery;
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc: jasmine.createSpy().and.returnValue({
        single: jasmine.createSpy().and.resolveTo({ data: 'employee@example.com', error: null })
      })
    };

    const router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl', 'createUrlTree']);
    router.navigateByUrl.and.resolveTo(true);
    const translateService = jasmine.createSpyObj<TranslateService>('TranslateService', ['instant']);
    translateService.instant.and.callFake((key: string) => key);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AuthService,
        LoadingService,
        { provide: TranslateService, useValue: translateService },
        { provide: SupabaseService, useValue: { client } },
        { provide: ToastService, useValue: jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']) },
        { provide: Router, useValue: router }
      ]
    });

    const service = TestBed.inject(AuthService);
    await service.ready();
    await service.signIn('5551000', 'secret123');

    expect(client.rpc).toHaveBeenCalledWith('resolve_auth_identifier', { input_identifier: '5551000' });
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'employee@example.com', password: 'secret123' });
    expect(service.role()).toBe('employee');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/employee/dashboard');
  });
});
