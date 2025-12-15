import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertCircle, Lightbulb, Sparkles, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisMessageRenderer } from '../AnalysisMessageRenderer';
import { PresetSelector } from './PresetSelector';
import { TypingIndicator } from './TypingIndicator';
import type { ChatMessage } from '@/api/adminTranscriptChat';
import type { AnalysisMode, ModePreset } from '../transcript-analysis/analysisModesConfig';
import type { CustomPreset } from '@/api/customPresets';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  isRateLimited: boolean;
  error: string | null;
  selectedMode: AnalysisMode;
  customPresets: CustomPreset[];
  isLoadingPresets: boolean;
  scrollAreaRef: React.RefObject<HTMLDivElement>;
  onStarterQuestion: (prompt: string) => void;
  onPresetSelect: (preset: ModePreset) => void;
  onCustomPresetSelect: (preset: CustomPreset) => void;
  onSaveInsight: (content: string) => void;
  onCreatePreset: () => void;
  onEditPreset: (preset: CustomPreset) => void;
  onDeletePreset: (id: string) => void;
}

export function ChatMessages({
  messages,
  isLoading,
  isStreaming,
  isRateLimited,
  error,
  selectedMode,
  customPresets,
  isLoadingPresets,
  scrollAreaRef,
  onStarterQuestion,
  onPresetSelect,
  onCustomPresetSelect,
  onSaveInsight,
  onCreatePreset,
  onEditPreset,
  onDeletePreset,
}: ChatMessagesProps) {
  const ModeIcon = selectedMode.icon;
  const starterQuestions = selectedMode.starterQuestions;

  return (
    <ScrollArea ref={scrollAreaRef} className="flex-1 px-6 bg-gradient-to-b from-background to-muted/20">
      <div className="py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="space-y-6 animate-fade-in">
            <PresetSelector
              customPresets={customPresets}
              isLoadingPresets={isLoadingPresets}
              isLoading={isLoading}
              isRateLimited={isRateLimited}
              onPresetSelect={onPresetSelect}
              onCustomPresetSelect={onCustomPresetSelect}
              onCreatePreset={onCreatePreset}
              onEditPreset={onEditPreset}
              onDeletePreset={onDeletePreset}
            />

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or ask a question</span>
              </div>
            </div>

            {/* Enhanced Introduction */}
            <div className="relative overflow-hidden bg-gradient-to-br from-muted/80 via-muted/60 to-primary/5 rounded-xl p-5 border border-border/30">
              <div className="flex gap-4">
                <div className="shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                    <ModeIcon className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">{selectedMode.label}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedMode.description}
                  </p>
                </div>
              </div>
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
                    onClick={() => onStarterQuestion(q.prompt)}
                    disabled={isLoading || isRateLimited}
                    className="flex items-center gap-3 p-3 text-left text-sm rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm hover:bg-gradient-to-br hover:from-primary/5 hover:to-primary/10 hover:border-primary/30 hover:scale-[1.01] hover:shadow-sm transition-all duration-200 disabled:opacity-50 group"
                  >
                    <div className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center group-hover:bg-primary/15 group-hover:text-primary transition-all duration-200 shrink-0">
                      <q.icon className="h-4 w-4" />
                    </div>
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">{q.label}</span>
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
                "flex gap-3 animate-fade-in group",
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {message.role === 'assistant' && (
                <Avatar className="h-8 w-8 shrink-0 ring-2 ring-primary/20 shadow-sm">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs">
                    <Sparkles className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 relative transition-all duration-200",
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground max-w-[85%] shadow-md shadow-primary/20'
                    : 'bg-gradient-to-br from-muted via-muted to-muted/80 border-l-2 border-primary/30 w-full max-w-full shadow-sm'
                )}
              >
                {message.role === 'assistant' ? (
                  <>
                    <AnalysisMessageRenderer 
                      content={message.content} 
                      isStreaming={isStreaming && i === messages.length - 1}
                    />
                    {!isLoading && message.content && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 text-xs gap-1 bg-background border shadow-sm hover:bg-primary/5 hover:border-primary/30"
                        onClick={() => onSaveInsight(message.content)}
                      >
                        <Lightbulb className="h-3 w-3" />
                        Save Insight
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                )}
              </div>
              {message.role === 'user' && (
                <Avatar className="h-8 w-8 shrink-0 ring-2 ring-secondary/50 shadow-sm">
                  <AvatarFallback className="bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground text-xs">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))
        )}

        {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
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
          <div className="flex items-center gap-2 p-4 text-sm text-destructive bg-destructive/10 rounded-xl border border-destructive/20 animate-fade-in">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
