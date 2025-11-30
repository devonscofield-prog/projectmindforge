import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('stakeholders');

export type StakeholderInfluenceLevel = 'light_influencer' | 'heavy_influencer' | 'secondary_dm' | 'final_dm';

export interface Stakeholder {
  id: string;
  prospect_id: string;
  rep_id: string;
  name: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  influence_level: StakeholderInfluenceLevel;
  champion_score: number | null;
  champion_score_reasoning: string | null;
  ai_extracted_info: StakeholderIntel | null;
  is_primary_contact: boolean;
  last_interaction_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface StakeholderIntel {
  communication_style?: string;
  priorities?: string[];
  concerns?: string[];
  relationship_notes?: string;
}

export interface StakeholderMention {
  id: string;
  call_id: string;
  stakeholder_id: string;
  was_present: boolean;
  context_notes: string | null;
  created_at: string;
}

export const influenceLevelLabels: Record<StakeholderInfluenceLevel, string> = {
  light_influencer: 'Light Influencer',
  heavy_influencer: 'Heavy Influencer',
  secondary_dm: 'Secondary DM',
  final_dm: 'Final DM',
};

export const influenceLevelOrder: Record<StakeholderInfluenceLevel, number> = {
  final_dm: 1,
  secondary_dm: 2,
  heavy_influencer: 3,
  light_influencer: 4,
};

/**
 * Creates a new stakeholder
 */
export async function createStakeholder(params: {
  prospectId: string;
  repId: string;
  name: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  influenceLevel?: StakeholderInfluenceLevel;
  championScore?: number;
  championScoreReasoning?: string;
  isPrimaryContact?: boolean;
}): Promise<Stakeholder> {
  const { data, error } = await supabase
    .from('stakeholders')
    .insert({
      prospect_id: params.prospectId,
      rep_id: params.repId,
      name: params.name,
      job_title: params.jobTitle || null,
      email: params.email || null,
      phone: params.phone || null,
      influence_level: params.influenceLevel || 'light_influencer',
      champion_score: params.championScore || null,
      champion_score_reasoning: params.championScoreReasoning || null,
      is_primary_contact: params.isPrimaryContact || false,
      last_interaction_date: new Date().toISOString().split('T')[0],
    })
    .select()
    .single();

  if (error) {
    log.error('Failed to create stakeholder', { error });
    throw new Error(`Failed to create stakeholder: ${error.message}`);
  }

  return data as unknown as Stakeholder;
}

/**
 * Finds a stakeholder by name within a prospect (account)
 */
export async function findStakeholderByName(
  prospectId: string,
  name: string
): Promise<Stakeholder | null> {
  const { data, error } = await supabase
    .from('stakeholders')
    .select('*')
    .eq('prospect_id', prospectId)
    .ilike('name', name)
    .maybeSingle();

  if (error) {
    log.error('Failed to find stakeholder', { error });
    throw new Error(`Failed to find stakeholder: ${error.message}`);
  }

  return data as unknown as Stakeholder | null;
}

/**
 * Gets or creates a stakeholder
 */
export async function getOrCreateStakeholder(params: {
  prospectId: string;
  repId: string;
  name: string;
  jobTitle?: string;
  influenceLevel?: StakeholderInfluenceLevel;
  isPrimaryContact?: boolean;
}): Promise<{ stakeholder: Stakeholder; isNew: boolean }> {
  const existing = await findStakeholderByName(params.prospectId, params.name);

  if (existing) {
    // Update last interaction date
    await supabase
      .from('stakeholders')
      .update({ last_interaction_date: new Date().toISOString().split('T')[0] })
      .eq('id', existing.id);

    return { stakeholder: existing, isNew: false };
  }

  const newStakeholder = await createStakeholder(params);
  return { stakeholder: newStakeholder, isNew: true };
}

/**
 * Lists all stakeholders for a prospect (account)
 */
export async function listStakeholdersForProspect(prospectId: string): Promise<Stakeholder[]> {
  const { data, error } = await supabase
    .from('stakeholders')
    .select('*')
    .eq('prospect_id', prospectId)
    .order('is_primary_contact', { ascending: false })
    .order('influence_level', { ascending: true });

  if (error) {
    log.error('Failed to list stakeholders', { error });
    throw new Error(`Failed to list stakeholders: ${error.message}`);
  }

  // Sort by influence level using our custom order
  const stakeholders = (data || []) as unknown as Stakeholder[];
  return stakeholders.sort((a, b) => {
    if (a.is_primary_contact !== b.is_primary_contact) {
      return a.is_primary_contact ? -1 : 1;
    }
    return influenceLevelOrder[a.influence_level] - influenceLevelOrder[b.influence_level];
  });
}

/**
 * Gets a single stakeholder by ID
 */
export async function getStakeholderById(stakeholderId: string): Promise<Stakeholder | null> {
  const { data, error } = await supabase
    .from('stakeholders')
    .select('*')
    .eq('id', stakeholderId)
    .maybeSingle();

  if (error) {
    log.error('Failed to get stakeholder', { error });
    throw new Error(`Failed to get stakeholder: ${error.message}`);
  }

  return data as unknown as Stakeholder | null;
}

/**
 * Updates a stakeholder
 */
export async function updateStakeholder(
  stakeholderId: string,
  updates: {
    name?: string;
    job_title?: string;
    email?: string;
    phone?: string;
    influence_level?: StakeholderInfluenceLevel;
    champion_score?: number;
    champion_score_reasoning?: string;
    ai_extracted_info?: StakeholderIntel;
    is_primary_contact?: boolean;
  }
): Promise<Stakeholder> {
  const { data, error } = await supabase
    .from('stakeholders')
    .update(updates as Record<string, unknown>)
    .eq('id', stakeholderId)
    .select()
    .single();

  if (error) {
    log.error('Failed to update stakeholder', { error });
    throw new Error(`Failed to update stakeholder: ${error.message}`);
  }

  return data as unknown as Stakeholder;
}

/**
 * Deletes a stakeholder
 */
export async function deleteStakeholder(stakeholderId: string): Promise<void> {
  const { error } = await supabase
    .from('stakeholders')
    .delete()
    .eq('id', stakeholderId);

  if (error) {
    log.error('Failed to delete stakeholder', { error });
    throw new Error(`Failed to delete stakeholder: ${error.message}`);
  }
}

/**
 * Gets stakeholder counts for multiple prospects
 */
export async function getStakeholderCountsForProspects(
  prospectIds: string[]
): Promise<Record<string, number>> {
  if (prospectIds.length === 0) return {};

  const { data, error } = await supabase
    .from('stakeholders')
    .select('prospect_id')
    .in('prospect_id', prospectIds);

  if (error) {
    log.error('Failed to get stakeholder counts', { error });
    throw new Error(`Failed to get stakeholder counts: ${error.message}`);
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
 * Links a stakeholder to a call (creates mention)
 */
export async function createCallStakeholderMention(params: {
  callId: string;
  stakeholderId: string;
  wasPresent?: boolean;
  contextNotes?: string;
}): Promise<StakeholderMention> {
  const { data, error } = await supabase
    .from('call_stakeholder_mentions')
    .insert({
      call_id: params.callId,
      stakeholder_id: params.stakeholderId,
      was_present: params.wasPresent ?? true,
      context_notes: params.contextNotes || null,
    })
    .select()
    .single();

  if (error) {
    // If it's a duplicate, just return silently
    if (error.code === '23505') {
      log.info('Mention already exists');
      return {} as StakeholderMention;
    }
    log.error('Failed to create call mention', { error });
    throw new Error(`Failed to create call mention: ${error.message}`);
  }

  return data as unknown as StakeholderMention;
}

/**
 * Gets stakeholders mentioned in a call
 */
export async function getStakeholdersForCall(callId: string): Promise<{
  stakeholder: Stakeholder;
  mention: StakeholderMention;
}[]> {
  const { data, error } = await supabase
    .from('call_stakeholder_mentions')
    .select(`
      *,
      stakeholders (*)
    `)
    .eq('call_id', callId);

  if (error) {
    log.error('Failed to get stakeholders for call', { error });
    throw new Error(`Failed to get stakeholders for call: ${error.message}`);
  }

  interface CallMentionRow {
    id: string;
    call_id: string;
    stakeholder_id: string;
    was_present: boolean;
    context_notes: string | null;
    created_at: string;
    stakeholders: Stakeholder | null;
  }
  
  return (data || []).map((row) => {
    const typedRow = row as unknown as CallMentionRow;
    return {
      stakeholder: typedRow.stakeholders as Stakeholder,
      mention: {
        id: typedRow.id,
        call_id: typedRow.call_id,
        stakeholder_id: typedRow.stakeholder_id,
        was_present: typedRow.was_present,
        context_notes: typedRow.context_notes,
        created_at: typedRow.created_at,
      } as StakeholderMention,
    };
  });
}

/**
 * Gets primary stakeholder for a prospect
 */
export async function getPrimaryStakeholder(prospectId: string): Promise<Stakeholder | null> {
  const { data, error } = await supabase
    .from('stakeholders')
    .select('*')
    .eq('prospect_id', prospectId)
    .eq('is_primary_contact', true)
    .maybeSingle();

  if (error) {
    log.error('Failed to get primary stakeholder', { error });
    throw new Error(`Failed to get primary stakeholder: ${error.message}`);
  }

  return data as unknown as Stakeholder | null;
}

/**
 * Sets a stakeholder as the primary contact for a prospect.
 * This will unset any existing primary contact first.
 */
export async function setPrimaryStakeholder(
  prospectId: string,
  stakeholderId: string
): Promise<Stakeholder> {
  // First, unset any existing primary contacts for this prospect
  const { error: unsetError } = await supabase
    .from('stakeholders')
    .update({ is_primary_contact: false })
    .eq('prospect_id', prospectId)
    .eq('is_primary_contact', true);

  if (unsetError) {
    log.error('Failed to unset old primary stakeholder', { error: unsetError });
    throw new Error(`Failed to unset old primary: ${unsetError.message}`);
  }

  // Now set the new primary contact
  const { data, error } = await supabase
    .from('stakeholders')
    .update({ is_primary_contact: true })
    .eq('id', stakeholderId)
    .select()
    .single();

  if (error) {
    log.error('Failed to set primary stakeholder', { error });
    throw new Error(`Failed to set primary stakeholder: ${error.message}`);
  }

  return data as unknown as Stakeholder;
}

/**
 * Gets primary stakeholders for multiple prospects
 */
export async function getPrimaryStakeholdersForProspects(
  prospectIds: string[]
): Promise<Record<string, { name: string; job_title: string | null }>> {
  if (prospectIds.length === 0) return {};

  const { data, error } = await supabase
    .from('stakeholders')
    .select('prospect_id, name, job_title')
    .in('prospect_id', prospectIds)
    .eq('is_primary_contact', true);

  if (error) {
    log.error('Failed to get primary stakeholders', { error });
    throw new Error(`Failed to get primary stakeholders: ${error.message}`);
  }

  const result: Record<string, { name: string; job_title: string | null }> = {};
  for (const row of data || []) {
    if (row.prospect_id) {
      result[row.prospect_id] = { name: row.name, job_title: row.job_title };
    }
  }

  return result;
}