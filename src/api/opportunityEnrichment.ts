import { supabase } from '@/integrations/supabase/client';

export interface EnrichmentResult {
  results: Record<string, Record<string, string>>;
}

/**
 * Send account names to the edge function for enrichment.
 * Returns a map of lowercase account name -> enriched fields.
 */
export async function enrichOpportunities(accountNames: string[]): Promise<EnrichmentResult> {
  const { data, error } = await supabase.functions.invoke('enrich-opportunities-csv', {
    body: { accountNames },
  });

  if (error) throw new Error(error.message || 'Enrichment failed');
  return data as EnrichmentResult;
}
