import { supabase } from '@/integrations/supabase/client';
import type { Competitor, CompetitorIntel, CompetitorBranding } from '@/types/competitors';

export async function fetchCompetitors(): Promise<Competitor[]> {
  const { data, error } = await supabase
    .from('competitors')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return (data || []).map(row => ({
    ...row,
    intel: row.intel as CompetitorIntel | null,
    branding: row.branding as CompetitorBranding | null,
    raw_content: row.raw_content as Record<string, unknown>,
    research_status: row.research_status as Competitor['research_status'],
  }));
}

export async function fetchCompetitor(id: string): Promise<Competitor | null> {
  const { data, error } = await supabase
    .from('competitors')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  return {
    ...data,
    intel: data.intel as CompetitorIntel | null,
    branding: data.branding as CompetitorBranding | null,
    raw_content: data.raw_content as Record<string, unknown>,
    research_status: data.research_status as Competitor['research_status'],
  };
}

export async function createCompetitor(name: string, website: string): Promise<Competitor> {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('competitors')
    .insert({
      name,
      website,
      research_status: 'pending',
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) throw error;
  
  return {
    ...data,
    intel: null,
    branding: null,
    raw_content: {},
    research_status: 'pending',
  };
}

export async function deleteCompetitor(id: string): Promise<void> {
  const { error } = await supabase
    .from('competitors')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function researchCompetitor(
  competitorId: string,
  website: string,
  name: string
): Promise<{ success: boolean; status?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('competitor-research', {
    body: {
      competitor_id: competitorId,
      website,
      name,
    },
  });

  if (error) {
    await supabase
      .from('competitors')
      .update({ research_status: 'error' })
      .eq('id', competitorId);
    
    return { success: false, error: error.message };
  }

  // Handle null/undefined response
  if (!data) {
    await supabase
      .from('competitors')
      .update({ research_status: 'error' })
      .eq('id', competitorId);
    
    return { success: false, error: 'No response from research function' };
  }

  // Background processing - returns { success: true, status: 'processing' }
  if (data.status === 'processing') {
    return { success: true, status: 'processing' };
  }

  // Handle unexpected responses
  if (!data.success) {
    await supabase
      .from('competitors')
      .update({ research_status: 'error' })
      .eq('id', competitorId);
    
    return { success: false, error: data.error || 'Research failed' };
  }

  return { success: true };
}

export async function resetCompetitorStatus(competitorId: string): Promise<void> {
  const { error } = await supabase
    .from('competitors')
    .update({ research_status: 'pending' })
    .eq('id', competitorId);

  if (error) throw error;
}
