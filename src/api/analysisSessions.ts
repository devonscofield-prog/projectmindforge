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
  is_active: boolean | null;
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
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
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
        is_active: true,
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
 * Fetch the currently active session for a user + transcript set
 */
export async function fetchActiveSession(
  userId: string, 
  transcriptIds: string[]
): Promise<AnalysisSession | null> {
  if (!userId || !transcriptIds.length) return null;
  
  const sortedIds = [...transcriptIds].sort();
  
  const { data, error } = await supabase
    .from('analysis_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .contains('transcript_ids', sortedIds)
    .order('updated_at', { ascending: false })
    .limit(5);
  
  if (error || !data) return null;
  
  // Find exact match
  const matchingSession = data.find(session => {
    const sessionIds = [...session.transcript_ids].sort();
    return sessionIds.length === sortedIds.length && 
           sessionIds.every((id, i) => id === sortedIds[i]);
  });
  
  if (!matchingSession) return null;
  
  return toAnalysisSession(matchingSession);
}

/**
 * Fetch all sessions for a user + transcript set (for history)
 */
export async function fetchAllAnalysisSessions(
  userId: string, 
  transcriptIds: string[]
): Promise<AnalysisSessionListItem[]> {
  if (!userId || !transcriptIds.length) return [];
  
  const sortedIds = [...transcriptIds].sort();
  
  const { data, error } = await supabase
    .from('analysis_sessions')
    .select('id, user_id, transcript_ids, analysis_mode, title, is_active, created_at, updated_at')
    .eq('user_id', userId)
    .contains('transcript_ids', sortedIds)
    .order('updated_at', { ascending: false })
    .limit(50);
  
  if (error || !data) return [];
  
  // Filter to exact matches
  return data.filter(session => {
    const sessionIds = [...session.transcript_ids].sort();
    return sessionIds.length === sortedIds.length && 
           sessionIds.every((id, i) => id === sortedIds[i]);
  }).map(session => ({
    id: session.id,
    user_id: session.user_id,
    transcript_ids: session.transcript_ids,
    analysis_mode: session.analysis_mode,
    title: session.title,
    is_active: session.is_active,
    created_at: session.created_at,
    updated_at: session.updated_at,
  }));
}

/**
 * Archive current active session and prepare for new one
 */
export async function archiveAndStartNewAnalysisSession(
  userId: string, 
  transcriptIds: string[]
): Promise<boolean> {
  if (!userId || !transcriptIds.length) return false;
  
  const sortedIds = [...transcriptIds].sort();
  
  // Get all active sessions for this user/transcript combo
  const { data: activeSessions } = await supabase
    .from('analysis_sessions')
    .select('id, transcript_ids')
    .eq('user_id', userId)
    .eq('is_active', true)
    .contains('transcript_ids', sortedIds);
  
  if (!activeSessions) return true;
  
  // Filter to exact matches and archive them
  const exactMatches = activeSessions.filter(session => {
    const sessionIds = [...session.transcript_ids].sort();
    return sessionIds.length === sortedIds.length && 
           sessionIds.every((id, i) => id === sortedIds[i]);
  });
  
  if (exactMatches.length === 0) return true;
  
  const { error } = await supabase
    .from('analysis_sessions')
    .update({ is_active: false })
    .in('id', exactMatches.map(s => s.id));
  
  return !error;
}

/**
 * Switch to a different session (archive others, activate this one)
 */
export async function switchToAnalysisSession(
  userId: string, 
  transcriptIds: string[],
  sessionId: string
): Promise<boolean> {
  if (!userId || !sessionId) return false;
  
  // First archive all active sessions for this transcript set
  await archiveAndStartNewAnalysisSession(userId, transcriptIds);
  
  // Then activate the selected session
  const { error } = await supabase
    .from('analysis_sessions')
    .update({ is_active: true })
    .eq('id', sessionId)
    .eq('user_id', userId);
  
  return !error;
}

/**
 * Fetch recent sessions for list view - excludes large messages array
 * Uses compound index on (user_id, updated_at DESC) for optimal performance
 */
export async function fetchRecentSessionsForList(
  userId: string, 
  limit: number = 20
): Promise<AnalysisSessionListItem[]> {
  if (!userId) return [];
  
  const { data, error } = await supabase
    .from('analysis_sessions')
    .select('id, user_id, transcript_ids, analysis_mode, title, is_active, created_at, updated_at')
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
    is_active: session.is_active,
    created_at: session.created_at,
    updated_at: session.updated_at,
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
 * @deprecated Use fetchActiveSession instead for multi-session support
 */
export async function fetchSessionByTranscripts(userId: string, transcriptIds: string[]): Promise<AnalysisSession | null> {
  return fetchActiveSession(userId, transcriptIds);
}

export async function deleteAnalysisSession(sessionId: string, userId: string): Promise<boolean> {
  if (!sessionId || !userId) return false;
  
  const { error } = await supabase
    .from('analysis_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId);
  
  return !error;
}
