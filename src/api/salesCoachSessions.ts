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
  title: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Fetch the active session for a user/prospect
export async function fetchCoachSession(
  userId: string,
  prospectId: string
): Promise<CoachSession | null> {
  const { data, error } = await supabase
    .from('sales_coach_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('prospect_id', prospectId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching coach session:', error);
    return null;
  }

  if (!data) return null;

  return {
    ...data,
    messages: (data.messages as unknown as CoachMessage[]) || [],
    title: data.title ?? null,
    is_active: data.is_active ?? true,
  };
}

// Fetch all sessions for a user/prospect (for history view)
export async function fetchAllCoachSessions(
  userId: string,
  prospectId: string
): Promise<CoachSession[]> {
  const { data, error } = await supabase
    .from('sales_coach_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('prospect_id', prospectId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching all coach sessions:', error);
    return [];
  }

  return (data || []).map(session => ({
    ...session,
    messages: (session.messages as unknown as CoachMessage[]) || [],
    title: session.title ?? null,
    is_active: session.is_active ?? true,
  }));
}

// Fetch a specific session by ID
export async function fetchCoachSessionById(
  sessionId: string
): Promise<CoachSession | null> {
  const { data, error } = await supabase
    .from('sales_coach_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) {
    console.error('Error fetching coach session by ID:', error);
    return null;
  }

  return {
    ...data,
    messages: (data.messages as unknown as CoachMessage[]) || [],
    title: data.title ?? null,
    is_active: data.is_active ?? true,
  };
}

// Save messages to the active session (or create new if none active)
export async function saveCoachSession(
  userId: string,
  prospectId: string,
  messages: CoachMessage[],
  sessionId?: string
): Promise<boolean> {
  // Generate title from first user message if not set
  const firstUserMessage = messages.find(m => m.role === 'user');
  const title = firstUserMessage 
    ? firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
    : `Conversation from ${new Date().toLocaleDateString()}`;

  if (sessionId) {
    // Update specific session
    const { error } = await supabase
      .from('sales_coach_sessions')
      .update({
        messages: messages as unknown as Json,
        title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      console.error('Error saving coach session:', error);
      return false;
    }
    return true;
  }

  // Check for existing active session
  const { data: existing } = await supabase
    .from('sales_coach_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('prospect_id', prospectId)
    .eq('is_active', true)
    .maybeSingle();

  if (existing) {
    // Update existing active session
    const { error } = await supabase
      .from('sales_coach_sessions')
      .update({
        messages: messages as unknown as Json,
        title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) {
      console.error('Error updating coach session:', error);
      return false;
    }
  } else {
    // Create new active session
    const { error } = await supabase
      .from('sales_coach_sessions')
      .insert({
        user_id: userId,
        prospect_id: prospectId,
        messages: messages as unknown as Json,
        title,
        is_active: true,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error creating coach session:', error);
      return false;
    }
  }

  return true;
}

// Archive the current active session and start a new one
export async function archiveAndStartNewSession(
  userId: string,
  prospectId: string
): Promise<boolean> {
  // Archive current active session
  const { error: archiveError } = await supabase
    .from('sales_coach_sessions')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('prospect_id', prospectId)
    .eq('is_active', true);

  if (archiveError) {
    console.error('Error archiving coach session:', archiveError);
    return false;
  }

  return true;
}

// Switch to a specific session (make it active, archive others)
export async function switchToSession(
  userId: string,
  prospectId: string,
  sessionId: string
): Promise<boolean> {
  // First archive all active sessions for this prospect
  const { error: archiveError } = await supabase
    .from('sales_coach_sessions')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('prospect_id', prospectId)
    .eq('is_active', true);

  if (archiveError) {
    console.error('Error archiving sessions:', archiveError);
    return false;
  }

  // Make the target session active
  const { error: activateError } = await supabase
    .from('sales_coach_sessions')
    .update({ is_active: true })
    .eq('id', sessionId);

  if (activateError) {
    console.error('Error activating session:', activateError);
    return false;
  }

  return true;
}

// Delete a specific session
export async function deleteCoachSession(
  sessionId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('sales_coach_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    console.error('Error deleting coach session:', error);
    return false;
  }

  return true;
}

// Clear/delete the active session (legacy function for backward compat)
export async function clearCoachSession(
  userId: string,
  prospectId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('sales_coach_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('prospect_id', prospectId)
    .eq('is_active', true);

  if (error) {
    console.error('Error clearing coach session:', error);
    return false;
  }

  return true;
}
