import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { streamAdminTranscriptChat, ChatMessage } from '@/api/adminTranscriptChat';
import { SaveInsightDialog } from '@/components/admin/SaveInsightDialog';
import { ExportChatDialog } from '@/components/admin/ExportChatDialog';
import { CreateCustomPresetDialog, getIconComponent } from '@/components/admin/CreateCustomPresetDialog';
import { 
  ANALYSIS_MODES, 
  MODE_PRESETS,
  getAnalysisModeById, 
  getPresetById,
  type ModePreset,
} from '@/components/admin/transcript-analysis/analysisModesConfig';
import { fetchCustomPresets, deleteCustomPreset, type CustomPreset } from '@/api/customPresets';
import { useToast } from '@/hooks/use-toast';
import { useRateLimitCountdown } from '@/hooks/useRateLimitCountdown';
import { RateLimitCountdown } from '@/components/ui/rate-limit-countdown';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Loader2,
  Sparkles,
  FileText,
  AlertCircle,
  Search,
  Lightbulb,
  Download,
  Layers,
  ArrowRight,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Share2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

export function TranscriptChatPanel({ selectedTranscripts, useRag = false, selectionId, onClose }: TranscriptChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveInsightOpen, setSaveInsightOpen] = useState(false);
  const [insightToSave, setInsightToSave] = useState<string>('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedModeId, setSelectedModeId] = useState('general');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  
  // Custom preset dialog state
  const [createPresetOpen, setCreatePresetOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<CustomPreset | null>(null);
  const [deletePresetId, setDeletePresetId] = useState<string | null>(null);
  
  // Mode switch confirmation state
  const [pendingModeChange, setPendingModeChange] = useState<{
    type: 'mode' | 'preset' | 'custom';
    id: string;
    prompt?: string;
  } | null>(null);
  const [showModeChangeConfirm, setShowModeChangeConfirm] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { secondsRemaining, isRateLimited, startCountdown } = useRateLimitCountdown(60);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch custom presets
  const { data: customPresets = [], isLoading: isLoadingPresets } = useQuery({
    queryKey: ['customPresets'],
    queryFn: fetchCustomPresets,
  });

  const selectedMode = getAnalysisModeById(selectedModeId) || ANALYSIS_MODES[0];
  const activePreset = activePresetId ? getPresetById(activePresetId) : null;
  const starterQuestions = selectedMode.starterQuestions;

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

  const sendMessage = useCallback(async (content: string, modeOverride?: string) => {
    if (!content.trim() || isLoading || isRateLimited || selectedTranscripts.length === 0) return;

    setError(null);
    const userMessage: ChatMessage = { role: 'user', content: content.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    let assistantContent = '';
    const modeToUse = modeOverride || selectedModeId;

    try {
      await streamAdminTranscriptChat({
        transcriptIds: selectedTranscripts.map(t => t.id),
        messages: newMessages,
        useRag,
        analysisMode: modeToUse,
        onDelta: (delta) => {
          assistantContent += delta;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return prev.map((m, i) => 
                i === prev.length - 1 ? { ...m, content: assistantContent } : m
              );
            }
            return [...prev, { role: 'assistant', content: assistantContent }];
          });
        },
        onDone: () => {
          setIsLoading(false);
        },
        onError: (err) => {
          setError(err);
          setIsLoading(false);
          if (err.toLowerCase().includes('rate limit')) {
            startCountdown(60);
            toast({
              title: 'Too many requests',
              description: 'Please wait before sending another message.',
              variant: 'destructive',
            });
          }
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
      setIsLoading(false);
    }
  }, [messages, isLoading, isRateLimited, selectedTranscripts, useRag, selectedModeId, toast, startCountdown]);

  const handleModeChange = (newModeId: string) => {
    if (messages.length > 0) {
      setPendingModeChange({ type: 'mode', id: newModeId });
      setShowModeChangeConfirm(true);
    } else {
      setSelectedModeId(newModeId);
      setActivePresetId(null);
    }
  };

  const handlePresetSelect = (preset: ModePreset) => {
    if (messages.length > 0) {
      setPendingModeChange({ type: 'preset', id: preset.id, prompt: preset.starterPrompt });
      setShowModeChangeConfirm(true);
    } else {
      executePreset(preset);
    }
  };

  const handleCustomPresetSelect = (preset: CustomPreset) => {
    if (messages.length > 0) {
      setPendingModeChange({ type: 'custom', id: preset.id, prompt: preset.starter_prompt });
      setShowModeChangeConfirm(true);
    } else {
      executeCustomPreset(preset);
    }
  };

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

  const confirmModeChange = () => {
    if (!pendingModeChange) return;
    
    if (pendingModeChange.type === 'mode') {
      setSelectedModeId(pendingModeChange.id);
      setActivePresetId(null);
      toast({
        title: 'Mode changed',
        description: 'Chat history preserved. New questions will use the selected mode.',
      });
    } else if (pendingModeChange.type === 'preset') {
      const preset = getPresetById(pendingModeChange.id);
      if (preset) {
        executePreset(preset);
      }
    } else if (pendingModeChange.type === 'custom') {
      const preset = customPresets.find(p => p.id === pendingModeChange.id);
      if (preset) {
        executeCustomPreset(preset);
      }
    }
    
    setPendingModeChange(null);
    setShowModeChangeConfirm(false);
  };

  const handleDeletePreset = async () => {
    if (!deletePresetId) return;
    
    try {
      await deleteCustomPreset(deletePresetId);
      queryClient.invalidateQueries({ queryKey: ['customPresets'] });
      toast({
        title: 'Preset deleted',
        description: 'The custom preset has been removed.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete preset',
        variant: 'destructive',
      });
    } finally {
      setDeletePresetId(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleStarterQuestion = (prompt: string) => {
    sendMessage(prompt);
  };

  const ModeIcon = selectedMode.icon;
  const pendingLabel = pendingModeChange?.type === 'mode' 
    ? getAnalysisModeById(pendingModeChange.id)?.label 
    : pendingModeChange?.type === 'preset'
    ? getPresetById(pendingModeChange.id)?.label
    : customPresets.find(p => p.id === pendingModeChange?.id)?.name;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <SheetHeader className="px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Transcript Analysis
            {useRag && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Search className="h-3 w-3" />
                RAG Mode
              </Badge>
            )}
          </SheetTitle>
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportDialogOpen(true)}
              className="gap-1"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          {selectedTranscripts.length} transcripts selected
          {!useRag && (
            <Badge variant="outline" className="text-xs">
              ~{Math.round(selectedTranscripts.reduce((sum, t) => sum + (t.raw_text?.length || 0), 0) / 4).toLocaleString()} tokens
            </Badge>
          )}
        </div>
        
        {/* Analysis Mode Selector */}
        <div className="pt-2">
          <Select value={selectedModeId} onValueChange={handleModeChange}>
            <SelectTrigger className="w-full bg-muted/50">
              <div className="flex items-center gap-2">
                <ModeIcon className="h-4 w-4 text-primary" />
                <SelectValue placeholder="Select analysis mode" />
                {activePreset && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    <Layers className="h-3 w-3 mr-1" />
                    {activePreset.label}
                  </Badge>
                )}
              </div>
            </SelectTrigger>
            <SelectContent>
              {ANALYSIS_MODES.map((mode) => {
                const Icon = mode.icon;
                return (
                  <SelectItem key={mode.id} value={mode.id}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <div className="flex flex-col items-start">
                        <span>{mode.label}</span>
                        <span className="text-xs text-muted-foreground">{mode.description}</span>
                      </div>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </SheetHeader>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 px-6">
        <div className="py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-6">
              {/* Built-in Presets */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  Comprehensive Reviews
                </p>
                <div className="grid gap-2">
                  {MODE_PRESETS.map((preset) => {
                    const PresetIcon = preset.icon;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => handlePresetSelect(preset)}
                        disabled={isLoading || isRateLimited}
                        className="flex items-start gap-3 p-3 text-left rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors disabled:opacity-50"
                      >
                        <PresetIcon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{preset.label}</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <span className="text-xs text-muted-foreground block mt-0.5">{preset.description}</span>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {preset.modeIds.map(id => {
                              const mode = getAnalysisModeById(id);
                              if (!mode) return null;
                              const MIcon = mode.icon;
                              return (
                                <Badge key={id} variant="outline" className="text-[10px] py-0 gap-0.5">
                                  <MIcon className="h-2.5 w-2.5" />
                                  {mode.label}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                    <Plus className="h-3 w-3" />
                    My Custom Presets
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingPreset(null);
                      setCreatePresetOpen(true);
                    }}
                    className="h-6 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    New
                  </Button>
                </div>
                
                {isLoadingPresets ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : customPresets.length === 0 ? (
                  <button
                    onClick={() => {
                      setEditingPreset(null);
                      setCreatePresetOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground rounded-lg border border-dashed hover:bg-muted/50 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Create your first custom preset
                  </button>
                ) : (
                  <div className="grid gap-2">
                    {customPresets.map((preset) => {
                      const PresetIcon = getIconComponent(preset.icon_name);
                      return (
                        <div
                          key={preset.id}
                          className="flex items-start gap-3 p-3 text-left rounded-lg border hover:bg-muted/50 transition-colors group"
                        >
                          <button
                            onClick={() => handleCustomPresetSelect(preset)}
                            disabled={isLoading || isRateLimited}
                            className="flex-1 flex items-start gap-3 text-left disabled:opacity-50"
                          >
                            <PresetIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{preset.name}</span>
                                {preset.is_shared && (
                                  <Share2 className="h-3 w-3 text-muted-foreground" />
                                )}
                              </div>
                              {preset.description && (
                                <span className="text-xs text-muted-foreground block mt-0.5">{preset.description}</span>
                              )}
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {preset.mode_ids.map(id => {
                                  const mode = getAnalysisModeById(id);
                                  if (!mode) return null;
                                  const MIcon = mode.icon;
                                  return (
                                    <Badge key={id} variant="outline" className="text-[10px] py-0 gap-0.5">
                                      <MIcon className="h-2.5 w-2.5" />
                                      {mode.label}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingPreset(preset);
                                  setCreatePresetOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeletePresetId(preset.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or ask a question</span>
                </div>
              </div>

              {/* Introduction */}
              <div className="text-center py-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mb-2">
                  <ModeIcon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm mb-1">{selectedMode.label}</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {selectedMode.description}
                </p>
              </div>

              {/* Starter Questions */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Suggested questions
                </p>
                <div className="grid gap-2">
                  {starterQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleStarterQuestion(q.prompt)}
                      disabled={isLoading || isRateLimited}
                      className="flex items-center gap-3 p-3 text-left text-sm rounded-lg border hover:bg-muted/50 transition-colors disabled:opacity-50"
                    >
                      <q.icon className="h-4 w-4 text-primary shrink-0" />
                      <span>{q.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((message, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-4 py-2 group relative",
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  {message.role === 'assistant' ? (
                    <>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown
                          components={{
                            strong: ({ children }) => (
                              <strong className="text-primary">{children}</strong>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                      {!isLoading && message.content && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 text-xs gap-1"
                          onClick={() => {
                            setInsightToSave(message.content);
                            setSaveInsightOpen(true);
                          }}
                        >
                          <Lightbulb className="h-3 w-3" />
                          Save Insight
                        </Button>
                      )}
                    </>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))
          )}

          {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t">
        {isRateLimited && (
          <div className="px-4 pt-3">
            <RateLimitCountdown secondsRemaining={secondsRemaining} />
          </div>
        )}
        <div className="p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRateLimited ? "Please wait..." : "Ask about these transcripts..."}
              disabled={isLoading || isRateLimited}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || isLoading || isRateLimited}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Responses are grounded only in the selected transcripts
          </p>
        </div>
      </div>

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
            <AlertDialogCancel onClick={() => setPendingModeChange(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmModeChange}>
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
