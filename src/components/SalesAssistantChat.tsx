import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Loader2, Sparkles, User, Trash2, History, Plus, MoreVertical, MessageSquare, Target, TrendingUp, Calendar, Flame, ClipboardList, Building2 } from 'lucide-react';
import { streamAssistantResponse, type ChatMessage } from '@/api/salesAssistant';
import { 
  fetchAssistantSession, 
  saveAssistantSession, 
  fetchAllAssistantSessions,
  archiveAndStartNewSession,
  switchToSession,
  deleteAssistantSession,
  type AssistantMessage,
  type AssistantSession 
} from '@/api/salesAssistantSessions';
import { toast } from 'sonner';
import { useRateLimitCountdown } from '@/hooks/useRateLimitCountdown';
import { RateLimitCountdown } from '@/components/ui/rate-limit-countdown';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

// Typing indicator component with animated dots
const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-2">
    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
);

interface QuickAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'pipeline',
    icon: <TrendingUp className="h-4 w-4" />,
    label: 'Pipeline Health',
    prompt: 'Give me a quick health check on my entire pipeline. What\'s working, what needs attention, and what should I prioritize this week?',
  },
  {
    id: 'tasks',
    icon: <ClipboardList className="h-4 w-4" />,
    label: 'Priority Tasks',
    prompt: 'What are the most urgent follow-ups and tasks I should focus on today across all my accounts?',
  },
  {
    id: 'hot-deals',
    icon: <Flame className="h-4 w-4" />,
    label: 'Hot Deals',
    prompt: 'Which of my deals are hottest right now? Give me a summary of my top opportunities and what I should do to close them.',
  },
  {
    id: 'weekly-plan',
    icon: <Calendar className="h-4 w-4" />,
    label: 'Weekly Plan',
    prompt: 'Help me plan my week. What calls should I prioritize, what follow-ups are due, and which accounts need attention?',
  },
];

export function SalesAssistantChat() {
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
  const [allSessions, setAllSessions] = useState<AssistantSession[]>([]);
  const [showHistorySheet, setShowHistorySheet] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { secondsRemaining, isRateLimited, startCountdown } = useRateLimitCountdown(60);

  // Load session when sheet opens
  useEffect(() => {
    const loadSession = async () => {
      if (!isOpen || !user?.id || hasLoadedHistory) return;
      
      setIsLoadingHistory(true);
      try {
        const session = await fetchAssistantSession(user.id);
        if (session && session.messages.length > 0) {
          setMessages(session.messages);
          setLastUpdated(session.updated_at);
          setCurrentSessionId(session.id);
        }
        const sessions = await fetchAllAssistantSessions(user.id);
        setAllSessions(sessions);
      } catch (err) {
        console.error('[SalesAssistant] Failed to load session:', err);
      } finally {
        setHasLoadedHistory(true);
        setIsLoadingHistory(false);
      }
    };

    loadSession();
  }, [isOpen, user?.id, hasLoadedHistory]);

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

  // Save session after messages change
  const saveSession = useCallback(async (messagesToSave: AssistantMessage[]) => {
    if (!user?.id || messagesToSave.length === 0) return;
    await saveAssistantSession(user.id, messagesToSave, currentSessionId ?? undefined);
  }, [user?.id, currentSessionId]);

  const handleNewChat = async () => {
    if (!user?.id) return;
    
    if (messages.length > 0) {
      const success = await archiveAndStartNewSession(user.id);
      if (!success) {
        toast.error('Failed to start new chat');
        return;
      }
    }
    
    setMessages([]);
    setLastUpdated(null);
    setCurrentSessionId(null);
    
    const sessions = await fetchAllAssistantSessions(user.id);
    setAllSessions(sessions);
    
    toast.success('Started new conversation');
  };

  const handleSwitchSession = async (sessionId: string) => {
    if (!user?.id) return;
    
    const success = await switchToSession(user.id, sessionId);
    if (!success) {
      toast.error('Failed to switch chat');
      return;
    }
    
    const sessions = await fetchAllAssistantSessions(user.id);
    setAllSessions(sessions);
    
    const selectedSession = sessions.find(s => s.id === sessionId);
    if (selectedSession) {
      setMessages(selectedSession.messages);
      setLastUpdated(selectedSession.updated_at);
      setCurrentSessionId(selectedSession.id);
    }
    
    setShowHistorySheet(false);
    toast.success('Switched to previous conversation');
  };

  const handleDeleteSession = async (sessionId: string) => {
    const success = await deleteAssistantSession(sessionId);
    if (!success) {
      toast.error('Failed to delete chat');
      return;
    }
    
    if (sessionId === currentSessionId) {
      setMessages([]);
      setLastUpdated(null);
      setCurrentSessionId(null);
    }
    
    if (user?.id) {
      const sessions = await fetchAllAssistantSessions(user.id);
      setAllSessions(sessions);
    }
    
    toast.success('Chat deleted');
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading || isRateLimited) return;

    const userMessage: ChatMessage = { role: 'user', content: content.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
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
      await streamAssistantResponse({
        messages: newMessages,
        onDelta: updateAssistant,
        onDone: async () => {
          setIsLoading(false);
          const finalMessages = [...newMessages, { role: 'assistant' as const, content: assistantContent }];
          await saveSession(finalMessages);
          setLastUpdated(new Date().toISOString());
          if (user?.id) {
            const sessions = await fetchAllAssistantSessions(user.id);
            setAllSessions(sessions);
            if (!currentSessionId && sessions.length > 0) {
              const activeSession = sessions.find(s => s.is_active);
              if (activeSession) {
                setCurrentSessionId(activeSession.id);
              }
            }
          }
        },
        onError: (err) => {
          setError(err);
          setIsLoading(false);
          if (err.toLowerCase().includes('rate limit')) {
            startCountdown();
          }
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickAction = (action: QuickAction) => {
    sendMessage(action.prompt);
  };

  const floatingButton = (
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
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-lg p-0 flex flex-col bg-gradient-to-b from-background via-background to-muted/20"
        >
          {/* Premium Header */}
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
                    Sales Assistant
                  </SheetTitle>
                  <p className="text-xs text-primary-foreground/80">
                    Your AI pipeline advisor
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
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
              </div>
            </div>
          </SheetHeader>

          {/* Chat Content */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {isLoadingHistory ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              /* Empty State with Quick Actions */
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {/* Welcome Card */}
                  <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-transparent rounded-xl p-4 border border-primary/10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">Pipeline Overview</h3>
                        <p className="text-xs text-muted-foreground">I can see all your accounts</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Ask me about your pipeline health, priority tasks, hot deals, or help planning your week.
                    </p>
                  </div>

                  {/* Quick Actions */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground px-1">Quick Actions</p>
                    <div className="grid grid-cols-2 gap-2">
                      {QUICK_ACTIONS.map((action) => (
                        <Button
                          key={action.id}
                          variant="outline"
                          className="h-auto py-3 px-3 flex flex-col items-start gap-1 text-left hover:bg-primary/5 hover:border-primary/30 transition-colors"
                          onClick={() => handleQuickAction(action)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-primary">{action.icon}</span>
                            <span className="font-medium text-sm">{action.label}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              /* Messages List */
              <ScrollArea className="flex-1 px-4" ref={scrollRef}>
                <div className="py-4 space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex gap-3",
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {message.role === 'assistant' && (
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs">
                            <Sparkles className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-2.5",
                          message.role === 'user'
                            ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-br-md"
                            : "bg-muted/80 text-foreground rounded-bl-md"
                        )}
                      >
                        {message.role === 'assistant' ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        )}
                      </div>
                      {message.role === 'user' && (
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-muted">
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                  {isLoading && messages[messages.length - 1]?.role === 'user' && (
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs">
                          <Sparkles className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-muted/80 rounded-2xl rounded-bl-md px-4 py-3">
                        <TypingIndicator />
                      </div>
                    </div>
                  )}
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
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your pipeline..."
                  disabled={isLoading || isRateLimited}
                  className="flex-1 bg-muted/50 border-muted-foreground/20"
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
              {lastUpdated && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Last updated {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
                </p>
              )}
            </div>
          </div>

          {/* History Sheet */}
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
        </SheetContent>
      </Sheet>
    </>
  );
}
