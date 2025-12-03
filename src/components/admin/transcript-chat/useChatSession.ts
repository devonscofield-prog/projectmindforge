import { useState, useEffect, useMemo } from 'react';
import { saveAnalysisSession, fetchSessionByTranscripts, AnalysisSession } from '@/api/analysisSessions';
import { ChatMessage } from '@/api/adminTranscriptChat';
import { useAuth } from '@/contexts/AuthContext';

interface UseChatSessionOptions {
  selectedTranscriptIds: string[];
  messages: ChatMessage[];
  selectedModeId: string;
  useRag: boolean;
}

export function useChatSession({ selectedTranscriptIds, messages, selectedModeId, useRag }: UseChatSessionOptions) {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [existingSession, setExistingSession] = useState<AnalysisSession | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);

  // Stabilize transcript IDs to prevent unnecessary re-fetches
  const stableTranscriptIds = useMemo(
    () => JSON.stringify([...selectedTranscriptIds].sort()),
    [selectedTranscriptIds]
  );

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      const ids = JSON.parse(stableTranscriptIds) as string[];
      if (ids.length === 0 || !user?.id) return;
      
      const session = await fetchSessionByTranscripts(user.id, ids);
      if (session && session.messages.length > 0) {
        setExistingSession(session);
        setShowResumePrompt(true);
      }
    };
    
    checkExistingSession();
  }, [stableTranscriptIds, user?.id]);

  // Auto-save session when messages change (debounced)
  useEffect(() => {
    if (messages.length === 0 || !user?.id) return;
    
    const saveTimeout = setTimeout(async () => {
      const newSessionId = await saveAnalysisSession(
        user.id,
        selectedTranscriptIds,
        messages,
        selectedModeId,
        useRag,
        sessionId || undefined
      );
      
      if (newSessionId && !sessionId) {
        setSessionId(newSessionId);
      }
      
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2000);
    }, 1000);
    
    return () => clearTimeout(saveTimeout);
  }, [messages, selectedModeId, useRag, selectedTranscriptIds, sessionId, user?.id]);

  const resumeSession = (onResume: (messages: ChatMessage[], mode: string) => void) => {
    if (existingSession) {
      onResume(existingSession.messages, existingSession.analysis_mode || 'general');
      setSessionId(existingSession.id);
    }
    setShowResumePrompt(false);
    setExistingSession(null);
  };

  const startFresh = () => {
    setShowResumePrompt(false);
    setExistingSession(null);
  };

  return {
    sessionId,
    existingSession,
    showResumePrompt,
    autoSaved,
    resumeSession,
    startFresh,
  };
}
