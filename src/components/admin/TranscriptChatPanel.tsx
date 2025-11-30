import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { streamAdminTranscriptChat, ChatMessage } from '@/api/adminTranscriptChat';
import { SaveInsightDialog } from '@/components/admin/SaveInsightDialog';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Loader2,
  Sparkles,
  FileText,
  AlertCircle,
  MessageSquare,
  TrendingUp,
  Users,
  Target,
  Zap,
  Search,
  Lightbulb,
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

const STARTER_QUESTIONS = [
  {
    icon: AlertCircle,
    label: 'Objections',
    prompt: 'What objections come up repeatedly across these calls? List them with specific examples and which calls they appeared in.',
  },
  {
    icon: Users,
    label: 'Pricing Discussions',
    prompt: 'Compare how different reps handle pricing discussions. What techniques are working and what could be improved?',
  },
  {
    icon: Target,
    label: 'Competitors',
    prompt: 'What competitor names are mentioned and in what context? Are there patterns in how competitors come up?',
  },
  {
    icon: TrendingUp,
    label: 'Pain Points',
    prompt: 'What are the most common customer pain points mentioned across these calls?',
  },
  {
    icon: Zap,
    label: 'Key Themes',
    prompt: 'Summarize the key themes across these calls. What patterns emerge in successful vs unsuccessful conversations?',
  },
];

export function TranscriptChatPanel({ selectedTranscripts, useRag = false, selectionId, onClose }: TranscriptChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveInsightOpen, setSaveInsightOpen] = useState(false);
  const [insightToSave, setInsightToSave] = useState<string>('');
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading || selectedTranscripts.length === 0) return;

    setError(null);
    const userMessage: ChatMessage = { role: 'user', content: content.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    let assistantContent = '';

    try {
      await streamAdminTranscriptChat({
        transcriptIds: selectedTranscripts.map(t => t.id),
        messages: newMessages,
        useRag,
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
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
      setIsLoading(false);
    }
  }, [messages, isLoading, selectedTranscripts, useRag]);

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <SheetHeader className="px-6 py-4 border-b">
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          {selectedTranscripts.length} transcripts selected
          {!useRag && (
            <Badge variant="outline" className="text-xs">
              ~{Math.round(selectedTranscripts.reduce((sum, t) => sum + (t.raw_text?.length || 0), 0) / 4).toLocaleString()} tokens
            </Badge>
          )}
        </div>
      </SheetHeader>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 px-6">
        <div className="py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-6">
              {/* Introduction */}
              <div className="text-center py-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                  {useRag ? <Search className="h-6 w-6 text-primary" /> : <MessageSquare className="h-6 w-6 text-primary" />}
                </div>
                <h3 className="font-semibold mb-1">Analyze Your Transcripts</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  {useRag 
                    ? `Using semantic search across ${selectedTranscripts.length} transcripts to find relevant sections for your questions.`
                    : `Ask questions about the ${selectedTranscripts.length} selected transcripts. I'll only reference information explicitly stated in the calls.`
                  }
                </p>
              </div>

              {/* Starter Questions */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Suggested questions
                </p>
                <div className="grid gap-2">
                  {STARTER_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleStarterQuestion(q.prompt)}
                      disabled={isLoading}
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
                            // Style citations
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

          {isLoading && messages[messages.length - 1]?.role === 'user' && (
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
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about these transcripts..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
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

      {/* Save Insight Dialog */}
      <SaveInsightDialog
        open={saveInsightOpen}
        onOpenChange={setSaveInsightOpen}
        content={insightToSave}
        chatContext={messages}
        selectionId={selectionId}
      />
    </div>
  );
}
