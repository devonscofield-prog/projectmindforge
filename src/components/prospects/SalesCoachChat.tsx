import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Loader2, Sparkles, User, ChevronDown, Trash2, History } from 'lucide-react';
import { streamCoachResponse, type ChatMessage } from '@/api/salesCoach';
import { fetchCoachSession, saveCoachSession, clearCoachSession, type CoachMessage } from '@/api/salesCoachSessions';
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
}

interface QuestionCategory {
  id: string;
  icon: string;
  label: string;
  questions: string[];
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
    ],
  },
];

export function SalesCoachChat({ prospectId, accountName }: SalesCoachChatProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { secondsRemaining, isRateLimited, startCountdown } = useRateLimitCountdown(60);

  // Load session when sheet opens
  useEffect(() => {
    const loadSession = async () => {
      if (!isOpen || !user?.id || hasLoadedHistory) return;
      
      setIsLoadingHistory(true);
      const session = await fetchCoachSession(user.id, prospectId);
      if (session && session.messages.length > 0) {
        setMessages(session.messages);
        setLastUpdated(session.updated_at);
      }
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
    await saveCoachSession(user.id, prospectId, messagesToSave);
  }, [user?.id, prospectId]);

  const handleClearHistory = async () => {
    if (!user?.id) return;
    
    const success = await clearCoachSession(user.id, prospectId);
    if (success) {
      setMessages([]);
      setLastUpdated(null);
      toast.success('Chat history cleared');
    } else {
      toast.error('Failed to clear history');
    }
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
      await streamCoachResponse({
        prospectId,
        messages: newMessages,
        onDelta: updateAssistant,
        onDone: () => {
          setIsLoading(false);
          // Save session after response is complete
          const finalMessages = [...newMessages, { role: 'assistant' as const, content: assistantContent }];
          saveSession(finalMessages);
          setLastUpdated(new Date().toISOString());
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
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
                onClick={handleClearHistory}
                title="Clear chat history"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
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
                  <div className="space-y-3">
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
    </>
  );
}
