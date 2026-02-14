import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import { Send, Loader2, Sparkles, User, ChevronDown, Trash2, History, Plus, MoreVertical, MessageSquare, Phone, Mail, Target, TrendingUp, Calendar, Clock, Zap, FileText, Users, Wrench, Share2, ListChecks } from 'lucide-react';
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

// Typing indicator component with animated dots
const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-2">
    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
);

// Heat score circular progress indicator
const HeatScoreIndicator = ({ score, size = 56 }: { score: number; size?: number }) => {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  
  const getColor = () => {
    if (score >= 70) return 'stroke-success';
    if (score >= 40) return 'stroke-warning';
    return 'stroke-destructive';
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          className={cn("transition-all duration-500", getColor())}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: circumference - progress,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold">{score}</span>
      </div>
    </div>
  );
};

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
  {
    id: 'leadership',
    icon: '📊',
    label: 'Leadership & Executive Summaries',
    questions: [
      "Give me a 30-second executive summary of this deal for my leadership meeting",
      "What are the key points I should share with my VP about this account?",
      "Create a brief deal status update I can paste in Slack for my manager",
      "Summarize the risks and opportunities in this deal for executive review",
      "What's the one-liner I should use to describe this deal to senior leadership?",
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

interface RecapEmailOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  prompt: string;
}

const RECAP_EMAIL_OPTIONS: RecapEmailOption[] = [
  {
    id: 'executive-summary',
    label: 'Executive Summary',
    description: 'For prospect to share with leadership',
    icon: <FileText className="h-4 w-4" />,
    prompt: 'Write a post-call recap email for my prospect that includes a brief Executive Summary they can forward to their leadership team. Keep it professional and focused on the business value and outcomes we discussed.',
  },
  {
    id: 'decision-maker',
    label: 'Decision Maker',
    description: 'Concise email for C-suite/executives',
    icon: <Target className="h-4 w-4" />,
    prompt: 'Draft a recap email specifically for a decision maker or executive at this account. Keep it concise, lead with ROI and business outcomes, and include a clear next step. Executives are busy - make every word count.',
  },
  {
    id: 'champion-enablement',
    label: 'Champion Enablement',
    description: 'Talking points for your internal advocate',
    icon: <Users className="h-4 w-4" />,
    prompt: 'Create a recap email for my champion at this account that includes key talking points they can use to advocate for us internally. Include a quick-reference summary of benefits and answers to likely objections from their colleagues.',
  },
  {
    id: 'technical-stakeholder',
    label: 'Technical Stakeholder',
    description: 'For IT, implementation, and technical teams',
    icon: <Wrench className="h-4 w-4" />,
    prompt: 'Write a recap email tailored for technical stakeholders at this account. Focus on the technical requirements, integration details, and implementation considerations we discussed. Include any technical next steps.',
  },
  {
    id: 'multi-thread',
    label: 'Multi-Thread Recap',
    description: 'Comprehensive email for multiple stakeholders',
    icon: <Share2 className="h-4 w-4" />,
    prompt: 'Draft a comprehensive recap email that I can send to multiple stakeholders at this account. Structure it so different readers (executives, technical team, end users) can each find the information relevant to them. Include a clear summary at the top.',
  },
  {
    id: 'next-steps-focused',
    label: 'Next Steps Focused',
    description: 'Action-oriented with clear commitments',
    icon: <ListChecks className="h-4 w-4" />,
    prompt: 'Write a brief, action-focused recap email that emphasizes the specific next steps we agreed on, who owns each action item, and the timeline. Keep it short and scannable with a clear list of commitments from both sides.',
  },
];

// Featured DRIP Email Strategy Prompt
const DRIP_STRATEGY_PROMPT = {
  id: 'drip-strategy',
  label: 'DRIP Email Strategy',
  description: 'Get AI guidance on which DRIP email to send next',
  prompt: "Based on this account's current status, engagement history, and where they are in the sales cycle, help me figure out which DRIP email I should send next. Consider their heat score, recent interactions, any pending follow-ups, and stakeholder engagement. Recommend a specific type of DRIP email (nurture, value-add, case study, check-in, re-engagement, etc.) and explain why it's the right choice for this moment. Then help me draft it.",
};

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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input]);
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
      try {
        console.log('[SalesCoach] Loading session for prospect:', prospectId);
        const session = await fetchCoachSession(user.id, prospectId);
        if (session && session.messages.length > 0) {
          setMessages(session.messages);
          setLastUpdated(session.updated_at);
          setCurrentSessionId(session.id);
          console.log('[SalesCoach] Loaded session with', session.messages.length, 'messages');
        }
        // Load all sessions for history
        const sessions = await fetchAllCoachSessions(user.id, prospectId);
        setAllSessions(sessions);
        console.log('[SalesCoach] Loaded', sessions.length, 'total sessions');
      } catch (err) {
        console.error('[SalesCoach] Failed to load session:', err);
        // Don't block UI - user can still start fresh conversation
      } finally {
        setHasLoadedHistory(true);
        setIsLoadingHistory(false);
      }
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to coach';
      console.error('Sales Coach connection error:', errorMessage);
      
      // Check for network/payload errors
      if (errorMessage.toLowerCase().includes('failed to fetch') || errorMessage.toLowerCase().includes('network')) {
        setError('Connection failed. Try clearing chat history if the issue persists.');
        toast.error('Connection failed', {
          description: 'If this keeps happening, try starting a new chat.',
          action: {
            label: 'New Chat',
            onClick: () => handleNewChat(),
          },
        });
      } else {
        setError(errorMessage);
      }
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
    // Shift+Enter allows new line (default textarea behavior)
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
              className="fixed bottom-20 right-4 md:bottom-6 md:right-6 h-12 md:h-14 px-4 md:px-6 shadow-xl gap-2.5 z-40 bg-gradient-to-r from-primary via-primary to-accent hover:shadow-primary/25 hover:scale-105 transition-all duration-300 group"
            >
              <Sparkles className="h-5 w-5 group-hover:animate-pulse" />
              <span className="hidden sm:inline font-medium">Ask Sales Coach</span>
              <span className="sm:hidden font-medium">Coach</span>
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0 h-full max-h-[100dvh] overflow-hidden">
            {/* Glassmorphism Header */}
            <SheetHeader className="relative px-4 py-4 border-b border-primary-foreground/10 bg-gradient-to-r from-primary via-primary/95 to-accent text-primary-foreground overflow-hidden">
              {/* Animated background glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary-foreground/5 via-transparent to-primary-foreground/5" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-11 w-11 ring-2 ring-primary-foreground/20 bg-primary-foreground/15 backdrop-blur-sm">
                      <AvatarFallback className="bg-transparent text-primary-foreground">
                        <Sparkles className="h-5 w-5 animate-pulse" />
                      </AvatarFallback>
                    </Avatar>
                    {/* Online indicator */}
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-success rounded-full border-2 border-primary animate-pulse" />
                  </div>
                  <div>
                    <SheetTitle className="text-primary-foreground flex items-center gap-2">
                      Sales Coach
                      <Zap className="h-3.5 w-3.5 text-primary-foreground/80" />
                    </SheetTitle>
                    <p className="text-xs text-primary-foreground/70 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-success rounded-full" />
                      Online · {accountName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {sessionCount > 1 && (
                    <span className="text-xs bg-primary-foreground/15 backdrop-blur-sm px-2.5 py-1 rounded-full mr-1 border border-primary-foreground/10">
                      {sessionCount} chats
                    </span>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/15 backdrop-blur-sm transition-all duration-200"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="backdrop-blur-xl bg-popover/95">
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

            <ScrollArea className="flex-1 p-4 bg-gradient-to-b from-background to-muted/20" ref={scrollRef}>
              <div className="space-y-4">
                {isLoadingHistory ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-primary/10 animate-pulse" />
                      <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary animate-pulse" />
                    </div>
                    <p className="text-sm text-muted-foreground">Loading your conversations...</p>
                  </div>
                ) : (
                  <>
                    {messages.length === 0 && (
                      <div className="space-y-5 animate-fade-in">
                        {/* Enhanced Account Pulse Card */}
                        {(heatScore || lastContactDate || pendingFollowUpsCount > 0) && (
                          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-card via-card to-primary/5 border border-border/50 shadow-sm">
                            {/* Shimmer effect overlay */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-full animate-shimmer" style={{ animationDuration: '3s', animationIterationCount: 'infinite' }} />
                            
                            <div className="relative p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  {heatScore ? (
                                    <HeatScoreIndicator score={heatScore} />
                                  ) : null}
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Account Pulse</p>
                                    {getHeatInfo && (
                                      <Badge 
                                        variant="secondary" 
                                        className={cn(
                                          "text-xs font-semibold",
                                          heatScore && heatScore >= 70 && "bg-success/15 text-success border-success/30",
                                          heatScore && heatScore >= 40 && heatScore < 70 && "bg-warning/15 text-warning border-warning/30",
                                          heatScore && heatScore < 40 && "bg-destructive/15 text-destructive border-destructive/30"
                                        )}
                                      >
                                        {getHeatInfo.label}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right space-y-1">
                                  {lastContactDate && (
                                    <p className="text-xs text-muted-foreground flex items-center justify-end gap-1.5">
                                      <Calendar className="h-3 w-3" />
                                      {formatDistanceToNow(new Date(lastContactDate), { addSuffix: true })}
                                    </p>
                                  )}
                                  {pendingFollowUpsCount > 0 && (
                                    <p className="text-xs text-primary flex items-center justify-end gap-1.5 font-medium">
                                      <Clock className="h-3 w-3" />
                                      {pendingFollowUpsCount} pending
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Featured DRIP Email Strategy Recommendation */}
                        <button
                          className="w-full text-left relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-accent/10 to-primary/15 border border-primary/30 p-4 hover:border-primary/50 hover:from-primary/15 hover:via-accent/15 hover:to-primary/20 hover:scale-[1.01] hover:shadow-lg hover:shadow-primary/10 transition-all duration-200 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => { setInput(DRIP_STRATEGY_PROMPT.prompt); inputRef.current?.focus(); }}
                          disabled={isLoading || isRateLimited}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200">
                              <Zap className="h-5 w-5 text-primary-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-foreground">{DRIP_STRATEGY_PROMPT.label}</span>
                                <Badge variant="secondary" className="text-[10px] bg-primary/15 text-primary border-0 px-1.5 py-0">
                                  Recommended
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {DRIP_STRATEGY_PROMPT.description} based on where this account is in the sales cycle.
                              </p>
                            </div>
                          </div>
                        </button>

                        {/* Redesigned Quick Action Buttons */}
                        <div className="grid grid-cols-2 gap-2.5">
                          {QUICK_ACTIONS.map((action) => (
                            <Button
                              key={action.id}
                              variant="outline"
                              className="h-auto py-4 flex-col gap-2 bg-card/50 backdrop-blur-sm border-border/50 hover:bg-gradient-to-br hover:from-primary/5 hover:to-primary/10 hover:border-primary/30 hover:scale-[1.02] hover:shadow-md transition-all duration-200 group"
                              onClick={() => { setInput(action.prompt); inputRef.current?.focus(); }}
                              disabled={isLoading || isRateLimited}
                            >
                              <div className="w-9 h-9 rounded-full bg-muted/80 flex items-center justify-center group-hover:bg-primary/15 group-hover:text-primary transition-all duration-200">
                                {action.icon}
                              </div>
                              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{action.label}</span>
                            </Button>
                          ))}
                        </div>

                        {/* Recap Emails Dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full h-auto py-3 justify-between bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-primary/20 hover:border-primary/40 hover:bg-gradient-to-r hover:from-primary/10 hover:via-accent/10 hover:to-primary/10 transition-all duration-200"
                              disabled={isLoading || isRateLimited}
                            >
                              <span className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-primary" />
                                <span className="font-medium">Recap Emails</span>
                              </span>
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-80 bg-popover">
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                              Generate a post-call recap email
                            </div>
                            <DropdownMenuSeparator />
                            {RECAP_EMAIL_OPTIONS.map((option) => (
                              <DropdownMenuItem
                                key={option.id}
                                className="flex items-start gap-3 py-2.5 cursor-pointer focus:bg-accent"
                                onClick={() => { setInput(option.prompt); inputRef.current?.focus(); }}
                              >
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                                  {option.icon}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-sm">{option.label}</span>
                                  <span className="text-xs text-muted-foreground">{option.description}</span>
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Enhanced Recently Asked Questions */}
                        {recentQuestions.length > 0 && (
                          <div className="animate-fade-in">
                            <p className="text-xs text-muted-foreground font-medium mb-2.5 flex items-center gap-1.5">
                              <History className="h-3 w-3" />
                              Recently Asked
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {recentQuestions.map((q, i) => (
                                <Button
                                  key={i}
                                  variant="secondary"
                                  size="sm"
                                  className="text-xs h-auto py-2 px-3 text-left justify-start font-normal bg-muted/50 hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/20 transition-all duration-200 max-w-full rounded-full"
                                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                                  disabled={isLoading || isRateLimited}
                                >
                                  <span className="truncate">{q.length > 40 ? `${q.slice(0, 40)}...` : q}</span>
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Enhanced Welcome Message */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-muted/80 via-muted/60 to-primary/5 rounded-xl p-5 border border-border/30">
                          <div className="flex gap-4">
                            <div className="shrink-0">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                                <Sparkles className="h-6 w-6 text-primary-foreground" />
                              </div>
                            </div>
                            <div>
                              <p className="text-sm leading-relaxed">
                                <span className="font-semibold text-foreground">Hey there!</span>
                                <span className="text-muted-foreground"> I'm your sales coach with 30 years of experience closing deals. 
                                I know everything about </span>
                                <strong className="text-primary">{accountName}</strong>
                                <span className="text-muted-foreground"> – their stakeholders, call history, and emails. Ask me anything!</span>
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Enhanced Category Questions */}
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground font-medium mb-3 flex items-center gap-1.5">
                            <Target className="h-3 w-3" />
                            What can I help you with?
                          </p>
                          {QUESTION_CATEGORIES.map((category) => (
                            <Collapsible key={category.id}>
                              <CollapsibleTrigger className="flex items-center justify-between w-full px-3.5 py-2.5 text-sm font-medium rounded-lg bg-card/50 hover:bg-muted/80 border border-transparent hover:border-border/50 transition-all duration-200 group">
                                <span className="flex items-center gap-2.5">
                                  <span className="text-base">{category.icon}</span>
                                  <span className="text-foreground/90">{category.label}</span>
                                </span>
                                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                              </CollapsibleTrigger>
                              <CollapsibleContent className="pl-8 pr-2 pb-2 pt-1">
                                <div className="flex flex-wrap gap-1.5">
                                  {category.questions.map((q) => (
                                    <Button
                                      key={q}
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs h-auto py-1.5 px-3 text-left justify-start font-normal text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-all duration-200"
                                      onClick={() => { setInput(q); inputRef.current?.focus(); }}
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
                      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground py-1">
                        <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-full">
                          <History className="h-3 w-3" />
                          <span>Conversation from {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}</span>
                        </div>
                      </div>
                    )}

                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex gap-3 animate-fade-in group",
                          msg.role === 'user' ? "justify-end" : "justify-start"
                        )}
                        style={{ animationDelay: `${i * 50}ms` }}
                      >
                        {msg.role === 'assistant' && (
                          <Avatar className="h-8 w-8 shrink-0 ring-2 ring-primary/20 shadow-sm">
                            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs">
                              <Sparkles className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={cn(
                            "rounded-2xl px-4 py-2.5 max-w-[85%] transition-all duration-200",
                            msg.role === 'user'
                              ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-md shadow-primary/20"
                              : "bg-gradient-to-br from-muted via-muted to-muted/80 border-l-2 border-primary/30 shadow-sm"
                          )}
                        >
                          {msg.role === 'assistant' ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown
                                components={{
                                  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                  ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>,
                                  ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>,
                                  li: ({ children }) => <li className="mb-1">{children}</li>,
                                  strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-sm leading-relaxed">{msg.content}</p>
                          )}
                        </div>
                        {msg.role === 'user' && (
                          <Avatar className="h-8 w-8 shrink-0 ring-2 ring-secondary/50 shadow-sm">
                            <AvatarFallback className="bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground text-xs">
                              <User className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    ))}

                    {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                      <div className="flex gap-3 animate-fade-in">
                        <Avatar className="h-8 w-8 shrink-0 ring-2 ring-primary/20 shadow-sm">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs">
                            <Sparkles className="h-4 w-4 animate-pulse" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="bg-gradient-to-br from-muted to-muted/80 rounded-2xl px-4 py-3 border-l-2 border-primary/30 shadow-sm">
                          <TypingIndicator />
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="bg-destructive/10 text-destructive text-sm rounded-xl px-4 py-3 border border-destructive/20 animate-fade-in">
                        {error}
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>

            {/* Premium Input Area */}
            <div className="border-t bg-gradient-to-t from-background via-background to-muted/10">
              {isRateLimited && (
                <div className="px-4 pt-3">
                  <RateLimitCountdown secondsRemaining={secondsRemaining} />
                </div>
              )}
              <form onSubmit={handleSubmit} className="p-4">
                <div className="flex gap-2.5 items-end bg-muted/30 rounded-xl p-1.5 ring-1 ring-border/50 focus-within:ring-2 focus-within:ring-primary/30 transition-all duration-200 shadow-sm">
                  <Textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isRateLimited ? "Please wait..." : "Ask your sales coach..."}
                    disabled={isLoading || isRateLimited || isLoadingHistory}
                    rows={1}
                    className="flex-1 min-h-[40px] max-h-[120px] border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60 resize-none py-2.5"
                  />
                  <Button 
                    type="submit" 
                    size="icon" 
                    disabled={isLoading || isRateLimited || !input.trim() || isLoadingHistory}
                    className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
                  Press Enter to send · ⌘K for shortcuts
                </p>
              </form>
            </div>
          </SheetContent>
        </Sheet>,
        document.body
      )}

      {/* Polished History Sheet */}
      {createPortal(
        <Sheet open={showHistorySheet} onOpenChange={setShowHistorySheet}>
          <SheetContent side="right" className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <History className="h-4 w-4 text-primary" />
                </div>
                Chat History
              </SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-120px)] mt-4">
              <div className="space-y-2.5 pr-4">
                {allSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground">No saved conversations yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Start chatting to create your first conversation</p>
                  </div>
                ) : (
                  allSessions.map((session, index) => {
                    // Get first assistant message as preview
                    const firstAssistantMessage = session.messages.find(m => m.role === 'assistant');
                    const preview = firstAssistantMessage?.content?.slice(0, 100) || 'No response yet';
                    
                    return (
                      <div
                        key={session.id}
                        className={cn(
                          "relative p-4 rounded-xl border transition-all duration-200 cursor-pointer hover:scale-[1.01] hover:shadow-md group",
                          session.is_active 
                            ? "border-primary/50 bg-gradient-to-br from-primary/5 via-primary/5 to-accent/5 shadow-sm ring-1 ring-primary/20" 
                            : "bg-card/50 hover:bg-muted/50 border-border/50"
                        )}
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => {
                          if (!session.is_active) {
                            handleSwitchSession(session.id);
                          } else {
                            setShowHistorySheet(false);
                          }
                        }}
                      >
                        {/* Active indicator bar */}
                        {session.is_active && (
                          <div className="absolute left-0 top-3 bottom-3 w-1 bg-gradient-to-b from-primary to-accent rounded-full" />
                        )}
                        
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0 pl-1">
                            <div className="flex items-center gap-2 mb-1.5">
                              <MessageSquare className={cn(
                                "h-4 w-4 shrink-0 transition-colors",
                                session.is_active ? "text-primary" : "text-muted-foreground"
                              )} />
                              <p className="text-sm font-medium truncate">
                                {session.title || 'Untitled conversation'}
                              </p>
                              {session.is_active && (
                                <Badge variant="secondary" className="text-[10px] bg-primary/15 text-primary border-primary/30 px-1.5 py-0">
                                  Active
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                              {preview}{preview.length >= 100 ? '...' : ''}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/70">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {session.messages.length} messages
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all duration-200"
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
