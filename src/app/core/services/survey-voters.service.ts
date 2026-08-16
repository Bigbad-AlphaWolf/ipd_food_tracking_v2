import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { MealVoterGroup, SurveyVoterRow } from '../models/app.models';

/**
 * Who voted for what, grouped by meal, for one survey day — visible to
 * every active user (org-scoped; a platform administrator must pass an
 * explicit organizationId). Shared by the employee Today's Menu page and
 * the kitchen coordinator dashboard.
 */
@Injectable({ providedIn: 'root' })
export class SurveyVotersService {
  private readonly supabase = inject(SupabaseService).client;

  async getSurveyVotersByMeal(reportDate: string, organizationId: string | null = null): Promise<MealVoterGroup[]> {
    const { data, error } = await this.supabase.rpc('get_survey_voters_by_meal', {
      report_date: reportDate,
      organization_id_filter: organizationId
    });

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as SurveyVoterRow[];
    const groups = new Map<string, MealVoterGroup>();

    for (const row of rows) {
      let group = groups.get(row.meal_id);

      if (!group) {
        group = { meal_id: row.meal_id, meal_name: row.meal_name, voters: [] };
        groups.set(row.meal_id, group);
      }

      if (row.voter_id && row.voter_full_name) {
        group.voters.push({ id: row.voter_id, full_name: row.voter_full_name });
      }
    }

    return [...groups.values()];
  }
}
