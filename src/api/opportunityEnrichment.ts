import { supabase } from '@/integrations/supabase/client';

export interface EnrichmentResult {
  results: Record<string, Record<string, string>>;
}

export interface ContactNameEntry {
  accountName: string;
  contactName: string;
}

/**
 * Send account names (and optional contact names) to the edge function for enrichment.
 * Returns a map of lowercase account name -> enriched fields.
 */
export async function enrichOpportunities(
  accountNames: string[],
  contactNames?: ContactNameEntry[]
): Promise<EnrichmentResult> {
  const { data, error } = await supabase.functions.invoke('enrich-opportunities-csv', {
    body: { accountNames, contactNames },
  });

  if (error) throw new Error(error.message || 'Enrichment failed');
  return data as EnrichmentResult;
}
