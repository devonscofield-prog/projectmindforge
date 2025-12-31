import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantSession {
  id: string;
  user_id: string;
  messages: AssistantMessage[];
  title: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function parseMessages(data: Json | null | undefined): AssistantMessage[] {
  if (!data || !Array.isArray(data)) return [];
  return data.filter((m): m is { role: string; content: string } => 
    typeof m === 'object' && m !== null && 'role' in m && 'content' in m
  ).map(m => ({ role: m.role as 'user' | 'assistant', content: String(m.content) }));
}

export async function fetchAssistantSession(userId: string): Promise<AssistantSession | null> {
  const { data, error } = await supabase
    .from('sales_assistant_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[salesAssistantSessions] Error fetching session:', error);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    user_id: data.user_id,
    title: data.title,
    is_active: data.is_active ?? true,
    created_at: data.created_at,
    updated_at: data.updated_at,
    messages: parseMessages(data.messages),
  };
}

export async function fetchAllAssistantSessions(userId: string): Promise<AssistantSession[]> {
  const { data, error } = await supabase
    .from('sales_assistant_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[salesAssistantSessions] Error fetching all sessions:', error);
    return [];
  }

  return (data || []).map(session => ({
    id: session.id,
    user_id: session.user_id,
    title: session.title,
    is_active: session.is_active ?? false,
    created_at: session.created_at,
    updated_at: session.updated_at,
    messages: parseMessages(session.messages),
  }));
}

export async function fetchAssistantSessionById(sessionId: string): Promise<AssistantSession | null> {
  const { data, error } = await supabase
    .from('sales_assistant_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) {
    console.error('[salesAssistantSessions] Error fetching session by id:', error);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    user_id: data.user_id,
    title: data.title,
    is_active: data.is_active ?? false,
    created_at: data.created_at,
    updated_at: data.updated_at,
    messages: parseMessages(data.messages),
  };
}

export async function saveAssistantSession(
  userId: string,
  messages: AssistantMessage[],
  sessionId?: string
): Promise<boolean> {
  try {
    // Generate title from first user message
    const firstUserMessage = messages.find(m => m.role === 'user');
    const title = firstUserMessage 
      ? firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
      : 'New conversation';

    const messagesJson = messages as unknown as Json;

    if (sessionId) {
      // Update existing session
      const { error } = await supabase
        .from('sales_assistant_sessions')
        .update({ messages: messagesJson, title, updated_at: new Date().toISOString() })
        .eq('id', sessionId);
      
      if (error) throw error;
      return true;
    }

    // Check for existing active session
    const { data: existing } = await supabase
      .from('sales_assistant_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Update existing active session
      const { error } = await supabase
        .from('sales_assistant_sessions')
        .update({ messages: messagesJson, title, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      
      if (error) throw error;
      return true;
    }

    // Create new session
    const { error } = await supabase
      .from('sales_assistant_sessions')
      .insert([{ user_id: userId, messages: messagesJson, title, is_active: true }]);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[salesAssistantSessions] Error saving session:', error);
    return false;
  }
}

export async function archiveAndStartNewSession(userId: string): Promise<boolean> {
  try {
    // Archive all active sessions for this user
    const { error } = await supabase
      .from('sales_assistant_sessions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[salesAssistantSessions] Error archiving session:', error);
    return false;
  }
}

export async function switchToSession(userId: string, sessionId: string): Promise<boolean> {
  try {
    // Archive all active sessions
    await supabase
      .from('sales_assistant_sessions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);

    // Activate the selected session
    const { error } = await supabase
      .from('sales_assistant_sessions')
      .update({ is_active: true })
      .eq('id', sessionId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[salesAssistantSessions] Error switching session:', error);
    return false;
  }
}

export async function deleteAssistantSession(sessionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('sales_assistant_sessions')
      .delete()
      .eq('id', sessionId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[salesAssistantSessions] Error deleting session:', error);
    return false;
  }
}
