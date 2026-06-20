import { Injectable, inject } from '@angular/core';
import * as XLSX from 'xlsx';
import { SupabaseService } from '../../core/services/supabase.service';
import {
  AdminDashboardMetrics,
  DailySurvey,
  Meal,
  MonthlyReportRow,
  Profile,
  SurveyUpsertPayload,
  TrendPoint
} from '../../core/models/app.models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly supabase = inject(SupabaseService).client;

  async getMeals(): Promise<Meal[]> {
    const { data, error } = await this.supabase.from('meals').select('*').order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async saveMeal(payload: Partial<Meal>): Promise<void> {
    const { error } = await this.supabase.from('meals').upsert(payload);

    if (error) {
      throw error;
    }
  }

  async deleteMeal(id: string): Promise<void> {
    const { error } = await this.supabase.from('meals').delete().eq('id', id);

    if (error) {
      throw error;
    }
  }

  async getSurveys(): Promise<DailySurvey[]> {
    const { data, error } = await this.supabase
      .from('daily_surveys')
      .select('*, survey_meals(*, meal:meals(*))')
      .order('survey_date', { ascending: false });

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async saveSurvey(payload: SurveyUpsertPayload): Promise<void> {
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
      created_by: user.id
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

  async getUsers(search = ''): Promise<Profile[]> {
    let query = this.supabase.from('profiles').select('*').order('full_name');

    if (search.trim()) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,department.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async updateUserRoles(id: string, roles: Profile['roles'], isActive: boolean): Promise<void> {
    const nextRoles = Array.isArray(roles) && roles.length > 0 ? roles : ['employee'];
    const primaryRole: Profile['role'] = nextRoles.includes('admin') ? 'admin' : 'employee';

    const { error } = await this.supabase
      .from('profiles')
      .update({
        role: primaryRole,
        roles: nextRoles,
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async getDashboardMetrics(): Promise<{ metrics: AdminDashboardMetrics; trend: TrendPoint[] }> {
    const { data, error } = await this.supabase.rpc('get_admin_dashboard_metrics');

    if (error) {
      throw error;
    }

    const payload = (data ?? {}) as { metrics?: AdminDashboardMetrics; trend?: TrendPoint[] };

    return {
      metrics: payload.metrics ?? {
        participationRate: 0,
        totalMealsThisMonth: 0,
        mostPopularMeal: 'No data',
        votesToday: 0,
        eligibleEmployees: 0
      },
      trend: payload.trend ?? []
    };
  }

  async getMonthlyReport(month: number, year: number, search = ''): Promise<MonthlyReportRow[]> {
    const { data, error } = await this.supabase.rpc('get_monthly_report', {
      report_month: month,
      report_year: year,
      employee_search: search || null
    });

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  exportCsv(rows: MonthlyReportRow[], filename: string): void {
    const headers = ['Employee', 'Email', 'Department', 'Month', 'Total Votes', 'Favorite Meal'];
    const values = rows.map((row) => [row.employeeName, row.email, row.department, row.month, row.totalVotes, row.favoriteMeal]);
    const csv = [headers, ...values]
      .map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    this.downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
  }

  exportExcel(rows: MonthlyReportRow[], filename: string): void {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.downloadBlob(new Blob([buffer], { type: 'application/octet-stream' }), `${filename}.xlsx`);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }
}
