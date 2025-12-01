import { useState, useCallback } from 'react';
import { streamAdminTranscriptChat, ChatMessage } from '@/api/adminTranscriptChat';
import { useToast } from '@/hooks/use-toast';
import { useRateLimitCountdown } from '@/hooks/useRateLimitCountdown';

interface UseTranscriptChatOptions {
  selectedTranscriptIds: string[];
  useRag: boolean;
  selectedModeId: string;
}

export function useTranscriptChat({ selectedTranscriptIds, useRag, selectedModeId }: UseTranscriptChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { secondsRemaining, isRateLimited, startCountdown } = useRateLimitCountdown(60);

  const sendMessage = useCallback(async (content: string, modeOverride?: string) => {
    if (!content.trim() || isLoading || isRateLimited || selectedTranscriptIds.length === 0) return;

    setError(null);
    const userMessage: ChatMessage = { role: 'user', content: content.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    setIsStreaming(true);

    let assistantContent = '';
    const modeToUse = modeOverride || selectedModeId;

    try {
      await streamAdminTranscriptChat({
        transcriptIds: selectedTranscriptIds,
        messages: newMessages,
        useRag,
        analysisMode: modeToUse,
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
          setIsStreaming(false);
        },
        onError: (err) => {
          setError(err);
          setIsLoading(false);
          setIsStreaming(false);
          if (err.toLowerCase().includes('rate limit')) {
            startCountdown(60);
            toast({
              title: 'Too many requests',
              description: 'Please wait before sending another message.',
              variant: 'destructive',
            });
          }
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [messages, isLoading, isRateLimited, selectedTranscriptIds, useRag, selectedModeId, toast, startCountdown]);

  return {
    messages,
    setMessages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    isRateLimited,
    secondsRemaining,
  };
}
