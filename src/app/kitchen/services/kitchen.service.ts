import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { MealVoteCount } from '../../core/models/app.models';

@Injectable({ providedIn: 'root' })
export class KitchenService {
  private readonly supabase = inject(SupabaseService).client;

  /**
   * Aggregate vote counts per meal for one survey day, scoped to the
   * caller's active organization (a platform administrator must pass
   * organizationId explicitly — see get_meal_vote_counts()). Returns an
   * empty array if no survey exists for that date.
   */
  async getMealVoteCounts(reportDate: string, organizationId: string | null = null): Promise<MealVoteCount[]> {
    const { data, error } = await this.supabase.rpc('get_meal_vote_counts', {
      report_date: reportDate,
      organization_id_filter: organizationId
    });

    if (error) {
      throw error;
    }

    return data ?? [];
  }
}
