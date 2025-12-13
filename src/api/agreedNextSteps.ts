import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('agreedNextSteps');

export interface AgreedNextSteps {
  type: 'scheduled_meeting' | 'pending_action' | 'awaiting_response' | 'none';
  meeting_date?: string;
  meeting_time?: string;
  meeting_agenda?: string;
  summary?: string;
  who_owns_next_action?: 'rep' | 'prospect' | 'both';
  confidence: 'high' | 'medium' | 'low';
  evidence_quote?: string;
  extracted_at: string;
}

interface GenerateNextStepsResponse {
  success: boolean;
  next_steps: AgreedNextSteps;
}

/**
 * Generates agreed next steps by analyzing recent call transcripts
 */
export async function generateAgreedNextSteps(prospectId: string): Promise<AgreedNextSteps> {
  log.info('Generating agreed next steps', { prospectId });

  const { data, error } = await supabase.functions.invoke<GenerateNextStepsResponse>('generate-agreed-next-steps', {
    body: { prospect_id: prospectId },
  });

  if (error) {
    log.error('Generate agreed next steps error', { error });
    
    if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    }
    if (error.message?.includes('402') || error.message?.includes('Payment')) {
      throw new Error('AI usage limit reached. Please add funds to continue.');
    }
    if (error.message?.includes('504') || error.message?.includes('timeout')) {
      throw new Error('Request timed out. Please try again.');
    }
    
    throw new Error(error.message || 'Failed to generate next steps');
  }

  if (!data?.next_steps) {
    throw new Error('No next steps data returned');
  }

  log.info('Agreed next steps generated', { prospectId, type: data.next_steps.type });
  return data.next_steps;
}

/**
 * Type guard to check if an object is a valid AgreedNextSteps
 */
export function isAgreedNextSteps(obj: unknown): obj is AgreedNextSteps {
  if (!obj || typeof obj !== 'object') return false;
  const data = obj as Record<string, unknown>;
  return (
    typeof data.type === 'string' &&
    ['scheduled_meeting', 'pending_action', 'awaiting_response', 'none'].includes(data.type) &&
    typeof data.confidence === 'string' &&
    typeof data.extracted_at === 'string'
  );
}
