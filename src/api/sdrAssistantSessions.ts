import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface SDRAssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SDRAssistantSession {
  id: string;
  user_id: string;
  messages: SDRAssistantMessage[];
  title: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function parseMessages(data: Json | null | undefined): SDRAssistantMessage[] {
  if (!data || !Array.isArray(data)) return [];
  return data.filter((m): m is { role: string; content: string } =>
    typeof m === 'object' && m !== null && 'role' in m && 'content' in m
  ).map(m => ({ role: m.role as 'user' | 'assistant', content: String(m.content) }));
}

function mapSession(data: { id: string; user_id: string; messages: Json; title: string | null; is_active: boolean; created_at: string; updated_at: string }): SDRAssistantSession {
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

export async function fetchSDRAssistantSession(userId: string): Promise<SDRAssistantSession | null> {
  const { data, error } = await supabase
    .from('sdr_assistant_sessions')
    .select('*').eq('user_id', userId).eq('is_active', true)
    .order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  return mapSession(data);
}

export async function fetchAllSDRAssistantSessions(userId: string): Promise<SDRAssistantSession[]> {
  const { data, error } = await supabase
    .from('sdr_assistant_sessions')
    .select('*').eq('user_id', userId).order('updated_at', { ascending: false }).limit(20);
  if (error) return [];
  return (data || []).map(d => mapSession(d));
}

export async function fetchSDRAssistantSessionById(sessionId: string): Promise<SDRAssistantSession | null> {
  const { data, error } = await supabase
    .from('sdr_assistant_sessions')
    .select('*').eq('id', sessionId).maybeSingle();
  if (error || !data) return null;
  return mapSession(data);
}

export async function saveSDRAssistantSession(userId: string, messages: SDRAssistantMessage[], sessionId?: string): Promise<boolean> {
  try {
    const firstUserMessage = messages.find(m => m.role === 'user');
    const title = firstUserMessage
      ? firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
      : 'New conversation';
    const messagesJson = messages as unknown as Json;

    if (sessionId) {
      const { error } = await supabase
        .from('sdr_assistant_sessions')
        .update({ messages: messagesJson, title, updated_at: new Date().toISOString() }).eq('id', sessionId);
      if (error) throw error;
      return true;
    }

    const { data: existing } = await supabase
      .from('sdr_assistant_sessions')
      .select('id').eq('user_id', userId).eq('is_active', true).limit(1).maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('sdr_assistant_sessions')
        .update({ messages: messagesJson, title, updated_at: new Date().toISOString() }).eq('id', existing.id);
      if (error) throw error;
      return true;
    }

    const { error } = await supabase
      .from('sdr_assistant_sessions')
      .insert({ user_id: userId, messages: messagesJson, title, is_active: true });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[sdrAssistantSessions] Error saving session:', error);
    return false;
  }
}

export async function archiveAndStartNewSDRSession(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('sdr_assistant_sessions')
      .update({ is_active: false }).eq('user_id', userId).eq('is_active', true);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[sdrAssistantSessions] Error archiving:', error);
    return false;
  }
}

export async function switchToSDRSession(userId: string, sessionId: string): Promise<boolean> {
  try {
    await supabase
      .from('sdr_assistant_sessions')
      .update({ is_active: false }).eq('user_id', userId).eq('is_active', true);
    const { error } = await supabase
      .from('sdr_assistant_sessions')
      .update({ is_active: true }).eq('id', sessionId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[sdrAssistantSessions] Error switching:', error);
    return false;
  }
}

export async function deleteSDRAssistantSession(sessionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('sdr_assistant_sessions')
      .delete().eq('id', sessionId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[sdrAssistantSessions] Error deleting:', error);
    return false;
  }
}
