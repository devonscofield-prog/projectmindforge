import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { toProspect, toProspectWithRep, toProspectActivity } from '@/lib/supabaseAdapters';

const log = createLogger('prospects');

export type ProspectStatus = 'active' | 'won' | 'lost' | 'dormant';

export interface ProspectWithRep {
  id: string;
  rep_id: string;
  rep_name: string;
  prospect_name: string;
  account_name: string | null;
  salesforce_link: string | null;
  potential_revenue: number | null;
  active_revenue: number | null;
  status: ProspectStatus;
  industry: string | null;
  ai_extracted_info: ProspectIntel | null;
  suggested_follow_ups: string[] | null;
  last_contact_date: string | null;
  heat_score: number | null;
  follow_ups_generation_status: string | null;
  follow_ups_last_generated_at: string | null;
  created_at: string;
  updated_at: string;
}
export type ProspectActivityType = 'call' | 'email' | 'meeting' | 'note' | 'linkedin' | 'demo';

export interface Prospect {
  id: string;
  rep_id: string;
  prospect_name: string;
  account_name: string | null;
  salesforce_link: string | null;
  potential_revenue: number | null;
  active_revenue: number | null;
  status: ProspectStatus;
  industry: string | null;
  ai_extracted_info: ProspectIntel | null;
  opportunity_details: OpportunityDetails | null;
  suggested_follow_ups: string[] | null;
  last_contact_date: string | null;
  heat_score: number | null;
  follow_ups_generation_status: string | null;
  follow_ups_last_generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpportunityDetails {
  it_users_count?: number;
  end_users_count?: number;
  ai_users_count?: number;
  compliance_users_count?: number;
  security_awareness_count?: number;
  notes?: string;
  auto_populated_from?: {
    source: 'transcript' | 'research' | 'email';
    source_id?: string;
    extracted_at?: string;
  };
}

export interface ProspectIntel {
  business_context?: string;
  pain_points?: string[];
  current_state?: string;
  decision_process?: {
    stakeholders?: string[];
    timeline?: string;
    budget_signals?: string;
  };
  competitors_mentioned?: string[];
  communication_summary?: string;
  key_opportunities?: string[];
  relationship_health?: string;
  last_analyzed_at?: string;
  user_counts?: {
    it_users?: number;
    end_users?: number;
    ai_users?: number;
    source_quote?: string;
  };
}

export interface ProspectActivity {
  id: string;
  prospect_id: string;
  rep_id: string;
  activity_type: ProspectActivityType;
  description: string | null;
  activity_date: string;
  created_at: string;
}

export interface ProspectFilters {
  search?: string;
  statuses?: ProspectStatus[];
  heatScoreMin?: number;
  heatScoreMax?: number;
  sortBy?: 'prospect_name' | 'account_name' | 'last_contact_date' | 'heat_score' | 'potential_revenue';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Creates a new prospect
 */
export async function createProspect(params: {
  repId: string;
  prospectName: string;
  accountName?: string;
  salesforceLink?: string;
  potentialRevenue?: number;
}): Promise<Prospect> {
  const { data, error } = await supabase
    .from('prospects')
    .insert({
      rep_id: params.repId,
      prospect_name: params.prospectName,
      account_name: params.accountName || null,
      salesforce_link: params.salesforceLink || null,
      potential_revenue: params.potentialRevenue || null,
      status: 'active',
      last_contact_date: new Date().toISOString().split('T')[0],
    })
    .select()
    .single();

  if (error) {
    log.error('Failed to create prospect', { error });
    throw new Error(`Failed to create prospect: ${error.message}`);
  }

  return toProspect(data);
}

/**
 * Finds an existing prospect by name and account for a rep
 */
export async function findProspectByNameAndAccount(
  repId: string,
  prospectName: string,
  accountName?: string
): Promise<Prospect | null> {
  let query = supabase
    .from('prospects')
    .select('*')
    .eq('rep_id', repId)
    .ilike('prospect_name', prospectName);

  if (accountName) {
    query = query.ilike('account_name', accountName);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    log.error('Failed to find prospect', { error });
    throw new Error(`Failed to find prospect: ${error.message}`);
  }

  return data ? toProspect(data) : null;
}

/**
 * Gets or creates a prospect
 */
export async function getOrCreateProspect(params: {
  repId: string;
  prospectName: string;
  accountName?: string;
  salesforceLink?: string;
  potentialRevenue?: number;
}): Promise<{ prospect: Prospect; isNew: boolean }> {
  // Try to find existing prospect
  const existing = await findProspectByNameAndAccount(
    params.repId,
    params.prospectName,
    params.accountName
  );

  if (existing) {
    // Update last contact date
    await supabase
      .from('prospects')
      .update({ last_contact_date: new Date().toISOString().split('T')[0] })
      .eq('id', existing.id);

    return { prospect: existing, isNew: false };
  }

  // Create new prospect
  const newProspect = await createProspect(params);
  return { prospect: newProspect, isNew: true };
}

/**
 * Lists all prospects for a rep with optional filtering and pagination
 */
export function listProspectsForRep(
  repId: string,
  filters: ProspectFilters & { page: number; pageSize?: number }
): Promise<PaginatedResult<Prospect>>;
export function listProspectsForRep(
  repId: string,
  filters?: ProspectFilters
): Promise<Prospect[]>;
export async function listProspectsForRep(
  repId: string,
  filters?: ProspectFilters
): Promise<Prospect[] | PaginatedResult<Prospect>> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 100;
  const usePagination = filters?.page !== undefined;

  let query = supabase
    .from('prospects')
    .select('*', { count: usePagination ? 'exact' : undefined })
    .eq('rep_id', repId);

  // Text search
  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    query = query.or(
      `prospect_name.ilike.${searchTerm},account_name.ilike.${searchTerm}`
    );
  }

  // Status filter
  if (filters?.statuses && filters.statuses.length > 0) {
    query = query.in('status', filters.statuses);
  }

  // Heat score range
  if (filters?.heatScoreMin !== undefined) {
    query = query.gte('heat_score', filters.heatScoreMin);
  }
  if (filters?.heatScoreMax !== undefined) {
    query = query.lte('heat_score', filters.heatScoreMax);
  }

  // Sorting
  const sortBy = filters?.sortBy || 'last_contact_date';
  const sortOrder = filters?.sortOrder || 'desc';
  query = query.order(sortBy, { ascending: sortOrder === 'asc', nullsFirst: false });

  // Pagination
  if (usePagination) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);
  }

  const { data, error, count } = await query;

  if (error) {
    log.error('Failed to list prospects', { error });
    throw new Error(`Failed to list prospects: ${error.message}`);
  }

  const prospects = (data || []).map(toProspect);

  if (usePagination) {
    const totalCount = count ?? 0;
    return {
      data: prospects,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  }

  return prospects;
}

/**
 * Gets a single prospect by ID
 */
export async function getProspectById(prospectId: string): Promise<Prospect | null> {
  const { data, error } = await supabase
    .from('prospects')
    .select('*')
    .eq('id', prospectId)
    .maybeSingle();

  if (error) {
    log.error('Failed to get prospect', { error });
    throw new Error(`Failed to get prospect: ${error.message}`);
  }

  return data ? toProspect(data) : null;
}

/**
 * Updates a prospect
 */
export async function updateProspect(
  prospectId: string,
  updates: {
    status?: ProspectStatus;
    potential_revenue?: number;
    salesforce_link?: string | null;
    industry?: string | null;
    ai_extracted_info?: ProspectIntel;
    opportunity_details?: OpportunityDetails;
    suggested_follow_ups?: string[];
    heat_score?: number;
  }
): Promise<Prospect> {
  const { data, error } = await supabase
    .from('prospects')
    .update(updates as Record<string, unknown>)
    .eq('id', prospectId)
    .select()
    .single();

  if (error) {
    log.error('Failed to update prospect', { error });
    throw new Error(`Failed to update prospect: ${error.message}`);
  }

  return toProspect(data);
}

/**
 * Lists activities for a prospect
 */
export async function listActivitiesForProspect(prospectId: string): Promise<ProspectActivity[]> {
  const { data, error } = await supabase
    .from('prospect_activities')
    .select('*')
    .eq('prospect_id', prospectId)
    .order('activity_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    log.error('Failed to list activities', { error });
    throw new Error(`Failed to list activities: ${error.message}`);
  }

  return (data || []).map(toProspectActivity);
}

/**
 * Creates a new activity for a prospect
 */
export async function createProspectActivity(params: {
  prospectId: string;
  repId: string;
  activityType: ProspectActivityType;
  description?: string;
  activityDate?: string;
}): Promise<ProspectActivity> {
  const { data, error } = await supabase
    .from('prospect_activities')
    .insert({
      prospect_id: params.prospectId,
      rep_id: params.repId,
      activity_type: params.activityType,
      description: params.description || null,
      activity_date: params.activityDate || new Date().toISOString().split('T')[0],
    })
    .select()
    .single();

  if (error) {
    log.error('Failed to create activity', { error });
    throw new Error(`Failed to create activity: ${error.message}`);
  }

  // Update prospect's last contact date
  await supabase
    .from('prospects')
    .update({ last_contact_date: params.activityDate || new Date().toISOString().split('T')[0] })
    .eq('id', params.prospectId);

  return toProspectActivity(data);
}

/**
 * Gets calls linked to a prospect
 */
export async function getCallsForProspect(prospectId: string): Promise<{
  id: string;
  call_date: string;
  call_type: string | null;
  analysis_status: string;
  primary_stakeholder_name: string | null;
}[]> {
  const { data, error } = await supabase
    .from('call_transcripts')
    .select('id, call_date, call_type, analysis_status, primary_stakeholder_name')
    .eq('prospect_id', prospectId)
    .order('call_date', { ascending: false });

  if (error) {
    log.error('Failed to get calls', { error });
    throw new Error(`Failed to get calls: ${error.message}`);
  }

  return data || [];
}

/**
 * Links a call transcript to a prospect
 */
export async function linkCallToProspect(callId: string, prospectId: string): Promise<void> {
  const { error } = await supabase
    .from('call_transcripts')
    .update({ prospect_id: prospectId })
    .eq('id', callId);

  if (error) {
    log.error('Failed to link call', { error });
    throw new Error(`Failed to link call: ${error.message}`);
  }
}

/**
 * Gets call count for prospects
 */
export async function getCallCountsForProspects(prospectIds: string[]): Promise<Record<string, number>> {
  if (prospectIds.length === 0) return {};

  const { data, error } = await supabase
    .from('call_transcripts')
    .select('prospect_id')
    .in('prospect_id', prospectIds);

  if (error) {
    log.error('Failed to get call counts', { error });
    throw new Error(`Failed to get call counts: ${error.message}`);
  }

  const counts: Record<string, number> = {};
  prospectIds.forEach(id => counts[id] = 0);
  
  for (const row of data || []) {
    if (row.prospect_id) {
      counts[row.prospect_id] = (counts[row.prospect_id] || 0) + 1;
    }
  }

  return counts;
}

/**
 * Regenerate AI insights for a prospect from all available data
 */
export async function regenerateAccountInsights(prospectId: string): Promise<{ success: boolean; error?: string; isRateLimited?: boolean }> {
  const { data, error } = await supabase.functions.invoke('regenerate-account-insights', {
    body: { prospect_id: prospectId }
  });

  if (error) {
    log.error('Failed to regenerate account insights', { error });
    const isRateLimited = error.message?.toLowerCase().includes('rate limit') ||
                          error.message?.includes('429');
    return { success: false, error: error.message, isRateLimited };
  }

  // Check if the response indicates rate limiting
  if (data?.error?.toLowerCase().includes('rate limit')) {
    return { success: false, error: data.error, isRateLimited: true };
  }

  return data;
}

/**
 * Lists all prospects for a manager's team with optional filtering
 */
export async function listProspectsForTeam(
  managerId: string,
  filters?: ProspectFilters & { repId?: string }
): Promise<ProspectWithRep[]> {
  // First get all teams managed by this manager
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id')
    .eq('manager_id', managerId);

  if (teamsError) {
    log.error('Error fetching teams for team prospects', { error: teamsError });
    throw new Error(`Failed to fetch teams: ${teamsError.message}`);
  }

  if (!teams || teams.length === 0) {
    return [];
  }

  // Get all rep IDs in those teams
  const teamIds = teams.map(t => t.id);
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name')
    .in('team_id', teamIds);

  if (profilesError) {
    log.error('Error fetching profiles for team prospects', { error: profilesError });
    throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
  }

  if (!profiles || profiles.length === 0) {
    return [];
  }

  // Build rep ID to name map
  const repIdToName: Record<string, string> = {};
  profiles.forEach(p => {
    repIdToName[p.id] = p.name;
  });

  const repIds = profiles.map(p => p.id);

  // Build the prospects query
  let query = supabase
    .from('prospects')
    .select('*')
    .in('rep_id', repIds);

  // Apply rep filter if provided
  if (filters?.repId) {
    query = query.eq('rep_id', filters.repId);
  }

  // Text search
  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    query = query.or(
      `prospect_name.ilike.${searchTerm},account_name.ilike.${searchTerm}`
    );
  }

  // Status filter
  if (filters?.statuses && filters.statuses.length > 0) {
    query = query.in('status', filters.statuses);
  }

  // Heat score range
  if (filters?.heatScoreMin !== undefined) {
    query = query.gte('heat_score', filters.heatScoreMin);
  }
  if (filters?.heatScoreMax !== undefined) {
    query = query.lte('heat_score', filters.heatScoreMax);
  }

  // Sorting
  const sortBy = filters?.sortBy || 'last_contact_date';
  const sortOrder = filters?.sortOrder || 'desc';
  query = query.order(sortBy, { ascending: sortOrder === 'asc', nullsFirst: false });

  const { data, error } = await query;

  if (error) {
    log.error('Error fetching team prospects', { error });
    throw new Error(`Failed to fetch team prospects: ${error.message}`);
  }

  return (data || []).map(row => toProspectWithRep(row, repIdToName[row.rep_id] || 'Unknown'));
}

/**
 * Gets reps in a manager's team for filter dropdown
 */
export async function getTeamRepsForManager(managerId: string): Promise<{ id: string; name: string }[]> {
  // Get teams for this manager
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id')
    .eq('manager_id', managerId);

  if (teamsError) {
    log.error('Error fetching teams for manager', { error: teamsError });
    return [];
  }

  if (!teams || teams.length === 0) {
    return [];
  }

  // Get reps in those teams
  const teamIds = teams.map(t => t.id);
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name')
    .in('team_id', teamIds)
    .order('name');

  if (profilesError) {
    log.error('Error fetching profiles for manager', { error: profilesError });
    return [];
  }

  return profiles || [];
}
