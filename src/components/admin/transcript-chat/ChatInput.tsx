import { useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { RateLimitCountdown } from '@/components/ui/rate-limit-countdown';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  isRateLimited: boolean;
  secondsRemaining: number;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function ChatInput({
  input,
  isLoading,
  isRateLimited,
  secondsRemaining,
  inputRef,
  onInputChange,
  onSubmit,
  onKeyDown,
}: ChatInputProps) {
  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input, inputRef]);

  return (
    <div className="border-t bg-gradient-to-t from-background via-background to-muted/10">
      {isRateLimited && (
        <div className="px-4 pt-3">
          <RateLimitCountdown secondsRemaining={secondsRemaining} />
        </div>
      )}
      <form onSubmit={onSubmit} className="p-4">
        <div className="flex gap-2.5 items-end bg-muted/30 rounded-xl p-1.5 ring-1 ring-border/50 focus-within:ring-2 focus-within:ring-primary/30 transition-all duration-200 shadow-sm">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={isRateLimited ? "Please wait..." : "Ask about these transcripts..."}
            disabled={isLoading || isRateLimited}
            rows={1}
            className="flex-1 min-h-[40px] max-h-[120px] border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60 resize-none py-2.5"
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={!input.trim() || isLoading || isRateLimited}
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
          Responses are grounded only in the selected transcripts • Auto-saved
        </p>
      </form>
    </div>
  );
}
