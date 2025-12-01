import { createLogger } from '@/lib/logger';

const log = createLogger('accountResearch');

export interface AccountResearchRequest {
  companyName: string;
  website?: string;
  industry?: string;
  stakeholders?: Array<{ name: string; title?: string; role?: string }>;
  productPitch?: string;
  dealStage?: string;
  knownChallenges?: string;
  additionalNotes?: string;
}

export interface StreamAccountResearchOptions {
  request: AccountResearchRequest;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

/**
 * Streams account research from the AI edge function
 */
export async function streamAccountResearch({
  request,
  onDelta,
  onDone,
  onError,
}: StreamAccountResearchOptions): Promise<void> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/account-research`;

  try {
    log.info('Starting account research stream', { company: request.companyName });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `Research failed with status ${response.status}`;
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      if (response.status === 402) {
        throw new Error('AI usage limit reached. Please add funds to continue.');
      }
      
      throw new Error(errorMessage);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process SSE lines
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') {
          onDone();
          return;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            onDelta(content);
          }
        } catch {
          // Incomplete JSON, put it back and wait for more data
          buffer = line + '\n' + buffer;
          break;
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      for (let raw of buffer.split('\n')) {
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
        } catch {
          // Ignore parse errors on final flush
        }
      }
    }

    onDone();
  } catch (error) {
    log.error('Account research stream error', { error });
    onError(error instanceof Error ? error : new Error('Unknown error'));
  }
}
