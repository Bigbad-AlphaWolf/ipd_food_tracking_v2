import { Injectable, inject } from '@angular/core';
import { endOfMonth, format, startOfMonth } from './employee.util';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { DailySurvey, EmployeeDashboardSummary, EmployeeHistoryRow, Vote } from '../../core/models/app.models';

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly authService = inject(AuthService);

  async getTodaySurvey(): Promise<{ survey: DailySurvey | null; selectedMealId: string | null }> {
    const today = format(new Date());
    const userId = this.authService.profile()?.id;

    const { data: survey, error } = await this.supabase
      .from('daily_surveys')
      .select('*, survey_meals(*, meal:meals(*))')
      .eq('survey_date', today)
      .eq('status', 'open')
      .maybeSingle<DailySurvey>();

    if (error) {
      throw error;
    }

    if (!survey || !userId) {
      return { survey: survey ?? null, selectedMealId: null };
    }

    const { data: vote, error: voteError } = await this.supabase
      .from('votes')
      .select('meal_id')
      .eq('survey_id', survey.id)
      .eq('user_id', userId)
      .maybeSingle<{ meal_id: string }>();

    if (voteError) {
      throw voteError;
    }

    return { survey, selectedMealId: vote?.meal_id ?? null };
  }

  async submitVote(surveyId: string, mealId: string): Promise<void> {
    const userId = this.authService.profile()?.id;

    if (!userId) {
      throw new Error('You must be signed in to vote.');
    }

    const { error } = await this.supabase.from('votes').insert({
      survey_id: surveyId,
      user_id: userId,
      meal_id: mealId
    });

    if (error) {
      throw error;
    }
  }

  async getHistory(month: number, year: number): Promise<EmployeeHistoryRow[]> {
    const userId = this.authService.profile()?.id;

    if (!userId) {
      return [];
    }

    const start = startOfMonth(year, month);
    const end = endOfMonth(year, month);

    const { data, error } = await this.supabase
      .from('votes')
      .select('id, voted_at, meal:meals(name), daily_surveys!inner(survey_date, status)')
      .eq('user_id', userId)
      .gte('voted_at', start)
      .lte('voted_at', end)
      .order('voted_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      surveyDate: row.daily_surveys?.survey_date,
      mealName: row.meal?.name,
      votedAt: row.voted_at,
      status: row.daily_surveys?.status
    }));
  }

  async getDashboardSummary(month: number, year: number): Promise<EmployeeDashboardSummary> {
    const [{ survey, selectedMealId }, history] = await Promise.all([
      this.getTodaySurvey(),
      this.getHistory(month, year)
    ]);

    return {
      hasOpenSurvey: !!survey,
      hasVotedToday: !!selectedMealId,
      monthVoteCount: history.length,
      lastMealName: history[0]?.mealName ?? 'No meal yet'
    };
  }
}
