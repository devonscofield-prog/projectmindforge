import { supabase } from '@/integrations/supabase/client';

export interface ReportSections {
  summary_stats: boolean;
  wow_trends: boolean;
  best_deal: boolean;
  label_breakdown: boolean;
  close_month_breakdown: boolean;
  pipeline_integrity: boolean;
  rep_breakdown: boolean;
}

export const DEFAULT_REPORT_SECTIONS: ReportSections = {
  summary_stats: true,
  wow_trends: true,
  best_deal: true,
  label_breakdown: true,
  close_month_breakdown: true,
  pipeline_integrity: true,
  rep_breakdown: true,
};

export interface DailyReportConfig {
  id: string;
  user_id: string;
  enabled: boolean;
  delivery_time: string;
  timezone: string;
  rep_ids: string[] | null;
  include_weekends: boolean;
  report_sections: ReportSections | null;
  created_at: string;
  updated_at: string;
}

export interface DailyReportConfigUpdate {
  enabled?: boolean;
  delivery_time?: string;
  timezone?: string;
  rep_ids?: string[] | null;
  include_weekends?: boolean;
  report_sections?: ReportSections | null;
}

export async function getDailyReportConfig(): Promise<DailyReportConfig | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await (supabase as any)
    .from('daily_report_configs')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data as DailyReportConfig | null;
}

export async function upsertDailyReportConfig(
  updates: DailyReportConfigUpdate
): Promise<DailyReportConfig> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await (supabase as any)
    .from('daily_report_configs')
    .upsert({
      user_id: user.id,
      ...updates,
    }, {
      onConflict: 'user_id',
    })
    .select()
    .single();

  if (error) throw error;
  return data as DailyReportConfig;
}

export async function sendTestDailyReport(): Promise<{ success: boolean; message: string; sent?: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('send-daily-report', {
    body: { test: true, userId: user.id },
  });

  if (error) throw error;
  return data;
}

export interface ReportDeliveryEntry {
  id: string;
  sent_at: string;
  title: string;
  summary: string | null;
  task_count: number;
}

export async function getReportDeliveryHistory(limit = 10): Promise<ReportDeliveryEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await (supabase as any)
    .from('notification_log')
    .select('id, sent_at, title, summary, task_count')
    .eq('user_id', user.id)
    .eq('notification_type', 'daily_call_report')
    .order('sent_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as ReportDeliveryEntry[];
}

export async function getTeamReps(): Promise<Array<{ id: string; name: string }>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get teams managed by this user
  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .eq('manager_id', user.id);

  const teamIds = teams?.map(t => t.id) || [];

  // For admins with no teams, get all profiles
  const { data: role } = await (supabase.rpc as Function)('get_user_role', { _user_id: user.id });

  let query = supabase.from('profiles').select('id, name').eq('is_active', true).order('name');

  if (role === 'admin') {
    // Admins see all reps
  } else if (teamIds.length > 0) {
    query = query.in('team_id', teamIds);
  } else {
    return [];
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).filter(p => p.id !== user.id);
}
