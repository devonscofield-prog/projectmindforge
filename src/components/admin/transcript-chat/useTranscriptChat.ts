import { useState, useCallback } from 'react';
import { streamAdminTranscriptChat, ChatMessage } from '@/api/adminTranscriptChat';
import { toast } from 'sonner';
import { useRateLimitCountdown } from '@/hooks/useRateLimitCountdown';

interface UseTranscriptChatOptions {
  selectedTranscriptIds: string[];
  useRag: boolean;
  selectedModeId: string;
}

// Parse specific error types for better user messaging
function parseErrorMessage(error: string): { message: string; isRetryable: boolean } {
  const lowerError = error.toLowerCase();
  
  if (lowerError.includes('rate limit')) {
    return { 
      message: 'Too many requests. Please wait a moment before trying again.', 
      isRetryable: false 
    };
  }
  
  if (lowerError.includes('unable to process') || lowerError.includes('failed to index')) {
    return { 
      message: 'Unable to process these transcripts. Try selecting 20 or fewer calls, or click "Pre-Index" first to prepare them for analysis.', 
      isRetryable: true 
    };
  }
  
  if (lowerError.includes('only analyze your own')) {
    return { 
      message: 'You can only analyze your own call transcripts.', 
      isRetryable: false 
    };
  }
  
  if (lowerError.includes('only analyze transcripts from your team')) {
    return { 
      message: 'You can only analyze transcripts from reps on your team.', 
      isRetryable: false 
    };
  }
  
  if (lowerError.includes('no team assigned')) {
    return { 
      message: 'No team assigned to your account. Please contact an administrator.', 
      isRetryable: false 
    };
  }
  
  if (lowerError.includes('usage limit') || lowerError.includes('add credits')) {
    return { 
      message: 'Usage limit reached. Please contact support to continue.', 
      isRetryable: false 
    };
  }
  
  if (lowerError.includes('admin access required')) {
    return { 
      message: 'You don\'t have permission to access this feature.', 
      isRetryable: false 
    };
  }
  
  // Default error
  return { 
    message: error || 'Something went wrong. Please try again.', 
    isRetryable: true 
  };
}

export function useTranscriptChat({ selectedTranscriptIds, useRag, selectedModeId }: UseTranscriptChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
          const { message, isRetryable } = parseErrorMessage(err);
          setError(message);
          setIsLoading(false);
          setIsStreaming(false);
          
          if (err.toLowerCase().includes('rate limit')) {
            startCountdown(60);
          }
          
          toast.error(isRetryable ? 'Analysis failed' : 'Access denied', {
            description: message,
          });
        },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get response';
      const { message } = parseErrorMessage(errorMsg);
      setError(message);
      setIsLoading(false);
      setIsStreaming(false);
      
      toast.error('Analysis failed', {
        description: message,
      });
    }
  }, [messages, isLoading, isRateLimited, selectedTranscriptIds, useRag, selectedModeId, startCountdown]);

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
