import { supabase } from '@/integrations/supabase/client';

export type ReportType = 'team_performance' | 'individual_rep' | 'pipeline' | 'coaching_activity';

export interface ReportFilters {
  reportType: ReportType;
  startDate: string;
  endDate: string;
  repIds: string[] | null; // null = all
}

export interface TeamPerformanceRow {
  rep_id: string;
  rep_name: string;
  total_calls: number;
  avg_effectiveness: number | null;
  total_pipeline: number;
}

export interface IndividualRepRow {
  call_id: string;
  call_date: string;
  account_name: string | null;
  effectiveness_score: number | null;
  call_summary: string;
}

export interface PipelineRow {
  prospect_id: string;
  prospect_name: string;
  account_name: string | null;
  heat_score: number | null;
  potential_revenue: number | null;
  active_revenue: number | null;
  last_contact_date: string | null;
  rep_name: string;
}

export interface CoachingActivityRow {
  rep_id: string;
  rep_name: string;
  session_count: number;
  latest_session: string | null;
}

export type ReportData =
  | { type: 'team_performance'; rows: TeamPerformanceRow[] }
  | { type: 'individual_rep'; rows: IndividualRepRow[] }
  | { type: 'pipeline'; rows: PipelineRow[] }
  | { type: 'coaching_activity'; rows: CoachingActivityRow[] };

export async function generateReport(filters: ReportFilters): Promise<ReportData> {
  switch (filters.reportType) {
    case 'team_performance':
      return { type: 'team_performance', rows: await fetchTeamPerformance(filters) };
    case 'individual_rep':
      return { type: 'individual_rep', rows: await fetchIndividualRep(filters) };
    case 'pipeline':
      return { type: 'pipeline', rows: await fetchPipeline(filters) };
    case 'coaching_activity':
      return { type: 'coaching_activity', rows: await fetchCoachingActivity(filters) };
  }
}

async function fetchTeamPerformance(filters: ReportFilters): Promise<TeamPerformanceRow[]> {
  let query = supabase
    .from('call_transcripts')
    .select(`
      rep_id,
      potential_revenue,
      profiles!call_transcripts_rep_id_fkey ( name ),
      ai_call_analysis ( call_effectiveness_score )
    `)
    .is('deleted_at', null)
    .gte('call_date', filters.startDate)
    .lte('call_date', filters.endDate);

  if (filters.repIds && filters.repIds.length > 0) {
    query = query.in('rep_id', filters.repIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Aggregate by rep
  const byRep = new Map<string, TeamPerformanceRow>();
  for (const row of data || []) {
    const name = (row as any).profiles?.name || 'Unknown';
    if (!byRep.has(row.rep_id)) {
      byRep.set(row.rep_id, { rep_id: row.rep_id, rep_name: name, total_calls: 0, avg_effectiveness: null, total_pipeline: 0 });
    }
    const entry = byRep.get(row.rep_id)!;
    entry.total_calls++;
    entry.total_pipeline += row.potential_revenue || 0;

    const analyses = (row as any).ai_call_analysis;
    if (Array.isArray(analyses)) {
      for (const a of analyses) {
        if (a.call_effectiveness_score != null) {
          const prev = entry.avg_effectiveness ?? 0;
          const count = entry.total_calls;
          entry.avg_effectiveness = prev + (a.call_effectiveness_score - prev) / count;
        }
      }
    }
  }

  return Array.from(byRep.values()).sort((a, b) => b.total_calls - a.total_calls);
}

async function fetchIndividualRep(filters: ReportFilters): Promise<IndividualRepRow[]> {
  const repId = filters.repIds?.[0];
  if (!repId) return [];

  let query = supabase
    .from('call_transcripts')
    .select(`
      id,
      call_date,
      account_name,
      ai_call_analysis ( call_effectiveness_score, call_summary )
    `)
    .eq('rep_id', repId)
    .is('deleted_at', null)
    .gte('call_date', filters.startDate)
    .lte('call_date', filters.endDate)
    .order('call_date', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row: any) => {
    const analysis = Array.isArray(row.ai_call_analysis) ? row.ai_call_analysis[0] : null;
    return {
      call_id: row.id,
      call_date: row.call_date,
      account_name: row.account_name,
      effectiveness_score: analysis?.call_effectiveness_score ?? null,
      call_summary: analysis?.call_summary ?? '',
    };
  });
}

async function fetchPipeline(filters: ReportFilters): Promise<PipelineRow[]> {
  let query = supabase
    .from('prospects')
    .select(`
      id,
      prospect_name,
      account_name,
      heat_score,
      potential_revenue,
      active_revenue,
      last_contact_date,
      rep_id,
      profiles!prospects_rep_id_fkey ( name )
    `)
    .is('deleted_at', null)
    .order('heat_score', { ascending: false });

  if (filters.repIds && filters.repIds.length > 0) {
    query = query.in('rep_id', filters.repIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row: any) => ({
    prospect_id: row.id,
    prospect_name: row.prospect_name,
    account_name: row.account_name,
    heat_score: row.heat_score,
    potential_revenue: row.potential_revenue,
    active_revenue: row.active_revenue,
    last_contact_date: row.last_contact_date,
    rep_name: row.profiles?.name || 'Unknown',
  }));
}

async function fetchCoachingActivity(filters: ReportFilters): Promise<CoachingActivityRow[]> {
  let query = (supabase as any)
    .from('sales_coach_sessions')
    .select('user_id, created_at')
    .gte('created_at', filters.startDate)
    .lte('created_at', filters.endDate);

  if (filters.repIds && filters.repIds.length > 0) {
    query = query.in('user_id', filters.repIds);
  }

  const { data: sessions, error } = await query;
  if (error) throw error;

  // Get profile names
  const userIds = [...new Set((sessions || []).map((s: any) => s.user_id as string))];
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', userIds as string[]);

  const nameMap = new Map((profiles || []).map(p => [p.id, p.name]));

  const byUser = new Map<string, CoachingActivityRow>();
  for (const s of sessions || []) {
    if (!byUser.has(s.user_id)) {
      byUser.set(s.user_id, {
        rep_id: s.user_id,
        rep_name: nameMap.get(s.user_id) || 'Unknown',
        session_count: 0,
        latest_session: null,
      });
    }
    const entry = byUser.get(s.user_id)!;
    entry.session_count++;
    if (!entry.latest_session || s.created_at > entry.latest_session) {
      entry.latest_session = s.created_at;
    }
  }

  return Array.from(byUser.values()).sort((a, b) => b.session_count - a.session_count);
}

export function exportToCsv(headers: string[], rows: Record<string, any>[], filename: string) {
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h] ?? '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
