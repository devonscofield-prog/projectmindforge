import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface CoachMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CoachSession {
  id: string;
  user_id: string;
  prospect_id: string;
  messages: CoachMessage[];
  created_at: string;
  updated_at: string;
}

export async function fetchCoachSession(
  userId: string,
  prospectId: string
): Promise<CoachSession | null> {
  const { data, error } = await supabase
    .from('sales_coach_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('prospect_id', prospectId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching coach session:', error);
    return null;
  }

  if (!data) return null;

  return {
    ...data,
    messages: (data.messages as unknown as CoachMessage[]) || [],
  };
}

export async function saveCoachSession(
  userId: string,
  prospectId: string,
  messages: CoachMessage[]
): Promise<boolean> {
  const { error } = await supabase
    .from('sales_coach_sessions')
    .upsert(
      {
        user_id: userId,
        prospect_id: prospectId,
        messages: messages as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,prospect_id',
      }
    );

  if (error) {
    console.error('Error saving coach session:', error);
    return false;
  }

  return true;
}

export async function clearCoachSession(
  userId: string,
  prospectId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('sales_coach_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('prospect_id', prospectId);

  if (error) {
    console.error('Error clearing coach session:', error);
    return false;
  }

  return true;
}
