import { supabase } from '@/integrations/supabase/client';
import { toAnalysisSession } from '@/lib/supabaseAdapters';
import type { ChatMessage } from './adminTranscriptChat';
import type { Json } from '@/integrations/supabase/types';

export interface AnalysisSession {
  id: string;
  user_id: string;
  transcript_ids: string[];
  messages: ChatMessage[];
  analysis_mode: string | null;
  use_rag: boolean | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

// Lightweight session type for list views (excludes large messages array)
export interface AnalysisSessionListItem {
  id: string;
  user_id: string;
  transcript_ids: string[];
  analysis_mode: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export async function saveAnalysisSession(
  userId: string,
  transcriptIds: string[],
  messages: ChatMessage[],
  analysisMode: string = 'general',
  useRag: boolean = false,
  sessionId?: string
): Promise<string | null> {
  if (!userId) return null;
  
  const firstUserMessage = messages.find(m => m.role === 'user');
  const title = firstUserMessage 
    ? firstUserMessage.content.slice(0, 100) + (firstUserMessage.content.length > 100 ? '...' : '')
    : 'Analysis Session';
  
  const messagesJson = messages as unknown as Json;
  
  if (sessionId) {
    const { error } = await supabase
      .from('analysis_sessions')
      .update({
        messages: messagesJson,
        analysis_mode: analysisMode,
        use_rag: useRag,
        title,
      })
      .eq('id', sessionId)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Failed to update session:', error);
      return null;
    }
    return sessionId;
  } else {
    const { data, error } = await supabase
      .from('analysis_sessions')
      .insert({
        user_id: userId,
        transcript_ids: transcriptIds,
        messages: messagesJson,
        analysis_mode: analysisMode,
        use_rag: useRag,
        title,
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Failed to create session:', error);
      return null;
    }
    return data?.id || null;
  }
}

/**
 * Fetch recent sessions for list view - excludes large messages array
 * Uses compound index on (user_id, updated_at DESC) for optimal performance
 * Note: message_count is not available in list view to avoid fetching messages
 */
export async function fetchRecentSessionsForList(
  userId: string, 
  limit: number = 20
): Promise<AnalysisSessionListItem[]> {
  if (!userId) return [];
  
  const { data, error } = await supabase
    .from('analysis_sessions')
    .select('id, user_id, transcript_ids, analysis_mode, title, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Failed to fetch sessions:', error);
    return [];
  }
  
  return (data || []).map(session => ({
    id: session.id,
    user_id: session.user_id,
    transcript_ids: session.transcript_ids,
    analysis_mode: session.analysis_mode,
    title: session.title,
    created_at: session.created_at,
    updated_at: session.updated_at,
    message_count: 0, // Not available in list view - fetch full session for count
  }));
}

/**
 * @deprecated Use fetchRecentSessionsForList for list views
 * Kept for backward compatibility when full messages are needed
 */
export async function fetchRecentSessions(userId: string, limit: number = 10): Promise<AnalysisSession[]> {
  if (!userId) return [];
  
  const { data, error } = await supabase
    .from('analysis_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Failed to fetch sessions:', error);
    return [];
  }
  
  return (data || []).map(toAnalysisSession);
}

/**
 * Fetch a single session by ID with full messages
 * Use this when viewing session details
 */
export async function fetchSessionById(sessionId: string, userId: string): Promise<AnalysisSession | null> {
  if (!sessionId || !userId) return null;
  
  const { data, error } = await supabase
    .from('analysis_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();
  
  if (error || !data) {
    console.error('Failed to fetch session:', error);
    return null;
  }
  
  return toAnalysisSession(data);
}

/**
 * Find existing session by transcript IDs using database-level filtering
 * Uses Postgres array containment operator for efficient matching
 */
export async function fetchSessionByTranscripts(userId: string, transcriptIds: string[]): Promise<AnalysisSession | null> {
  if (!userId || !transcriptIds.length) return null;
  
  const sortedIds = [...transcriptIds].sort();
  
  // Use database-level array containment instead of client-side filtering
  const { data, error } = await supabase
    .from('analysis_sessions')
    .select('*')
    .eq('user_id', userId)
    .contains('transcript_ids', sortedIds)
    .order('updated_at', { ascending: false })
    .limit(5);
  
  if (error || !data) return null;
  
  // Find exact match (same length and same elements)
  const matchingSession = data.find(session => {
    const sessionIds = [...session.transcript_ids].sort();
    return sessionIds.length === sortedIds.length && 
           sessionIds.every((id, i) => id === sortedIds[i]);
  });
  
  if (!matchingSession) return null;
  
  return toAnalysisSession(matchingSession);
}

export async function deleteAnalysisSession(sessionId: string, userId: string): Promise<boolean> {
  if (!sessionId || !userId) return false;
  
  const { error } = await supabase
    .from('analysis_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId); // Defense in depth - ensure user owns session
  
  return !error;
}
