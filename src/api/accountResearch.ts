import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import type { StructuredAccountResearch } from '@/types/accountResearch';

const log = createLogger('accountResearch');

export interface AccountResearchRequest {
  companyName: string;
  website?: string;
  industry?: string;
  stakeholders?: Array<{ name: string; title?: string; role?: string }>;
  productPitch?: string;
  dealStage?: string;
  knownChallenges?: string;
  additionalNotes?: string;
}

export interface AccountResearchResponse {
  research: StructuredAccountResearch;
}

/**
 * Fetches structured account research from the AI edge function
 */
export async function fetchAccountResearch(
  request: AccountResearchRequest
): Promise<StructuredAccountResearch> {
  log.info('Starting account research', { company: request.companyName });

  const { data, error } = await supabase.functions.invoke<AccountResearchResponse>('account-research', {
    body: request,
  });

  if (error) {
    log.error('Account research error', { error });
    
    // Handle specific error codes
    if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    }
    if (error.message?.includes('402') || error.message?.includes('Payment')) {
      throw new Error('AI usage limit reached. Please add funds to continue.');
    }
    if (error.message?.includes('504') || error.message?.includes('timeout')) {
      throw new Error('Research timed out. Please try again.');
    }
    
    throw new Error(error.message || 'Failed to fetch account research');
  }

  if (!data?.research) {
    throw new Error('No research data returned');
  }

  log.info('Account research completed', { company: request.companyName });
  return data.research;
}

// Legacy streaming interface - deprecated but kept for backwards compatibility
export interface StreamAccountResearchOptions {
  request: AccountResearchRequest;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

/**
 * @deprecated Use fetchAccountResearch instead for structured output
 */
export async function streamAccountResearch({
  request,
  onDelta: _onDelta,
  onDone,
  onError,
}: StreamAccountResearchOptions): Promise<void> {
  try {
    await fetchAccountResearch(request);
    onDone();
  } catch (error) {
    onError(error instanceof Error ? error : new Error('Unknown error'));
  }
}
