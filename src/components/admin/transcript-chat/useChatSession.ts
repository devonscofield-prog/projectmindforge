import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  saveAnalysisSession, 
  fetchActiveSession, 
  fetchAllAnalysisSessions,
  archiveAndStartNewAnalysisSession,
  switchToAnalysisSession,
  deleteAnalysisSession,
  fetchSessionById,
  type AnalysisSession,
  type AnalysisSessionListItem 
} from '@/api/analysisSessions';
import { ChatMessage } from '@/api/adminTranscriptChat';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
  const [allSessions, setAllSessions] = useState<AnalysisSessionListItem[]>([]);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [showHistorySheet, setShowHistorySheet] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

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
      
      // Fetch active session
      const session = await fetchActiveSession(user.id, ids);
      if (session && session.messages.length > 0) {
        setExistingSession(session);
        setShowResumePrompt(true);
      }
      
      // Fetch all sessions for history
      const sessions = await fetchAllAnalysisSessions(user.id, ids);
      setAllSessions(sessions);
      setHasLoadedHistory(true);
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
        // Refresh sessions list
        const sessions = await fetchAllAnalysisSessions(user.id, selectedTranscriptIds);
        setAllSessions(sessions);
      }
      
      setLastUpdated(new Date().toISOString());
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2000);
    }, 1000);
    
    return () => clearTimeout(saveTimeout);
  }, [messages, selectedModeId, useRag, selectedTranscriptIds, sessionId, user?.id]);

  const resumeSession = useCallback((onResume: (messages: ChatMessage[], mode: string) => void) => {
    if (existingSession) {
      onResume(existingSession.messages, existingSession.analysis_mode || 'general');
      setSessionId(existingSession.id);
      setLastUpdated(existingSession.updated_at);
    }
    setShowResumePrompt(false);
    setExistingSession(null);
  }, [existingSession]);

  const startFresh = useCallback(async () => {
    if (!user?.id) return;
    
    // Archive current active session
    await archiveAndStartNewAnalysisSession(user.id, selectedTranscriptIds);
    
    // Refresh sessions list
    const sessions = await fetchAllAnalysisSessions(user.id, selectedTranscriptIds);
    setAllSessions(sessions);
    
    setShowResumePrompt(false);
    setExistingSession(null);
    setSessionId(null);
    setLastUpdated(null);
  }, [user?.id, selectedTranscriptIds]);

  const handleNewChat = useCallback(async (clearMessages: () => void) => {
    if (!user?.id) return;
    
    if (messages.length > 0) {
      // Archive current session
      const success = await archiveAndStartNewAnalysisSession(user.id, selectedTranscriptIds);
      if (!success) {
        toast.error('Failed to start new chat');
        return;
      }
    }
    
    // Reset state
    clearMessages();
    setSessionId(null);
    setLastUpdated(null);
    
    // Refresh sessions list
    const sessions = await fetchAllAnalysisSessions(user.id, selectedTranscriptIds);
    setAllSessions(sessions);
    
    toast.success('Started new conversation');
  }, [user?.id, messages.length, selectedTranscriptIds]);

  const handleSwitchSession = useCallback(async (
    targetSessionId: string, 
    setMessages: (messages: ChatMessage[]) => void,
    setMode: (mode: string) => void
  ) => {
    if (!user?.id) return;
    
    const success = await switchToAnalysisSession(user.id, selectedTranscriptIds, targetSessionId);
    if (!success) {
      toast.error('Failed to switch chat');
      return;
    }
    
    // Load the selected session
    const session = await fetchSessionById(targetSessionId, user.id);
    if (session) {
      setMessages(session.messages);
      setMode(session.analysis_mode || 'general');
      setSessionId(session.id);
      setLastUpdated(session.updated_at);
    }
    
    // Refresh sessions list
    const sessions = await fetchAllAnalysisSessions(user.id, selectedTranscriptIds);
    setAllSessions(sessions);
    
    setShowHistorySheet(false);
    toast.success('Switched to previous conversation');
  }, [user?.id, selectedTranscriptIds]);

  const handleDeleteSession = useCallback(async (
    targetSessionId: string, 
    clearMessages?: () => void
  ) => {
    if (!user?.id) return;
    
    const success = await deleteAnalysisSession(targetSessionId, user.id);
    if (!success) {
      toast.error('Failed to delete chat');
      return;
    }
    
    // If deleting current session, reset state
    if (targetSessionId === sessionId && clearMessages) {
      clearMessages();
      setSessionId(null);
      setLastUpdated(null);
    }
    
    // Refresh sessions list
    const sessions = await fetchAllAnalysisSessions(user.id, selectedTranscriptIds);
    setAllSessions(sessions);
    
    toast.success('Chat deleted');
  }, [user?.id, sessionId, selectedTranscriptIds]);

  const archivedSessionsCount = useMemo(() => 
    allSessions.filter(s => s.id !== sessionId).length,
    [allSessions, sessionId]
  );

  return {
    sessionId,
    existingSession,
    allSessions,
    showResumePrompt,
    showHistorySheet,
    setShowHistorySheet,
    autoSaved,
    lastUpdated,
    hasLoadedHistory,
    archivedSessionsCount,
    resumeSession,
    startFresh,
    handleNewChat,
    handleSwitchSession,
    handleDeleteSession,
  };
}
