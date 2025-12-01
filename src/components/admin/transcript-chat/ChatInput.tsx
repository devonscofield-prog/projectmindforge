import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RateLimitCountdown } from '@/components/ui/rate-limit-countdown';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  isRateLimited: boolean;
  secondsRemaining: number;
  inputRef: React.RefObject<HTMLInputElement>;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
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
  return (
    <div className="border-t">
      {isRateLimited && (
        <div className="px-4 pt-3">
          <RateLimitCountdown secondsRemaining={secondsRemaining} />
        </div>
      )}
      <div className="p-4">
        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={isRateLimited ? "Please wait..." : "Ask about these transcripts..."}
            disabled={isLoading || isRateLimited}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading || isRateLimited}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Responses are grounded only in the selected transcripts • Auto-saved
        </p>
      </div>
    </div>
  );
}
