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
import { Send, Loader2, Sparkles, User, Trash2, History, Plus, MoreVertical, MessageSquare, TrendingUp, Target, Award, BookOpen, Users, BarChart3, AlertTriangle, Lightbulb } from 'lucide-react';
import { streamSDRAssistantResponse, type ChatMessage } from '@/api/sdrAssistant';
import {
  fetchSDRAssistantSession,
  saveSDRAssistantSession,
  fetchAllSDRAssistantSessions,
  archiveAndStartNewSDRSession,
  switchToSDRSession,
  deleteSDRAssistantSession,
  type SDRAssistantMessage,
  type SDRAssistantSession,
} from '@/api/sdrAssistantSessions';
import { toast } from 'sonner';
import { useRateLimitCountdown } from '@/hooks/useRateLimitCountdown';
import { RateLimitCountdown } from '@/components/ui/rate-limit-countdown';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { formatDistanceToNow } from 'date-fns';

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

const MANAGER_QUICK_ACTIONS: QuickAction[] = [
  { id: 'team-perf', icon: <Users className="h-4 w-4" />, label: 'Team Performance', prompt: 'Give me a summary of my team\'s performance. Who are my top performers and who needs the most coaching right now?' },
  { id: 'coaching', icon: <AlertTriangle className="h-4 w-4" />, label: 'Coaching Opportunities', prompt: 'What are the biggest coaching opportunities across my team? Which reps have the most D and F grades and what patterns do you see in their calls?' },
  { id: 'grades', icon: <BarChart3 className="h-4 w-4" />, label: 'Grade Trends', prompt: 'How are my team\'s grades trending? Are reps improving or declining? Show me the data.' },
  { id: 'weakest', icon: <Target className="h-4 w-4" />, label: 'Weakest Areas', prompt: 'What are the most common improvement areas across my entire team? Where should I focus team-wide training?' },
];

const SDR_QUICK_ACTIONS: QuickAction[] = [
  { id: 'my-perf', icon: <TrendingUp className="h-4 w-4" />, label: 'My Performance', prompt: 'How am I performing overall? Give me a summary of my grades, scores, and any trends you see.' },
  { id: 'improve', icon: <Lightbulb className="h-4 w-4" />, label: 'Improve My Calls', prompt: 'Based on my recent call grades, what are the top 3 things I should focus on to improve my calls?' },
  { id: 'grades', icon: <Award className="h-4 w-4" />, label: 'Recent Grades', prompt: 'Walk me through my most recent graded calls. What did I do well and where did I struggle?' },
  { id: 'tips', icon: <BookOpen className="h-4 w-4" />, label: 'Best Practices', prompt: 'Based on my strongest calls, what are the best practices I should repeat on every call?' },
];

export function SDRAssistantChat() {
  const { user } = useAuth();
  const { data: userRole } = useUserRole(user?.id);
  const isManager = userRole === 'sdr_manager';
  
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [allSessions, setAllSessions] = useState<SDRAssistantSession[]>([]);
  const [showHistorySheet, setShowHistorySheet] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { secondsRemaining, isRateLimited, startCountdown } = useRateLimitCountdown(60);

  const quickActions = isManager ? MANAGER_QUICK_ACTIONS : SDR_QUICK_ACTIONS;
  const title = isManager ? 'SDR Coach' : 'SDR Coach';
  const subtitle = isManager ? 'Team coaching assistant' : 'Your personal call coach';

  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input]);

  useEffect(() => {
    const loadSession = async () => {
      if (!isOpen || !user?.id || hasLoadedHistory) return;
      setIsLoadingHistory(true);
      try {
        const session = await fetchSDRAssistantSession(user.id);
        if (session && session.messages.length > 0) {
          setMessages(session.messages);
          setLastUpdated(session.updated_at);
          setCurrentSessionId(session.id);
        }
        const sessions = await fetchAllSDRAssistantSessions(user.id);
        setAllSessions(sessions);
      } catch (err) {
        console.error('[SDRAssistant] Failed to load session:', err);
      } finally {
        setHasLoadedHistory(true);
        setIsLoadingHistory(false);
      }
    };
    loadSession();
  }, [isOpen, user?.id, hasLoadedHistory]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current && hasLoadedHistory && !isLoadingHistory) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, hasLoadedHistory, isLoadingHistory]);

  const saveSession = useCallback(async (messagesToSave: SDRAssistantMessage[]) => {
    if (!user?.id || messagesToSave.length === 0) return;
    await saveSDRAssistantSession(user.id, messagesToSave, currentSessionId ?? undefined);
  }, [user?.id, currentSessionId]);

  const handleNewChat = async () => {
    if (!user?.id) return;
    if (messages.length > 0) {
      const success = await archiveAndStartNewSDRSession(user.id);
      if (!success) { toast.error('Failed to start new chat'); return; }
    }
    setMessages([]); setLastUpdated(null); setCurrentSessionId(null);
    const sessions = await fetchAllSDRAssistantSessions(user.id);
    setAllSessions(sessions);
    toast.success('Started new conversation');
  };

  const handleSwitchSession = async (sessionId: string) => {
    if (!user?.id) return;
    const success = await switchToSDRSession(user.id, sessionId);
    if (!success) { toast.error('Failed to switch chat'); return; }
    const sessions = await fetchAllSDRAssistantSessions(user.id);
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
    const success = await deleteSDRAssistantSession(sessionId);
    if (!success) { toast.error('Failed to delete chat'); return; }
    if (sessionId === currentSessionId) { setMessages([]); setLastUpdated(null); setCurrentSessionId(null); }
    if (user?.id) {
      const sessions = await fetchAllSDRAssistantSessions(user.id);
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
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
        }
        return [...prev, { role: 'assistant', content: assistantContent }];
      });
    };

    try {
      await streamSDRAssistantResponse({
        messages: newMessages,
        onDelta: updateAssistant,
        onDone: async () => {
          setIsLoading(false);
          const finalMessages = [...newMessages, { role: 'assistant' as const, content: assistantContent }];
          await saveSession(finalMessages);
          setLastUpdated(new Date().toISOString());
          if (user?.id) {
            const sessions = await fetchAllSDRAssistantSessions(user.id);
            setAllSessions(sessions);
            if (!currentSessionId && sessions.length > 0) {
              const activeSession = sessions.find(s => s.is_active);
              if (activeSession) setCurrentSessionId(activeSession.id);
            }
          }
        },
        onError: (err) => {
          setError(err);
          setIsLoading(false);
          if (err.toLowerCase().includes('rate limit')) startCountdown();
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input); };
  const handleQuickAction = (action: QuickAction) => { setInput(action.prompt); inputRef.current?.focus(); };

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
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col bg-gradient-to-b from-background via-background to-muted/20">
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
                  <SheetTitle className="text-primary-foreground text-lg font-semibold">{title}</SheetTitle>
                  <p className="text-xs text-primary-foreground/80">{subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={handleNewChat} title="New conversation">
                  <Plus className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowHistorySheet(true)}>
                      <History className="h-4 w-4 mr-2" /> Chat History
                    </DropdownMenuItem>
                    {currentSessionId && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteSession(currentSessionId)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Delete Chat
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {isLoadingHistory ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-transparent rounded-xl p-4 border border-primary/10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        {isManager ? <Users className="h-5 w-5 text-primary" /> : <Award className="h-5 w-5 text-primary" />}
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{isManager ? 'Team Coaching' : 'Personal Coach'}</h3>
                        <p className="text-xs text-muted-foreground">{isManager ? 'I can see your entire team\'s data' : 'I can see all your call grades'}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isManager
                        ? 'Ask me about team performance, coaching opportunities, grade trends, or help preparing for 1:1s.'
                        : 'Ask me about your performance, how to improve your calls, or review your recent grades.'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground px-1">Quick Actions</p>
                    <div className="grid grid-cols-2 gap-2">
                      {quickActions.map((action) => (
                        <Button key={action.id} variant="outline" className="h-auto py-3 px-3 flex flex-col items-start gap-1 text-left hover:bg-primary/5 hover:border-primary/30 transition-colors" onClick={() => handleQuickAction(action)}>
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
              <ScrollArea className="flex-1 px-4" ref={scrollRef}>
                <div className="py-4 space-y-4">
                  {messages.map((message, index) => (
                    <div key={index} className={cn("flex gap-3", message.role === 'user' ? 'justify-end' : 'justify-start')}>
                      {message.role === 'assistant' && (
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs">
                            <Sparkles className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5", message.role === 'user' ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-br-md" : "bg-muted/80 text-foreground rounded-bl-md")}>
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
                          <AvatarFallback className="bg-muted"><User className="h-4 w-4" /></AvatarFallback>
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

            {error && (
              <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {isRateLimited && (
              <div className="px-4 py-2">
                <RateLimitCountdown secondsRemaining={secondsRemaining} />
              </div>
            )}

            <div className="p-4 border-t bg-background/80 backdrop-blur-sm shrink-0">
              <form onSubmit={handleSubmit} className="flex gap-2 items-end">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                  placeholder={isManager ? 'Ask about your team...' : 'Ask about your calls...'}
                  disabled={isLoading || isRateLimited}
                  rows={1}
                  className="flex-1 min-h-[40px] max-h-[120px] bg-muted/50 border-muted-foreground/20 resize-none py-2.5"
                />
                <Button type="submit" size="icon" disabled={!input.trim() || isLoading || isRateLimited} className="shrink-0 bg-primary hover:bg-primary/90">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
              {lastUpdated && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Last updated {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
                </p>
              )}
            </div>
          </div>

          <Sheet open={showHistorySheet} onOpenChange={setShowHistorySheet}>
            <SheetContent side="right" className="w-full sm:max-w-md">
              <SheetHeader><SheetTitle>Chat History</SheetTitle></SheetHeader>
              <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
                <div className="space-y-2 pr-4">
                  {allSessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No previous conversations</p>
                  ) : (
                    allSessions.map((session) => (
                      <div key={session.id} className={cn("p-3 rounded-lg border cursor-pointer transition-colors", session.is_active ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50")} onClick={() => handleSwitchSession(session.id)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                              <p className="text-sm font-medium truncate">{session.title || 'Untitled conversation'}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {session.messages.length} messages · {formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}>
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
