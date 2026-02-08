import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface AdminAssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AdminAssistantSession {
  id: string;
  user_id: string;
  messages: AdminAssistantMessage[];
  title: string | null;
  page_context: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function parseMessages(data: Json | null | undefined): AdminAssistantMessage[] {
  if (!data || !Array.isArray(data)) return [];
  return data
    .filter((m): m is { role: string; content: string } =>
      typeof m === 'object' && m !== null && 'role' in m && 'content' in m
    )
    .map(m => ({ role: m.role as 'user' | 'assistant', content: String(m.content) }));
}

function mapSession(data: any): AdminAssistantSession {
  return {
    id: data.id,
    user_id: data.user_id,
    title: data.title,
    page_context: data.page_context,
    is_active: data.is_active ?? true,
    created_at: data.created_at,
    updated_at: data.updated_at,
    messages: parseMessages(data.messages),
  };
}

export async function fetchActiveAdminSession(userId: string): Promise<AdminAssistantSession | null> {
  const { data, error } = await supabase
    .from('admin_assistant_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapSession(data);
}

export async function fetchAllAdminSessions(userId: string): Promise<AdminAssistantSession[]> {
  const { data, error } = await supabase
    .from('admin_assistant_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) return [];
  return (data || []).map(mapSession);
}

export async function saveAdminSession(
  userId: string,
  messages: AdminAssistantMessage[],
  pageContext: string,
  sessionId?: string
): Promise<boolean> {
  try {
    const firstUserMessage = messages.find(m => m.role === 'user');
    const title = firstUserMessage
      ? firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
      : 'New conversation';

    const messagesJson = messages as unknown as Json;

    if (sessionId) {
      const { error } = await supabase
        .from('admin_assistant_sessions')
        .update({ messages: messagesJson, title, page_context: pageContext, updated_at: new Date().toISOString() })
        .eq('id', sessionId);
      if (error) throw error;
      return true;
    }

    // Check for existing active session
    const { data: existing } = await supabase
      .from('admin_assistant_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('admin_assistant_sessions')
        .update({ messages: messagesJson, title, page_context: pageContext, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
      return true;
    }

    const { error } = await supabase
      .from('admin_assistant_sessions')
      .insert([{ user_id: userId, messages: messagesJson, title, page_context: pageContext, is_active: true }]);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[adminSessions] Save error:', error);
    return false;
  }
}

export async function archiveAdminSession(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('admin_assistant_sessions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[adminSessions] Archive error:', error);
    return false;
  }
}

export async function switchAdminSession(userId: string, sessionId: string): Promise<boolean> {
  try {
    await supabase
      .from('admin_assistant_sessions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);

    const { error } = await supabase
      .from('admin_assistant_sessions')
      .update({ is_active: true })
      .eq('id', sessionId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[adminSessions] Switch error:', error);
    return false;
  }
}

export async function deleteAdminSession(sessionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('admin_assistant_sessions')
      .delete()
      .eq('id', sessionId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[adminSessions] Delete error:', error);
    return false;
  }
}
