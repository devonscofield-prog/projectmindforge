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

export async function saveAnalysisSession(
  transcriptIds: string[],
  messages: ChatMessage[],
  analysisMode: string = 'general',
  useRag: boolean = false,
  sessionId?: string
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  // Generate a title from the first user message
  const firstUserMessage = messages.find(m => m.role === 'user');
  const title = firstUserMessage 
    ? firstUserMessage.content.slice(0, 100) + (firstUserMessage.content.length > 100 ? '...' : '')
    : 'Analysis Session';
  
  // Convert messages to Json type (requires intermediate unknown cast for type safety)
  const messagesJson = messages as unknown as Json;
  
  if (sessionId) {
    // Update existing session
    const { error } = await supabase
      .from('analysis_sessions')
      .update({
        messages: messagesJson,
        analysis_mode: analysisMode,
        use_rag: useRag,
        title,
      })
      .eq('id', sessionId)
      .eq('user_id', user.id);
    
    if (error) {
      console.error('Failed to update session:', error);
      return null;
    }
    return sessionId;
  } else {
    // Create new session
    const { data, error } = await supabase
      .from('analysis_sessions')
      .insert({
        user_id: user.id,
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

export async function fetchRecentSessions(limit: number = 10): Promise<AnalysisSession[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  
  const { data, error } = await supabase
    .from('analysis_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Failed to fetch sessions:', error);
    return [];
  }
  
  return (data || []).map(toAnalysisSession);
}

export async function fetchSessionByTranscripts(transcriptIds: string[]): Promise<AnalysisSession | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  // Sort IDs for consistent comparison
  const sortedIds = [...transcriptIds].sort();
  
  const { data, error } = await supabase
    .from('analysis_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(20);
  
  if (error || !data) return null;
  
  // Find session with matching transcript IDs
  const matchingSession = data.find(session => {
    const sessionIds = [...session.transcript_ids].sort();
    return sessionIds.length === sortedIds.length && 
           sessionIds.every((id, i) => id === sortedIds[i]);
  });
  
  if (!matchingSession) return null;
  
  return toAnalysisSession(matchingSession);
}

export async function deleteAnalysisSession(sessionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('analysis_sessions')
    .delete()
    .eq('id', sessionId);
  
  return !error;
}
