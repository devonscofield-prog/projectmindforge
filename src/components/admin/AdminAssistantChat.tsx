import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
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
import {
  Send,
  Loader2,
  BotMessageSquare,
  User,
  Trash2,
  History,
  Plus,
  MoreVertical,
  LayoutDashboard,
  Users,
  TrendingUp,
  Activity,
  MessageSquare,
  FileText,
  UserCheck,
} from 'lucide-react';
import { streamAdminAssistantChat, type ChatMessage } from '@/api/adminAssistantChat';
import {
  fetchActiveAdminSession,
  saveAdminSession,
  fetchAllAdminSessions,
  archiveAdminSession,
  switchAdminSession,
  deleteAdminSession,
  type AdminAssistantMessage,
  type AdminAssistantSession,
} from '@/api/adminAssistantSessions';
import { toast } from 'sonner';
import { useRateLimitCountdown } from '@/hooks/useRateLimitCountdown';
import { RateLimitCountdown } from '@/components/ui/rate-limit-countdown';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-2">
    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
);

// Page-aware quick actions
function getQuickActions(pageContext: string) {
  const route = pageContext.toLowerCase();

  if (route.includes('/sales-coach')) return [
    { id: 'usage', icon: <MessageSquare className="h-4 w-4" />, label: 'Coach Usage', prompt: 'Show me a breakdown of Sales Coach usage — who\'s using it most, session frequency trends, and any patterns in the types of questions being asked.' },
    { id: 'trends', icon: <TrendingUp className="h-4 w-4" />, label: 'Coaching Trends', prompt: 'What trends do you see in coaching sessions? Are reps improving over time? What topics come up repeatedly?' },
  ];

  if (route.includes('/history') || route.includes('/transcripts')) return [
    { id: 'volume', icon: <FileText className="h-4 w-4" />, label: 'Call Volume', prompt: 'Give me an overview of call volume trends — daily/weekly patterns, which reps are most active, and any notable changes.' },
    { id: 'quality', icon: <TrendingUp className="h-4 w-4" />, label: 'Call Quality', prompt: 'How is call quality trending? Highlight any reps with improving or declining performance scores.' },
  ];

  if (route.includes('/users')) return [
    { id: 'activity', icon: <Users className="h-4 w-4" />, label: 'User Activity', prompt: 'Show me user activity levels — who\'s most active, who hasn\'t been seen recently, and any concerning inactivity patterns.' },
    { id: 'roles', icon: <UserCheck className="h-4 w-4" />, label: 'Role Overview', prompt: 'Give me a summary of user roles, team assignments, and any users who might need role adjustments.' },
  ];

  if (route.includes('/accounts')) return [
    { id: 'pipeline', icon: <TrendingUp className="h-4 w-4" />, label: 'Pipeline Health', prompt: 'How is the pipeline looking? Show me hot accounts, at-risk deals, and overall pipeline value trends.' },
    { id: 'engagement', icon: <Activity className="h-4 w-4" />, label: 'Account Engagement', prompt: 'Which accounts have gone cold? Are there any accounts that need immediate attention based on engagement patterns?' },
  ];

  if (route.includes('/performance')) return [
    { id: 'metrics', icon: <Activity className="h-4 w-4" />, label: 'Performance Summary', prompt: 'Give me a summary of system performance — any slow endpoints, error rates, or areas that need optimization?' },
  ];

  // Default (dashboard)
  return [
    { id: 'overview', icon: <LayoutDashboard className="h-4 w-4" />, label: 'Platform Overview', prompt: 'Give me a high-level overview of the platform — user counts, call volume, coaching activity, and anything notable.' },
    { id: 'attention', icon: <Activity className="h-4 w-4" />, label: 'Needs Attention', prompt: 'What needs my attention right now? Flag any concerning trends, inactive users, or underperforming areas.' },
  ];
}

function getPageLabel(pageContext: string): string {
  const route = pageContext.toLowerCase();
  if (route.includes('/sales-coach')) return 'Coach History';
  if (route.includes('/history')) return 'Call History';
  if (route.includes('/transcripts')) return 'Transcripts';
  if (route.includes('/users')) return 'Users';
  if (route.includes('/teams')) return 'Teams';
  if (route.includes('/accounts')) return 'Accounts';
  if (route.includes('/coaching')) return 'Coaching Trends';
  if (route.includes('/performance')) return 'Performance';
  if (route === '/admin') return 'Dashboard';
  return 'Admin';
}

export function AdminAssistantChat() {
  const { user, role } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [allSessions, setAllSessions] = useState<AdminAssistantSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { secondsRemaining, isRateLimited, startCountdown } = useRateLimitCountdown(60);

  const pageContext = location.pathname;
  const quickActions = getQuickActions(pageContext);
  const pageLabel = getPageLabel(pageContext);

  // Auto-resize textarea
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
        const session = await fetchActiveAdminSession(user.id);
        if (session?.messages.length) {
          setMessages(session.messages);
          setCurrentSessionId(session.id);
        }
        setAllSessions(await fetchAllAdminSessions(user.id));
      } catch (err) {
        console.error('[AdminAssistant] Failed to load session:', err);
      } finally {
        setHasLoadedHistory(true);
        setIsLoadingHistory(false);
      }
    };
    loadSession();
  }, [isOpen, user?.id, hasLoadedHistory]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Focus input
  useEffect(() => {
    if (isOpen && inputRef.current && hasLoadedHistory && !isLoadingHistory) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, hasLoadedHistory, isLoadingHistory]);

  const saveSession = useCallback(async (msgs: AdminAssistantMessage[]) => {
    if (!user?.id || msgs.length === 0) return;
    await saveAdminSession(user.id, msgs, pageContext, currentSessionId ?? undefined);
  }, [user?.id, currentSessionId, pageContext]);

  // Only render for admins - after all hooks
  if (role !== 'admin') return null;

  const handleNewChat = async () => {
    if (!user?.id) return;
    if (messages.length > 0) {
      const ok = await archiveAdminSession(user.id);
      if (!ok) { toast.error('Failed to start new chat'); return; }
    }
    setMessages([]);
    setCurrentSessionId(null);
    setAllSessions(await fetchAllAdminSessions(user.id));
    toast.success('Started new conversation');
  };

  const handleSwitchSession = async (sessionId: string) => {
    if (!user?.id) return;
    const ok = await switchAdminSession(user.id, sessionId);
    if (!ok) { toast.error('Failed to switch chat'); return; }
    const sessions = await fetchAllAdminSessions(user.id);
    setAllSessions(sessions);
    const sel = sessions.find(s => s.id === sessionId);
    if (sel) { setMessages(sel.messages); setCurrentSessionId(sel.id); }
    setShowHistory(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    const ok = await deleteAdminSession(sessionId);
    if (!ok) { toast.error('Failed to delete chat'); return; }
    if (sessionId === currentSessionId) { setMessages([]); setCurrentSessionId(null); }
    if (user?.id) setAllSessions(await fetchAllAdminSessions(user.id));
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
      await streamAdminAssistantChat({
        messages: newMessages,
        pageContext,
        onDelta: updateAssistant,
        onDone: async () => {
          setIsLoading(false);
          const finalMessages = [...newMessages, { role: 'assistant' as const, content: assistantContent }];
          await saveSession(finalMessages);
          if (user?.id) {
            const sessions = await fetchAllAdminSessions(user.id);
            setAllSessions(sessions);
            if (!currentSessionId && sessions.length > 0) {
              const active = sessions.find(s => s.is_active);
              if (active) setCurrentSessionId(active.id);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const floatingButton = (
    <Button
      size="lg"
      className={cn(
        "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg",
        "bg-gradient-to-r from-secondary via-secondary/95 to-primary hover:from-secondary/90 hover:to-primary/90",
        "transition-all duration-300 hover:scale-105 hover:shadow-xl",
        "md:bottom-8 md:right-8"
      )}
      onClick={() => setIsOpen(true)}
    >
      <BotMessageSquare className="h-6 w-6 text-primary-foreground" />
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
          {/* Header */}
          <SheetHeader className="px-4 py-4 border-b bg-gradient-to-r from-secondary via-secondary/95 to-primary text-primary-foreground shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                    <BotMessageSquare className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-secondary animate-pulse" />
                </div>
                <div>
                  <SheetTitle className="text-primary-foreground text-lg font-semibold">
                    Admin Assistant
                  </SheetTitle>
                  <p className="text-xs text-primary-foreground/80">
                    Viewing: {pageLabel}
                  </p>
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
                    <DropdownMenuItem onClick={() => setShowHistory(!showHistory)}>
                      <History className="h-4 w-4 mr-2" />
                      Chat History
                    </DropdownMenuItem>
                    {currentSessionId && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteSession(currentSessionId)} className="text-destructive">
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
            {showHistory ? (
              /* Session History */
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">Chat History</h3>
                    <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>Back</Button>
                  </div>
                  {allSessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No previous conversations</p>
                  ) : (
                    allSessions.map(session => (
                      <div
                        key={session.id}
                        className={cn(
                          "p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50",
                          session.id === currentSessionId && "border-primary/50 bg-primary/5"
                        )}
                        onClick={() => handleSwitchSession(session.id)}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate flex-1">{session.title || 'Untitled'}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })} · {session.messages.length} messages
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            ) : isLoadingHistory ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              /* Empty State */
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  <div className="bg-gradient-to-br from-secondary/5 via-primary/5 to-transparent rounded-xl p-4 border border-secondary/10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-secondary/10">
                        <BotMessageSquare className="h-5 w-5 text-secondary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">Admin Assistant</h3>
                        <p className="text-xs text-muted-foreground">Context: {pageLabel}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      I have full visibility into your platform data. Ask me anything about users, calls, coaching, accounts, or trends.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground px-1">Suggested Questions</p>
                    <div className="grid grid-cols-1 gap-2">
                      {quickActions.map((action) => (
                        <Button
                          key={action.id}
                          variant="outline"
                          className="h-auto py-3 px-3 flex items-center gap-2 text-left hover:bg-secondary/5 hover:border-secondary/30 transition-colors justify-start"
                          onClick={() => { setInput(action.prompt); inputRef.current?.focus(); }}
                        >
                          <span className="text-secondary shrink-0">{action.icon}</span>
                          <span className="font-medium text-sm">{action.label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              /* Messages */
              <ScrollArea className="flex-1 px-4" ref={scrollRef}>
                <div className="py-4 space-y-4">
                  {messages.map((message, index) => (
                    <div key={index} className={cn("flex gap-3", message.role === 'user' ? 'justify-end' : 'justify-start')}>
                      {message.role === 'assistant' && (
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-gradient-to-br from-secondary to-primary text-primary-foreground text-xs">
                            <BotMessageSquare className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5",
                        message.role === 'user'
                          ? "bg-gradient-to-r from-secondary to-secondary/90 text-primary-foreground rounded-br-md"
                          : "bg-muted/80 text-foreground rounded-bl-md"
                      )}>
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
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                  {isLoading && messages[messages.length - 1]?.role === 'user' && (
                    <div className="flex gap-3 justify-start">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-secondary to-primary text-primary-foreground text-xs">
                          <BotMessageSquare className="h-4 w-4" />
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

            {/* Input Area */}
            <div className="border-t p-4 shrink-0 space-y-2">
              {isRateLimited && <RateLimitCountdown secondsRemaining={secondsRemaining} />}
              {error && <p className="text-xs text-destructive">{error}</p>}
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
                  }}
                  placeholder="Ask about your platform data..."
                  className="min-h-[44px] max-h-[120px] resize-none"
                  disabled={isLoading || isRateLimited}
                />
                <Button type="submit" size="icon" className="h-[44px] w-[44px] shrink-0" disabled={!input.trim() || isLoading || isRateLimited}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
