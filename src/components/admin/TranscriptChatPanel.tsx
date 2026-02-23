import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SaveInsightDialog } from './SaveInsightDialog';
import { ExportChatDialog } from './ExportChatDialog';
import { CreateCustomPresetDialog } from './CreateCustomPresetDialog';
import {
  useTranscriptChat,
  useChatSession,
  useModePresets,
  ChatHeader,
  ChatMessages,
  ChatInput,
  ModeSelector,
  SessionResumePrompt,
  ChatHistorySheet,
} from './transcript-chat';
import type { ModePreset } from './transcript-analysis/analysisModesConfig';
import type { CustomPreset } from '@/api/customPresets';

interface Transcript {
  id: string;
  call_date: string;
  account_name: string | null;
  call_type: string | null;
  raw_text: string;
  rep_id: string;
  rep_name?: string;
  team_name?: string;
}

interface TranscriptChatPanelProps {
  selectedTranscripts: Transcript[];
  useRag?: boolean;
  selectionId?: string | null;
  onClose: () => void;
}

export function TranscriptChatPanel({ selectedTranscripts, useRag = false, selectionId }: TranscriptChatPanelProps) {
  const [input, setInput] = useState('');
  const [saveInsightOpen, setSaveInsightOpen] = useState(false);
  const [insightToSave, setInsightToSave] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  const queryClient = useQueryClient();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Custom hooks for state management
  const {
    selectedModeId,
    setSelectedModeId,
    activePresetId: _activePresetId,
    setActivePresetId,
    selectedMode,
    activePreset,
    customPresets,
    isLoadingPresets,
    createPresetOpen,
    setCreatePresetOpen,
    editingPreset,
    setEditingPreset,
    deletePresetId,
    setDeletePresetId,
    showModeChangeConfirm,
    setShowModeChangeConfirm,
    pendingLabel,
    handleModeChange,
    handlePresetSelect,
    handleCustomPresetSelect,
    confirmModeChange,
    handleDeletePreset,
  } = useModePresets();

  const {
    messages,
    setMessages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    isRateLimited,
    secondsRemaining,
  } = useTranscriptChat({
    selectedTranscriptIds: selectedTranscripts.map(t => t.id),
    useRag,
    selectedModeId,
  });

  const {
    sessionId,
    existingSession,
    allSessions,
    showResumePrompt,
    showHistorySheet,
    setShowHistorySheet,
    autoSaved,
    lastUpdated,
    archivedSessionsCount,
    resumeSession,
    startFresh,
    handleNewChat,
    handleSwitchSession,
    handleDeleteSession,
  } = useChatSession({
    selectedTranscriptIds: selectedTranscripts.map(t => t.id),
    messages,
    selectedModeId,
    useRag,
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const executePreset = (preset: ModePreset) => {
    setActivePresetId(preset.id);
    setSelectedModeId(preset.modeIds[0]);
    sendMessage(preset.starterPrompt, preset.modeIds[0]);
  };

  const executeCustomPreset = (preset: CustomPreset) => {
    setActivePresetId(null);
    setSelectedModeId(preset.mode_ids[0] || 'general');
    sendMessage(preset.starter_prompt, preset.mode_ids[0] || 'general');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
      setInput('');
    }
  };

  const totalTokens = selectedTranscripts.reduce((sum, t) => sum + (t.raw_text?.length || 0), 0) / 4;

  if (!selectedMode) return null;

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        useRag={useRag}
        autoSaved={autoSaved}
        transcriptCount={selectedTranscripts.length}
        totalTokens={totalTokens}
        hasMessages={messages.length > 0}
        lastUpdated={lastUpdated}
        archivedSessionsCount={archivedSessionsCount}
        onExport={() => setExportDialogOpen(true)}
        onNewChat={() => handleNewChat(() => setMessages([]))}
        onShowHistory={() => setShowHistorySheet(true)}
        onDeleteChat={() => setDeleteConfirmOpen(true)}
      />

      <ModeSelector
        selectedMode={selectedMode}
        activePreset={activePreset || null}
        onModeChange={(modeId) => handleModeChange(modeId, messages.length > 0)}
      />

      {showResumePrompt && existingSession && (
        <SessionResumePrompt
          session={existingSession}
          onResume={() => resumeSession((msgs, mode) => {
            setMessages(msgs);
            setSelectedModeId(mode);
          })}
          onStartFresh={startFresh}
        />
      )}

      <ChatMessages
        messages={messages}
        isLoading={isLoading}
        isStreaming={isStreaming}
        isRateLimited={isRateLimited}
        error={error}
        selectedMode={selectedMode}
        customPresets={customPresets}
        isLoadingPresets={isLoadingPresets}
        scrollAreaRef={scrollAreaRef}
        onStarterQuestion={sendMessage}
        onPresetSelect={(preset) => handlePresetSelect(preset, messages.length > 0, executePreset)}
        onCustomPresetSelect={(preset) => handleCustomPresetSelect(preset, messages.length > 0, executeCustomPreset)}
        onSaveInsight={(content) => {
          setInsightToSave(content);
          setSaveInsightOpen(true);
        }}
        onCreatePreset={() => {
          setEditingPreset(null);
          setCreatePresetOpen(true);
        }}
        onEditPreset={(preset) => {
          setEditingPreset(preset);
          setCreatePresetOpen(true);
        }}
        onDeletePreset={setDeletePresetId}
      />

      <ChatInput
        input={input}
        isLoading={isLoading}
        isRateLimited={isRateLimited}
        secondsRemaining={secondsRemaining}
        inputRef={inputRef}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
      />

      {/* Chat History Sheet */}
      <ChatHistorySheet
        open={showHistorySheet}
        onOpenChange={setShowHistorySheet}
        sessions={allSessions}
        currentSessionId={sessionId}
        onSwitchSession={(id) => handleSwitchSession(id, setMessages, setSelectedModeId)}
        onDeleteSession={(id) => handleDeleteSession(id, id === sessionId ? () => setMessages([]) : undefined)}
      />

      {/* Delete Chat Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (sessionId) {
                  handleDeleteSession(sessionId, () => setMessages([]));
                }
                setDeleteConfirmOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mode Change Confirmation Dialog */}
      <AlertDialog open={showModeChangeConfirm} onOpenChange={setShowModeChangeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch analysis mode?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an active conversation. Switching to <strong>{pendingLabel}</strong> will 
              keep your chat history, but new questions will use the new mode's specialized prompts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmModeChange(executePreset, executeCustomPreset)}>
              Switch Mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Preset Confirmation Dialog */}
      <AlertDialog open={!!deletePresetId} onOpenChange={(open) => !open && setDeletePresetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete custom preset?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The preset will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePreset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create/Edit Preset Dialog */}
      <CreateCustomPresetDialog
        open={createPresetOpen}
        onOpenChange={setCreatePresetOpen}
        editingPreset={editingPreset}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['customPresets'] });
          setEditingPreset(null);
        }}
      />

      {/* Save Insight Dialog */}
      <SaveInsightDialog
        open={saveInsightOpen}
        onOpenChange={setSaveInsightOpen}
        content={insightToSave}
        chatContext={messages}
        selectionId={selectionId}
      />

      {/* Export Chat Dialog */}
      <ExportChatDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        messages={messages}
        selectedTranscripts={selectedTranscripts}
        useRag={useRag}
      />
    </div>
  );
}
