import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface StreamAdminTranscriptChatParams {
  transcriptIds: string[];
  messages: ChatMessage[];
  useRag?: boolean;
  onDelta: (delta: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export async function streamAdminTranscriptChat({
  transcriptIds,
  messages,
  useRag = false,
  onDelta,
  onDone,
  onError,
}: StreamAdminTranscriptChatParams): Promise<void> {
  const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-transcript-chat`;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      onError('You must be logged in to use transcript analysis');
      return;
    }

    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ 
        transcript_ids: transcriptIds, 
        messages,
        use_rag: useRag,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        onError('Rate limit exceeded. Please wait a moment and try again.');
        return;
      }
      if (response.status === 402) {
        onError('Usage limit reached. Please add credits to continue.');
        return;
      }
      if (response.status === 403) {
        onError('Admin access required for transcript analysis.');
        return;
      }
      const errorData = await response.json().catch(() => ({}));
      onError(errorData.error || 'Failed to get analysis response');
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
    console.error('[adminTranscriptChat] Stream error:', error);
    onError(error instanceof Error ? error.message : 'Connection error');
  }
}
