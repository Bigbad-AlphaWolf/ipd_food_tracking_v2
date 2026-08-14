import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { AppRole, Organization, Profile } from '../../core/models/app.models';

@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly supabase = inject(SupabaseService).client;

  async getOrganizations(): Promise<Organization[]> {
    const { data, error } = await this.supabase.from('organizations').select('*').order('name');

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async saveOrganization(payload: Partial<Organization>): Promise<void> {
    const { error } = await this.supabase.from('organizations').upsert(payload);

    if (error) {
      throw error;
    }
  }

  async deleteOrganization(id: string): Promise<void> {
    const { error } = await this.supabase.from('organizations').delete().eq('id', id);

    if (error) {
      throw error;
    }
  }

  async getAllUsers(search = '', organizationId: string | null = null): Promise<Profile[]> {
    let query = this.supabase
      .from('profiles')
      .select('*, organization:organizations(id, name, code)')
      .order('full_name');

    if (search.trim()) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,department.ilike.%${search}%`);
    }

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async updateUser(id: string, payload: { roles: AppRole[]; organizationId: string | null; isActive: boolean }): Promise<void> {
    const nextRoles = payload.roles.length > 0 ? payload.roles : ['employee'];
    const isPlatformAdmin = nextRoles.includes('platform_administrator');
    const primaryRole: AppRole = isPlatformAdmin || nextRoles.includes('admin') ? 'admin' : 'employee';

    const { error } = await this.supabase
      .from('profiles')
      .update({
        role: primaryRole,
        roles: nextRoles,
        organization_id: isPlatformAdmin ? null : payload.organizationId,
        is_active: payload.isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }
}
