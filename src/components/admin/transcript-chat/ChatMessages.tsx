import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisMessageRenderer } from '../AnalysisMessageRenderer';
import { PresetSelector } from './PresetSelector';
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
    <ScrollArea ref={scrollAreaRef} className="flex-1 px-6">
      <div className="py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="space-y-6">
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
                    onClick={() => onStarterQuestion(q.prompt)}
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
                  "rounded-lg px-4 py-3 group relative",
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground max-w-[85%]'
                    : 'bg-muted w-full max-w-full'
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
                        className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 text-xs gap-1 bg-background border shadow-sm"
                        onClick={() => onSaveInsight(message.content)}
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
  );
}
