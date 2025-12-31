import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface StreamAssistantParams {
  messages: ChatMessage[];
  onDelta: (delta: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

const MAX_MESSAGE_LENGTH = 12000;
const SLIDING_WINDOW_SIZE = 10;

function truncateMessage(msg: ChatMessage): ChatMessage {
  if (msg.content.length <= MAX_MESSAGE_LENGTH) return msg;
  return {
    ...msg,
    content: msg.content.substring(0, MAX_MESSAGE_LENGTH) + '... [truncated]',
  };
}

export function prepareMessagesForApi(messages: ChatMessage[], windowSize = SLIDING_WINDOW_SIZE): ChatMessage[] {
  if (messages.length <= windowSize) {
    return messages.map(truncateMessage);
  }
  
  // Keep first message for context and last N messages
  const firstMessage = truncateMessage(messages[0]);
  const recentMessages = messages.slice(-windowSize + 1).map(truncateMessage);
  
  return [
    firstMessage,
    { role: 'assistant', content: '[Earlier conversation summarized for brevity]' },
    ...recentMessages,
  ];
}

export async function streamAssistantResponse({
  messages,
  onDelta,
  onDone,
  onError,
}: StreamAssistantParams): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      onError('Not authenticated');
      return;
    }

    const preparedMessages = prepareMessagesForApi(messages);
    
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-assistant-chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: preparedMessages }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        onError('Rate limit exceeded. Please wait a moment before trying again.');
        return;
      }
      if (response.status === 402) {
        onError('Usage limit reached. Please contact support.');
        return;
      }
      const errorData = await response.json().catch(() => ({}));
      onError(errorData.error || `Error: ${response.status}`);
      return;
    }

    if (!response.body) {
      onError('No response body');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (!trimmed.startsWith('data: ')) continue;

        const jsonStr = trimmed.slice(6);
        if (jsonStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            onDelta(content);
          }
        } catch {
          // Ignore parse errors for incomplete chunks
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const lines = buffer.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6);
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          // Ignore
        }
      }
    }

    onDone();
  } catch (error) {
    console.error('[salesAssistant] Stream error:', error);
    onError(error instanceof Error ? error.message : 'Unknown error');
  }
}
