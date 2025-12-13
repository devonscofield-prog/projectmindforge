import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Loader2, Sparkles, User, ChevronDown, Trash2, History, Plus, MoreVertical, MessageSquare, Phone, Mail, Target, TrendingUp, Calendar, Clock } from 'lucide-react';
import { streamCoachResponse, type ChatMessage } from '@/api/salesCoach';
import { 
  fetchCoachSession, 
  saveCoachSession, 
  clearCoachSession, 
  fetchAllCoachSessions,
  archiveAndStartNewSession,
  switchToSession,
  deleteCoachSession,
  type CoachMessage,
  type CoachSession 
} from '@/api/salesCoachSessions';
import { toast } from 'sonner';
import { useRateLimitCountdown } from '@/hooks/useRateLimitCountdown';
import { RateLimitCountdown } from '@/components/ui/rate-limit-countdown';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

interface SalesCoachChatProps {
  prospectId: string;
  accountName: string;
  // Optional context data for Account Pulse card
  heatScore?: number | null;
  lastContactDate?: string | null;
  pendingFollowUpsCount?: number;
}

interface QuestionCategory {
  id: string;
  icon: string;
  label: string;
  questions: string[];
}

interface QuickAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  prompt: string;
}

const QUESTION_CATEGORIES: QuestionCategory[] = [
  {
    id: 'strategy',
    icon: '🎯',
    label: 'Strategy & Next Steps',
    questions: [
      "What should my next steps be with this account?",
      "How do I advance this deal to the next stage?",
      "What's blocking this deal and how do I unblock it?",
      "Should I be pursuing this opportunity more aggressively?",
    ],
  },
  {
    id: 'stakeholders',
    icon: '👥',
    label: 'Stakeholder Navigation',
    questions: [
      "How do I approach the decision-maker?",
      "Who else should I be talking to at this account?",
      "How do I navigate around a blocker or gatekeeper?",
      "What's the best way to get an executive meeting?",
    ],
  },
  {
    id: 'communication',
    icon: '📧',
    label: 'Communication & Follow-up',
    questions: [
      "Help me draft a follow-up email",
      "What should I include in my recap email?",
      "How do I re-engage a ghosting prospect?",
      "Draft a message to schedule our next call",
    ],
  },
  {
    id: 'pricing',
    icon: '💰',
    label: 'Pricing & Negotiation',
    questions: [
      "How should I handle pricing objections?",
      "They're asking for a discount - what should I do?",
      "How do I justify our pricing vs competitors?",
      "When should I bring up pricing in this deal?",
    ],
  },
  {
    id: 'objections',
    icon: '🛡️',
    label: 'Objection Handling',
    questions: [
      "They said they need to think about it - now what?",
      "How do I overcome 'we're happy with our current solution'?",
      "They're concerned about implementation time",
      "How do I handle 'we don't have budget right now'?",
    ],
  },
  {
    id: 'discovery',
    icon: '🔍',
    label: 'Discovery & Qualification',
    questions: [
      "What discovery questions should I ask next?",
      "Is this deal worth pursuing?",
      "What pain points should I dig deeper on?",
      "How do I uncover their real buying timeline?",
    ],
  },
  {
    id: 'competitive',
    icon: '🏆',
    label: 'Competitive Situations',
    questions: [
      "How do I position against competitors?",
      "They're also talking to our competitors - what do I do?",
      "What are our key differentiators for this account?",
    ],
  },
  {
    id: 'preparation',
    icon: '📞',
    label: 'Call Preparation',
    questions: [
      "Help me prepare for my next call",
      "What should my agenda be for the follow-up meeting?",
      "What questions should I be ready to answer?",
      "What objections should I anticipate in this call?",
      "Create a pre-call checklist based on where we are in the deal",
      "What's the best opening given our last conversation?",
      "Help me practice my pitch for this specific account",
      "Draft an agenda email I can send before the call",
      "What competitive questions might come up?",
    ],
  },
];

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'prep',
    icon: <Phone className="h-4 w-4" />,
    label: 'Prep for Call',
    prompt: 'Help me prepare for my next call with this account. What should I focus on and what questions should I be ready to answer?',
  },
  {
    id: 'email',
    icon: <Mail className="h-4 w-4" />,
    label: 'Draft Email',
    prompt: 'Help me draft a follow-up email for this account based on our recent conversations.',
  },
  {
    id: 'next-steps',
    icon: <Target className="h-4 w-4" />,
    label: 'Next Steps',
    prompt: 'What should my next steps be with this account to move the deal forward?',
  },
  {
    id: 'status',
    icon: <TrendingUp className="h-4 w-4" />,
    label: 'Deal Status',
    prompt: "Give me a quick assessment of where this deal stands and what's the probability of closing.",
  },
];

export function SalesCoachChat({ prospectId, accountName, heatScore, lastContactDate, pendingFollowUpsCount = 0 }: SalesCoachChatProps) {
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
  const [allSessions, setAllSessions] = useState<CoachSession[]>([]);
  const [showHistorySheet, setShowHistorySheet] = useState(false);
  const [recentQuestions, setRecentQuestions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { secondsRemaining, isRateLimited, startCountdown } = useRateLimitCountdown(60);

  // Load recent questions from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`sales-coach-recent-${prospectId}`);
    if (stored) {
      try {
        setRecentQuestions(JSON.parse(stored));
      } catch {
        // Ignore parse errors
      }
    }
  }, [prospectId]);

  // Save recent questions to localStorage
  const addToRecentQuestions = useCallback((question: string) => {
    setRecentQuestions(prev => {
      const filtered = prev.filter(q => q !== question);
      const updated = [question, ...filtered].slice(0, 3);
      localStorage.setItem(`sales-coach-recent-${prospectId}`, JSON.stringify(updated));
      return updated;
    });
  }, [prospectId]);

  // Get heat temperature label and color
  const getHeatInfo = useMemo(() => {
    if (!heatScore) return null;
    if (heatScore >= 70) return { label: 'Hot', color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' };
    if (heatScore >= 40) return { label: 'Warm', color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400' };
    return { label: 'Cold', color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' };
  }, [heatScore]);

  // Load session when sheet opens
  useEffect(() => {
    const loadSession = async () => {
      if (!isOpen || !user?.id || hasLoadedHistory) return;
      
      setIsLoadingHistory(true);
      const session = await fetchCoachSession(user.id, prospectId);
      if (session && session.messages.length > 0) {
        setMessages(session.messages);
        setLastUpdated(session.updated_at);
        setCurrentSessionId(session.id);
      }
      // Load all sessions for history
      const sessions = await fetchAllCoachSessions(user.id, prospectId);
      setAllSessions(sessions);
      setHasLoadedHistory(true);
      setIsLoadingHistory(false);
    };

    loadSession();
  }, [isOpen, user?.id, prospectId, hasLoadedHistory]);

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

  // Save session after messages change (debounced)
  const saveSession = useCallback(async (messagesToSave: CoachMessage[]) => {
    if (!user?.id || messagesToSave.length === 0) return;
    await saveCoachSession(user.id, prospectId, messagesToSave, currentSessionId ?? undefined);
  }, [user?.id, prospectId, currentSessionId]);

  const handleNewChat = async () => {
    if (!user?.id) return;
    
    if (messages.length > 0) {
      // Archive current session
      const success = await archiveAndStartNewSession(user.id, prospectId);
      if (!success) {
        toast.error('Failed to start new chat');
        return;
      }
    }
    
    // Reset state
    setMessages([]);
    setLastUpdated(null);
    setCurrentSessionId(null);
    
    // Refresh sessions list
    const sessions = await fetchAllCoachSessions(user.id, prospectId);
    setAllSessions(sessions);
    
    toast.success('Started new conversation');
  };

  const handleSwitchSession = async (sessionId: string) => {
    if (!user?.id) return;
    
    const success = await switchToSession(user.id, prospectId, sessionId);
    if (!success) {
      toast.error('Failed to switch chat');
      return;
    }
    
    // Load the selected session
    const sessions = await fetchAllCoachSessions(user.id, prospectId);
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
    const success = await deleteCoachSession(sessionId);
    if (!success) {
      toast.error('Failed to delete chat');
      return;
    }
    
    // If deleting current session, reset state
    if (sessionId === currentSessionId) {
      setMessages([]);
      setLastUpdated(null);
      setCurrentSessionId(null);
    }
    
    // Refresh sessions list
    if (user?.id) {
      const sessions = await fetchAllCoachSessions(user.id, prospectId);
      setAllSessions(sessions);
    }
    
    toast.success('Chat deleted');
  };

  const handleClearHistory = async () => {
    if (!user?.id) return;
    
    const success = await clearCoachSession(user.id, prospectId);
    if (success) {
      setMessages([]);
      setLastUpdated(null);
      setCurrentSessionId(null);
      // Refresh sessions list
      const sessions = await fetchAllCoachSessions(user.id, prospectId);
      setAllSessions(sessions);
      toast.success('Chat deleted');
    } else {
      toast.error('Failed to delete chat');
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading || isRateLimited) return;

    const userMessage: ChatMessage = { role: 'user', content: content.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    
    // Track recent questions
    addToRecentQuestions(content.trim());
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
      await streamCoachResponse({
        prospectId,
        messages: newMessages,
        onDelta: updateAssistant,
        onDone: async () => {
          setIsLoading(false);
          // Save session after response is complete
          const finalMessages = [...newMessages, { role: 'assistant' as const, content: assistantContent }];
          await saveSession(finalMessages);
          setLastUpdated(new Date().toISOString());
          // Refresh sessions list to include new/updated session
          if (user?.id) {
            const sessions = await fetchAllCoachSessions(user.id, prospectId);
            setAllSessions(sessions);
            // If this was a new chat, get the session ID
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
          // Start countdown for rate limit errors
          if (err.toLowerCase().includes('rate limit')) {
            startCountdown(60);
            toast.error('Too many requests', {
              description: 'Please wait before sending another message.',
            });
          }
        },
      });
    } catch (err) {
      setError('Failed to connect to coach');
      setIsLoading(false);
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

  const archivedSessions = allSessions.filter(s => !s.is_active);
  const sessionCount = allSessions.length;

  return (
    <>
      {createPortal(
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              size="lg"
              className="fixed bottom-20 right-4 md:bottom-6 md:right-6 h-12 md:h-14 px-4 md:px-5 shadow-lg gap-2 z-40"
            >
              <Sparkles className="h-5 w-5" />
              <span className="hidden sm:inline">Ask Sales Coach</span>
              <span className="sm:hidden">Coach</span>
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-lg flex flex-col p-0 h-full max-h-[100dvh]">
            <SheetHeader className="px-4 py-3 border-b bg-primary text-primary-foreground">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 bg-primary-foreground/20">
                    <AvatarFallback className="bg-transparent text-primary-foreground">
                      <Sparkles className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle className="text-primary-foreground">Sales Coach</SheetTitle>
                    <p className="text-xs text-primary-foreground/70">
                      30-year veteran · {accountName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {sessionCount > 1 && (
                    <span className="text-xs bg-primary-foreground/20 px-2 py-0.5 rounded-full mr-1">
                      {sessionCount} chats
                    </span>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleNewChat}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Chat
                      </DropdownMenuItem>
                      {archivedSessions.length > 0 && (
                        <DropdownMenuItem onClick={() => setShowHistorySheet(true)}>
                          <History className="h-4 w-4 mr-2" />
                          Chat History ({archivedSessions.length})
                        </DropdownMenuItem>
                      )}
                      {messages.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={handleClearHistory}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Current Chat
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {messages.length === 0 && (
                      <div className="space-y-4">
                        {/* Account Pulse Card */}
                        {(heatScore || lastContactDate || pendingFollowUpsCount > 0) && (
                          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-3 border border-primary/10">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {heatScore && (
                                  <>
                                    <span className="text-2xl font-bold">{heatScore}</span>
                                    {getHeatInfo && (
                                      <Badge variant="outline" className={cn("text-xs", getHeatInfo.color)}>
                                        {getHeatInfo.label}
                                      </Badge>
                                    )}
                                  </>
                                )}
                              </div>
                              {lastContactDate && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Last call: {formatDistanceToNow(new Date(lastContactDate), { addSuffix: true })}
                                </span>
                              )}
                            </div>
                            {pendingFollowUpsCount > 0 && (
                              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {pendingFollowUpsCount} open follow-up{pendingFollowUpsCount > 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Quick Action Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                          {QUICK_ACTIONS.map((action) => (
                            <Button
                              key={action.id}
                              variant="outline"
                              className="h-auto py-3 flex-col gap-1.5 text-muted-foreground hover:text-foreground hover:bg-primary/5 hover:border-primary/30"
                              onClick={() => sendMessage(action.prompt)}
                              disabled={isLoading || isRateLimited}
                            >
                              {action.icon}
                              <span className="text-xs font-medium">{action.label}</span>
                            </Button>
                          ))}
                        </div>

                        {/* Recently Asked Questions */}
                        {recentQuestions.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground font-medium mb-2">Recently Asked</p>
                            <div className="flex flex-wrap gap-1.5">
                              {recentQuestions.map((q, i) => (
                                <Button
                                  key={i}
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-auto py-1.5 px-2.5 text-left justify-start font-normal text-muted-foreground hover:text-foreground hover:bg-primary/10 max-w-full"
                                  onClick={() => sendMessage(q)}
                                  disabled={isLoading || isRateLimited}
                                >
                                  <span className="truncate">{q.length > 45 ? `${q.slice(0, 45)}...` : q}</span>
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="bg-muted rounded-lg p-4">
                          <p className="text-sm text-muted-foreground">
                            Hey! I'm your sales coach with 30 years of experience closing deals. 
                            I know everything about <strong>{accountName}</strong> – their stakeholders, 
                            call history, and emails. Ask me anything about strategy, next steps, or how to 
                            handle specific situations.
                          </p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium mb-2">What can I help you with?</p>
                          {QUESTION_CATEGORIES.map((category) => (
                            <Collapsible key={category.id}>
                              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-md hover:bg-muted/50 transition-colors group">
                                <span className="flex items-center gap-2">
                                  <span>{category.icon}</span>
                                  <span>{category.label}</span>
                                </span>
                                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                              </CollapsibleTrigger>
                              <CollapsibleContent className="pl-7 pr-2 pb-2">
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {category.questions.map((q) => (
                                    <Button
                                      key={q}
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs h-auto py-1.5 px-2.5 text-left justify-start font-normal text-muted-foreground hover:text-foreground hover:bg-primary/10"
                                      onClick={() => sendMessage(q)}
                                      disabled={isLoading || isRateLimited}
                                    >
                                      {q}
                                    </Button>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          ))}
                        </div>
                      </div>
                    )}

                    {messages.length > 0 && lastUpdated && (
                      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                        <History className="h-3 w-3" />
                        <span>Conversation from {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}</span>
                      </div>
                    )}

                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex gap-3",
                          msg.role === 'user' ? "justify-end" : "justify-start"
                        )}
                      >
                        {msg.role === 'assistant' && (
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                              <Sparkles className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={cn(
                            "rounded-lg px-4 py-2 max-w-[85%]",
                            msg.role === 'user'
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          {msg.role === 'assistant' ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown
                                components={{
                                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                  ul: ({ children }) => <ul className="my-2 ml-4 list-disc">{children}</ul>,
                                  ol: ({ children }) => <ol className="my-2 ml-4 list-decimal">{children}</ol>,
                                  li: ({ children }) => <li className="mb-1">{children}</li>,
                                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-sm">{msg.content}</p>
                          )}
                        </div>
                        {msg.role === 'user' && (
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                              <User className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    ))}

                    {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                      <div className="flex gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            <Sparkles className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="bg-muted rounded-lg px-4 py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-2">
                        {error}
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>

            <div className="border-t bg-background">
              {isRateLimited && (
                <div className="px-4 pt-3">
                  <RateLimitCountdown secondsRemaining={secondsRemaining} />
                </div>
              )}
              <form onSubmit={handleSubmit} className="p-4">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isRateLimited ? "Please wait..." : "Ask your sales coach..."}
                    disabled={isLoading || isRateLimited || isLoadingHistory}
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={isLoading || isRateLimited || !input.trim() || isLoadingHistory}>
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </SheetContent>
        </Sheet>,
        document.body
      )}

      {/* History Sheet */}
      {createPortal(
        <Sheet open={showHistorySheet} onOpenChange={setShowHistorySheet}>
          <SheetContent side="right" className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Chat History
              </SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-120px)] mt-4">
              <div className="space-y-2 pr-4">
                {allSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No saved conversations yet
                  </p>
                ) : (
                  allSessions.map((session) => {
                    // Get first assistant message as preview
                    const firstAssistantMessage = session.messages.find(m => m.role === 'assistant');
                    const preview = firstAssistantMessage?.content?.slice(0, 80) || 'No response yet';
                    
                    return (
                      <div
                        key={session.id}
                        className={cn(
                          "p-3 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50",
                          session.is_active && "border-primary bg-primary/5"
                        )}
                        onClick={() => {
                          if (!session.is_active) {
                            handleSwitchSession(session.id);
                          } else {
                            setShowHistorySheet(false);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                              <p className="text-sm font-medium truncate">
                                {session.title || 'Untitled conversation'}
                              </p>
                              {session.is_active && (
                                <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded shrink-0">
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {preview}{preview.length >= 80 ? '...' : ''}
                            </p>
                            <p className="text-xs text-muted-foreground/70 mt-1">
                              {formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })} · {session.messages.length} messages
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(session.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>,
        document.body
      )}
    </>
  );
}
