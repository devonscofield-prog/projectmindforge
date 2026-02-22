export type UserRole = 'rep' | 'manager' | 'admin' | 'sdr' | 'sdr_manager';

export type ActivityType = 'cold_calls' | 'emails' | 'linkedin' | 'demos' | 'meetings' | 'proposals';

export interface Profile {
  id: string;
  name: string;
  email: string;
  team_id: string | null;
  hire_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  manager_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepPerformanceSnapshot {
  id: string;
  rep_id: string;
  period_type: string;
  period_year: number;
  period_month: number;
  revenue_closed: number;
  demos_set: number;
  demo_goal: number;
  revenue_goal: number;
  pipeline_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface CoachingSession {
  id: string;
  rep_id: string;
  manager_id: string;
  session_date: string;
  focus_area: string;
  notes: string | null;
  action_items: string | null;
  follow_up_date: string | null;
  source_call_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  rep_id: string;
  activity_date: string;
  activity_type: ActivityType;
  count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Extended types with relations
export interface ProfileWithTeam extends Profile {
  team?: Team | null;
}

export interface TeamWithManager extends Team {
  manager?: Profile | null;
}

export interface CoachingSessionWithProfiles extends CoachingSession {
  rep?: Profile;
  manager?: Profile;
}

export interface RepWithPerformance extends Profile {
  performance?: RepPerformanceSnapshot;
  lastCoaching?: CoachingSession;
}
