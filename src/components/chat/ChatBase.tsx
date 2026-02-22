import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Loader2, Sparkles, User, Trash2, History, Plus, MoreVertical, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useRateLimitCountdown } from '@/hooks/useRateLimitCountdown';
import { RateLimitCountdown } from '@/components/ui/rate-limit-countdown';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import type { ChatAdapter, ChatMessage, ChatSession } from './types';

// Typing indicator component with animated dots
const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-2">
    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
);

interface ChatBaseProps {
  adapter: ChatAdapter;
}

export function ChatBase({ adapter }: ChatBaseProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [allSessions, setAllSessions] = useState<ChatSession[]>([]);
  const [showHistorySheet, setShowHistorySheet] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { secondsRemaining, isRateLimited, startCountdown } = useRateLimitCountdown(
    adapter.rateLimitSeconds ?? 60
  );

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Load session when sheet opens
  useEffect(() => {
    const loadSession = async () => {
      if (!isOpen || !user?.id || hasLoadedHistory) return;

      setIsLoadingHistory(true);
      try {
        const session = await adapter.loadActiveSession();
        if (session && session.messages.length > 0) {
          setMessages(session.messages);
          setLastUpdated(session.updated_at);
          setCurrentSessionId(session.id);
        }
        const sessions = await adapter.loadAllSessions();
        setAllSessions(sessions);
      } catch (err) {
        console.error('[ChatBase] Failed to load session:', err);
      } finally {
        setHasLoadedHistory(true);
        setIsLoadingHistory(false);
      }
    };

    loadSession();
  }, [isOpen, user?.id, hasLoadedHistory, adapter]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when sheet opens and history is loaded
  useEffect(() => {
    if (isOpen && inputRef.current && hasLoadedHistory && !isLoadingHistory) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, hasLoadedHistory, isLoadingHistory]);

  const refreshSessions = useCallback(async () => {
    const sessions = await adapter.loadAllSessions();
    setAllSessions(sessions);
    return sessions;
  }, [adapter]);

  const handleNewChat = useCallback(async () => {
    if (!user?.id) return;

    if (messages.length > 0) {
      const success = await adapter.archiveSession();
      if (!success) {
        toast.error('Failed to start new chat');
        return;
      }
    }

    setMessages([]);
    setLastUpdated(null);
    setCurrentSessionId(null);

    await refreshSessions();
    toast.success('Started new conversation');
  }, [user?.id, messages.length, adapter, refreshSessions]);

  const handleSwitchSession = useCallback(async (sessionId: string) => {
    if (!user?.id) return;

    const success = await adapter.switchSession(sessionId);
    if (!success) {
      toast.error('Failed to switch chat');
      return;
    }

    const sessions = await refreshSessions();
    const selectedSession = sessions.find(s => s.id === sessionId);
    if (selectedSession) {
      setMessages(selectedSession.messages);
      setLastUpdated(selectedSession.updated_at);
      setCurrentSessionId(selectedSession.id);
    }

    setShowHistorySheet(false);
    toast.success('Switched to previous conversation');
  }, [user?.id, adapter, refreshSessions]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    const success = await adapter.deleteSession(sessionId);
    if (!success) {
      toast.error('Failed to delete chat');
      return;
    }

    if (sessionId === currentSessionId) {
      setMessages([]);
      setLastUpdated(null);
      setCurrentSessionId(null);
    }

    await refreshSessions();
    toast.success('Chat deleted');
  }, [adapter, currentSessionId, refreshSessions]);

  const handleClearHistory = useCallback(async () => {
    if (!currentSessionId) return;
    await handleDeleteSession(currentSessionId);
  }, [currentSessionId, handleDeleteSession]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading || isRateLimited) return;

    const userMessage: ChatMessage = { role: 'user', content: content.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    adapter.onMessageSent?.(content.trim());
    setError(null);
    setIsLoading(true);

    let assistantContent = '';

    const updateAssistant = (delta: string) => {
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
    };

    try {
      await adapter.sendMessage(newMessages, {
        onDelta: updateAssistant,
        onDone: async () => {
          setIsLoading(false);
          const finalMessages = [...newMessages, { role: 'assistant' as const, content: assistantContent }];
          await adapter.saveSession(finalMessages, currentSessionId ?? undefined);
          setLastUpdated(new Date().toISOString());
          const sessions = await refreshSessions();
          if (!currentSessionId && sessions.length > 0) {
            const activeSession = sessions.find(s => s.is_active);
            if (activeSession) {
              setCurrentSessionId(activeSession.id);
            }
          }
        },
        onError: (err) => {
          setError(err);
          setIsLoading(false);
          if (err.toLowerCase().includes('rate limit')) {
            startCountdown();
          }
          adapter.onStreamError?.(err, handleNewChat);
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';

      if (adapter.onStreamError) {
        adapter.onStreamError(errorMessage, handleNewChat);
        setError(errorMessage);
      } else {
        setError(errorMessage);
      }
      setIsLoading(false);
    }
  }, [messages, isLoading, isRateLimited, adapter, currentSessionId, refreshSessions, startCountdown, handleNewChat]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const archivedSessions = allSessions.filter(s => !s.is_active);

  // --- Default renderers ---
  const renderAssistantMsg = adapter.renderAssistantMessage ?? ((content: string) => (
    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  ));

  const renderUserMsg = adapter.renderUserMessage ?? ((content: string) => (
    <p className="text-sm whitespace-pre-wrap">{content}</p>
  ));

  // --- Default header menu ---
  const renderHeaderMenu = () => {
    if (adapter.headerMenuItems) {
      return adapter.headerMenuItems({
        handleNewChat,
        handleDeleteSession,
        setShowHistorySheet,
        currentSessionId,
        archivedSessions,
        messages,
      });
    }

    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
          onClick={handleNewChat}
          title="New conversation"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowHistorySheet(true)}>
              <History className="h-4 w-4 mr-2" />
              Chat History
            </DropdownMenuItem>
            {currentSessionId && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleDeleteSession(currentSessionId)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Chat
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  };

  // --- Default history sheet ---
  const renderDefaultHistory = () => {
    if (adapter.renderHistorySheet) {
      return adapter.renderHistorySheet({
        allSessions,
        currentSessionId,
        handleSwitchSession,
        handleDeleteSession,
        setShowHistorySheet,
      });
    }

    return (
      <Sheet open={showHistorySheet} onOpenChange={setShowHistorySheet}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Chat History</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
            <div className="space-y-2 pr-4">
              {allSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No previous conversations
                </p>
              ) : (
                allSessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-colors",
                      session.is_active
                        ? "bg-primary/5 border-primary/30"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => handleSwitchSession(session.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                          <p className="text-sm font-medium truncate">
                            {session.title || 'Untitled conversation'}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {session.messages.length} messages · {formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  };

  // --- Loading history state ---
  const renderLoadingState = () => {
    if (adapter.loadingHistoryState) return adapter.loadingHistoryState;
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  };

  // --- Messages rendering ---
  const renderMessages = () => (
    <>
      {adapter.messagesHeader?.(lastUpdated)}
      {messages.map((message, index) => (
        <div
          key={index}
          className={cn(
            "flex gap-3",
            message.role === 'user' ? 'justify-end' : 'justify-start'
          )}
        >
          {message.role === 'assistant' && (
            <Avatar className={cn("h-8 w-8 shrink-0", adapter.assistantAvatarClass)}>
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs">
                <Sparkles className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          )}
          <div
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-2.5",
              message.role === 'user'
                ? cn("bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-br-md", adapter.userBubbleClass)
                : cn("bg-muted/80 text-foreground rounded-bl-md", adapter.assistantBubbleClass)
            )}
          >
            {message.role === 'assistant'
              ? renderAssistantMsg(message.content)
              : renderUserMsg(message.content)
            }
          </div>
          {message.role === 'user' && (
            <Avatar className={cn("h-8 w-8 shrink-0", adapter.userAvatarClass)}>
              <AvatarFallback className="bg-muted">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      ))}
      {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
        <div className="flex gap-3">
          <Avatar className={cn("h-8 w-8 shrink-0", adapter.assistantAvatarClass)}>
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs">
              <Sparkles className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className={cn("bg-muted/80 rounded-2xl rounded-bl-md px-4 py-3", adapter.typingBubbleClass)}>
            <TypingIndicator />
          </div>
        </div>
      )}
    </>
  );

  // --- Build the sheet content ---
  const sheetContent = (
    <SheetContent
      side="right"
      className={cn(
        "w-full p-0 flex flex-col bg-gradient-to-b from-background via-background to-muted/20",
        adapter.sheetMaxWidth ?? "sm:max-w-lg",
        adapter.portalMode === 'full-portal' && "h-full max-h-[100dvh] overflow-hidden"
      )}
    >
      {/* Header */}
      <SheetHeader className="px-4 py-4 border-b bg-gradient-to-r from-primary via-primary/95 to-accent text-primary-foreground shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-primary animate-pulse" />
            </div>
            <div>
              <SheetTitle className="text-primary-foreground text-lg font-semibold">
                {adapter.headerTitle}
              </SheetTitle>
              <p className="text-xs text-primary-foreground/80">
                {adapter.headerSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {adapter.headerExtra}
            {renderHeaderMenu()}
          </div>
        </div>
      </SheetHeader>

      {/* Chat Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {isLoadingHistory ? (
          renderLoadingState()
        ) : messages.length === 0 ? (
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {adapter.emptyState({
                setInput,
                focusInput,
                isLoading,
                isRateLimited,
              })}
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea className="flex-1 px-4" ref={scrollRef}>
            <div className="py-4 space-y-4">
              {renderMessages()}
            </div>
          </ScrollArea>
        )}

        {/* Error Display */}
        {error && (
          <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Rate Limit Display */}
        {isRateLimited && (
          <div className="px-4 py-2">
            <RateLimitCountdown secondsRemaining={secondsRemaining} />
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t bg-background/80 backdrop-blur-sm shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRateLimited ? "Please wait..." : adapter.placeholder}
              disabled={isLoading || isRateLimited}
              rows={1}
              className="flex-1 min-h-[40px] max-h-[120px] bg-muted/50 border-muted-foreground/20 resize-none py-2.5"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading || isRateLimited}
              className="shrink-0 bg-primary hover:bg-primary/90"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          {(adapter.showLastUpdated !== false) && lastUpdated && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Last updated {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
            </p>
          )}
          {adapter.inputFooter}
        </div>
      </div>

      {/* History Sheet */}
      {renderDefaultHistory()}
    </SheetContent>
  );

  // --- Render based on portal mode ---
  if (adapter.portalMode === 'full-portal') {
    return createPortal(
      <>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          {adapter.triggerButton ?? (
            <Button
              size="lg"
              className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-primary via-primary/95 to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-300 hover:scale-105 hover:shadow-xl md:bottom-8 md:right-8"
              onClick={() => setIsOpen(true)}
            >
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </Button>
          )}
          {sheetContent}
        </Sheet>
      </>,
      document.body
    );
  }

  // Default: floating-button mode (SalesAssistantChat pattern)
  const floatingButton = adapter.triggerButton ?? (
    <Button
      size="lg"
      className={cn(
        "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg",
        "bg-gradient-to-r from-primary via-primary/95 to-accent hover:from-primary/90 hover:to-accent/90",
        "transition-all duration-300 hover:scale-105 hover:shadow-xl",
        "md:bottom-8 md:right-8"
      )}
      onClick={() => setIsOpen(true)}
    >
      <Sparkles className="h-6 w-6 text-primary-foreground" />
    </Button>
  );

  return (
    <>
      {!isOpen && createPortal(floatingButton, document.body)}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        {sheetContent}
      </Sheet>
    </>
  );
}
