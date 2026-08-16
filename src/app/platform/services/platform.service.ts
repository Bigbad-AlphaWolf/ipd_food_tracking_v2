import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { exportMonthlyReportCsv, exportMonthlyReportExcel } from '../../core/utils/monthly-report-export.util';
import { resolveEdgeFunctionError } from '../../core/utils/edge-function-error.util';
import {
  AppRole,
  CreateUserPayload,
  DailySurvey,
  MonthlyReportRow,
  Organization,
  PlatformSurveyUpsertPayload,
  Profile
} from '../../core/models/app.models';

interface ProfileRow extends Profile {
  organization_members?: { organization: Organization | null }[] | null;
}

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
    // Filtering by an embedded resource's column requires an inner join hint
    // (`!inner`), otherwise PostgREST still returns parents with no matching
    // children instead of excluding them.
    const membersSelect = organizationId ? 'organization_members!inner(organization:organizations(id, name, code))' : 'organization_members(organization:organizations(id, name, code))';

    let query = this.supabase.from('profiles').select(`*, ${membersSelect}`).order('full_name');

    if (search.trim()) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,department.ilike.%${search}%`);
    }

    if (organizationId) {
      query = query.eq('organization_members.organization_id', organizationId);
    }

    const { data, error } = await query.returns<ProfileRow[]>();

    if (error) {
      throw error;
    }

    return (data ?? []).map(({ organization_members, ...profile }) => ({
      ...profile,
      organizations: (organization_members ?? []).map((member) => member.organization).filter((org): org is Organization => !!org)
    }));
  }

  /**
   * Provisions a brand-new user with a temporary password via the
   * admin-create-user edge function (needs the service-role key, so it can't
   * be done from the client directly). The new user must change their
   * password on first login (see must_change_password).
   */
  async createUser(payload: CreateUserPayload): Promise<{ id: string }> {
    const { data, error } = await this.supabase.functions.invoke<{ id: string }>('admin-create-user', {
      body: payload
    });

    if (error) {
      throw await resolveEdgeFunctionError(error);
    }

    return { id: data!.id };
  }

  async updateUser(id: string, payload: { roles: AppRole[]; organizationIds: string[]; isActive: boolean }): Promise<void> {
    const nextRoles = payload.roles.length > 0 ? payload.roles : ['employee'];
    const isPlatformAdmin = nextRoles.includes('platform_administrator');
    const primaryRole: AppRole = isPlatformAdmin || nextRoles.includes('admin') ? 'admin' : 'employee';
    const nextOrganizationIds = isPlatformAdmin ? [] : payload.organizationIds;

    const { error: deleteError } = await this.supabase.from('organization_members').delete().eq('profile_id', id);

    if (deleteError) {
      throw deleteError;
    }

    if (nextOrganizationIds.length > 0) {
      const { error: insertError } = await this.supabase
        .from('organization_members')
        .insert(nextOrganizationIds.map((organizationId) => ({ profile_id: id, organization_id: organizationId })));

      if (insertError) {
        throw insertError;
      }
    }

    const { data: currentProfile, error: profileError } = await this.supabase
      .from('profiles')
      .select('active_organization_id')
      .eq('id', id)
      .single<{ active_organization_id: string | null }>();

    if (profileError) {
      throw profileError;
    }

    // Keep the current active organization if it's still one of the user's
    // memberships, otherwise fall back to the first remaining membership.
    const activeOrganizationId = isPlatformAdmin
      ? null
      : (currentProfile.active_organization_id && nextOrganizationIds.includes(currentProfile.active_organization_id)
          ? currentProfile.active_organization_id
          : (nextOrganizationIds[0] ?? null));

    const { error } = await this.supabase
      .from('profiles')
      .update({
        role: primaryRole,
        roles: nextRoles,
        active_organization_id: activeOrganizationId,
        is_active: payload.isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async getSurveys(organizationId: string | null = null): Promise<DailySurvey[]> {
    let query = this.supabase
      .from('daily_surveys')
      .select('*, organization:organizations(id, name, code), survey_meals(*, meal:meals(*))')
      .order('survey_date', { ascending: false });

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query.returns<DailySurvey[]>();

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async saveSurvey(payload: PlatformSurveyUpsertPayload): Promise<void> {
    const {
      data: { user },
      error: userError
    } = await this.supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      throw new Error('You must be authenticated to create or update surveys.');
    }

    const surveyData = {
      id: payload.id,
      survey_date: payload.survey_date,
      status: payload.status,
      created_by: user.id,
      organization_id: payload.organizationId,
      voting_starts_at: payload.voting_starts_at,
      voting_ends_at: payload.voting_ends_at
    };

    const { data, error } = await this.supabase.from('daily_surveys').upsert(surveyData).select('id').single<{ id: string }>();

    if (error) {
      throw error;
    }

    const surveyId = data.id;

    const { error: deleteError } = await this.supabase.from('survey_meals').delete().eq('survey_id', surveyId);

    if (deleteError) {
      throw deleteError;
    }

    if (payload.mealIds.length > 0) {
      const { error: insertError } = await this.supabase.from('survey_meals').insert(
        payload.mealIds.map((mealId) => ({ survey_id: surveyId, meal_id: mealId }))
      );

      if (insertError) {
        throw insertError;
      }
    }
  }

  async deleteSurvey(id: string): Promise<void> {
    const { error: mappingError } = await this.supabase.from('survey_meals').delete().eq('survey_id', id);

    if (mappingError) {
      throw mappingError;
    }

    const { error } = await this.supabase.from('daily_surveys').delete().eq('id', id);

    if (error) {
      throw error;
    }
  }

  async getMonthlyReport(month: number, year: number, search = '', organizationId: string | null = null): Promise<MonthlyReportRow[]> {
    const { data, error } = await this.supabase.rpc('get_monthly_report', {
      report_month: month,
      report_year: year,
      employee_search: search || null,
      organization_id_filter: organizationId
    });

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  exportCsv(rows: MonthlyReportRow[], filename: string): void {
    exportMonthlyReportCsv(rows, filename);
  }

  exportExcel(rows: MonthlyReportRow[], filename: string): void {
    exportMonthlyReportExcel(rows, filename);
  }
}
