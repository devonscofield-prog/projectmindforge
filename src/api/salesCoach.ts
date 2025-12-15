import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('salesCoach');

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface StreamCoachParams {
  prospectId: string;
  messages: ChatMessage[];
  onDelta: (delta: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

// Message windowing constants
const MESSAGE_WINDOW_SIZE = 10;
const MAX_MESSAGE_LENGTH = 6000;

/**
 * Truncate individual messages that are too long to prevent payload bloat
 */
function truncateMessage(msg: ChatMessage): ChatMessage {
  if (msg.content.length <= MAX_MESSAGE_LENGTH) {
    return msg;
  }
  return {
    ...msg,
    content: msg.content.slice(0, MAX_MESSAGE_LENGTH) + '... [truncated for length]'
  };
}

/**
 * Prepare messages for API - window to recent messages only
 * Keeps the most recent N messages in full, summarizes older ones
 */
function prepareMessagesForApi(messages: ChatMessage[], windowSize = MESSAGE_WINDOW_SIZE): ChatMessage[] {
  // First, truncate all individual messages
  const truncatedMessages = messages.map(truncateMessage);
  
  if (truncatedMessages.length <= windowSize) {
    return truncatedMessages;
  }
  
  // Keep last N messages in full
  const recentMessages = truncatedMessages.slice(-windowSize);
  
  // Summarize earlier messages into a context note
  const oldMessageCount = truncatedMessages.length - windowSize;
  const contextSummary: ChatMessage = { 
    role: 'user', 
    content: `[Context: ${oldMessageCount} earlier messages were exchanged about this account. The conversation has been ongoing.]` 
  };
  
  return [contextSummary, ...recentMessages];
}

export async function streamCoachResponse({
  prospectId,
  messages,
  onDelta,
  onDone,
  onError,
}: StreamCoachParams): Promise<void> {
  const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-coach-chat`;
  console.log('[SalesCoach] Starting request to:', CHAT_URL);

  try {
    console.log('[SalesCoach] Getting auth session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('[SalesCoach] Session error:', sessionError);
      onError('Session error: ' + sessionError.message);
      return;
    }
    
    if (!session) {
      console.error('[SalesCoach] No session found');
      onError('You must be logged in to use the sales coach');
      return;
    }
    console.log('[SalesCoach] Session obtained for user:', session.user?.email);

    // Window messages to prevent payload size issues
    const windowedMessages = prepareMessagesForApi(messages);
    console.log('[SalesCoach] Prepared messages:', { 
      originalCount: messages.length, 
      windowedCount: windowedMessages.length 
    });

    const requestBody = JSON.stringify({ 
      prospect_id: prospectId, 
      messages: windowedMessages 
    });
    console.log('[SalesCoach] Request body size:', requestBody.length, 'bytes');
    console.log('[SalesCoach] Making fetch request...');

    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: requestBody,
    });
    console.log('[SalesCoach] Response received, status:', response.status);

    if (!response.ok) {
      if (response.status === 429) {
        onError('Rate limit exceeded. Please wait a moment and try again.');
        return;
      }
      if (response.status === 402) {
        onError('Usage limit reached. Please add credits to continue.');
        return;
      }
      const errorData = await response.json().catch(() => ({}));
      onError(errorData.error || 'Failed to get coach response');
      return;
    }

    if (!response.body) {
      onError('No response body');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          // Incomplete JSON, put it back
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split('\n')) {
        if (!raw) continue;
        if (raw.endsWith('\r')) raw = raw.slice(0, -1);
        if (raw.startsWith(':') || raw.trim() === '') continue;
        if (!raw.startsWith('data: ')) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (error) {
    console.error('[SalesCoach] Caught error:', error);
    console.error('[SalesCoach] Error name:', error instanceof Error ? error.name : 'unknown');
    console.error('[SalesCoach] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[SalesCoach] Error stack:', error instanceof Error ? error.stack : 'no stack');
    log.error('Stream error', { error });
    onError(error instanceof Error ? error.message : 'Connection error');
  }
}
