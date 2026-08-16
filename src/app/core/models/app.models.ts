export type AppRole = 'admin' | 'employee' | 'platform_administrator' | 'meal_coordinator';

export type SurveyStatus = 'draft' | 'open' | 'closed';

export interface Organization {
  id: string;
  name: string;
  description: string | null;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  department: string | null;
  role?: AppRole;
  roles?: AppRole[];
  /**
   * Which of this user's organizations is currently selected. Null only for
   * platform_administrator — everyone else must have one active org among
   * their memberships (see `organizations`).
   */
  active_organization_id: string | null;
  active_organization?: Organization;
  /** All organizations this user belongs to (admin/employee can belong to several). */
  organizations?: Organization[];
  is_active: boolean;
  /** True right after an admin-provisioned account's first login, until the user sets their own password. */
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface Meal {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DailySurvey {
  id: string;
  survey_date: string;
  status: SurveyStatus;
  created_by: string;
  created_at: string;
  /** Employees can only see/vote on this survey while now() is within [voting_starts_at, voting_ends_at]. */
  voting_starts_at: string;
  voting_ends_at: string;
  /** Present when the row is loaded org-scoped (e.g. by a platform administrator across organizations). */
  organization_id?: string;
  organization?: Organization;
  survey_meals?: SurveyMeal[];
}

export interface SurveyMeal {
  id: string;
  survey_id: string;
  meal_id: string;
  meal?: Meal;
}

export interface Vote {
  id: string;
  survey_id: string;
  user_id: string;
  meal_id: string;
  voted_at: string;
  meal?: Meal;
  daily_surveys?: DailySurvey;
}

export interface DashboardKpi {
  title: string;
  value: string;
  hint: string;
  icon: string;
}

export interface AdminDashboardMetrics {
  participationRate: number;
  totalMealsThisMonth: number;
  mostPopularMeal: string;
  votesToday: number;
  eligibleEmployees: number;
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface EmployeeDashboardSummary {
  hasOpenSurvey: boolean;
  hasVotedToday: boolean;
  monthVoteCount: number;
  lastMealName: string;
}

export interface EmployeeHistoryRow {
  id: string;
  surveyDate: string;
  mealName: string;
  votedAt: string;
  status: SurveyStatus;
}

export interface TodaySurveyViewModel {
  survey: DailySurvey | null;
  selectedMealId: string | null;
}

export interface MonthlyReportRow {
  employeeName: string;
  email: string;
  department: string;
  month: string;
  totalVotes: number;
  favoriteMeal: string;
}

export interface SelectOption<T = string> {
  label: string;
  value: T;
}

export interface AppTableColumn {
  field: string;
  header: string;
  type?: 'text' | 'date' | 'datetime' | 'tag' | 'boolean' | 'number';
}

export interface SurveyUpsertPayload {
  id?: string;
  survey_date: string;
  status: SurveyStatus;
  mealIds: string[];
  /** ISO datetimes — employees can only see/vote on this survey while now() is within this window. */
  voting_starts_at: string;
  voting_ends_at: string;
}

/** A platform administrator has no active organization of their own, so they must pick one explicitly. */
export interface PlatformSurveyUpsertPayload extends SurveyUpsertPayload {
  organizationId: string;
}

/** Per-meal vote count for one survey day — aggregate only, no individual employee/vote data. */
export interface MealVoteCount {
  survey_id: string;
  survey_status: SurveyStatus;
  meal_id: string;
  meal_name: string;
  vote_count: number;
}

/** Raw row from get_survey_voters_by_meal — voter_id/voter_full_name are null when the meal has no votes yet. */
export interface SurveyVoterRow {
  survey_id: string;
  survey_status: SurveyStatus;
  meal_id: string;
  meal_name: string;
  voter_id: string | null;
  voter_full_name: string | null;
}

/** Who voted for a given meal, grouped client-side from SurveyVoterRow[]. */
export interface MealVoterGroup {
  meal_id: string;
  meal_name: string;
  voters: { id: string; full_name: string }[];
}

/** Provisions a brand-new user (via the admin-create-user edge function) with a temporary password. */
export interface CreateUserPayload {
  email: string;
  fullName: string;
  password: string;
  roles: AppRole[];
  /** Ignored server-side when roles includes platform_administrator. */
  organizationIds: string[];
  department?: string;
  phoneNumber?: string;
}
