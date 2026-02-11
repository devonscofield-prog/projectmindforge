/**
 * Shared retry helper with exponential backoff for API calls.
 * Used by SDR edge functions (sdr-process-transcript, sdr-grade-call).
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  { maxRetries = 3, baseDelayMs = 1000, agentName = 'unknown' } = {},
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on rate-limit (429) or server errors (500+), but not on 4xx client errors
      if (response.ok) return response;

      const errorText = await response.text();

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`${agentName} API error (attempt ${attempt}/${maxRetries}): ${response.status} - ${errorText}`);
        console.warn(`[sdr-pipeline] ${lastError.message}`);

        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
          console.log(`[sdr-pipeline] ${agentName}: Retrying in ${Math.round(delay)}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      } else {
        // Non-retryable error (400, 401, 403, etc.)
        throw new Error(`${agentName} API error: ${response.status} - ${errorText}`);
      }
    } catch (error: any) {
      // Network errors, timeouts — retryable
      if (error.name === 'TimeoutError' || error.name === 'AbortError' || error.message?.includes('fetch failed')) {
        lastError = new Error(`${agentName} timeout/network error (attempt ${attempt}/${maxRetries}): ${error.message}`);
        console.warn(`[sdr-pipeline] ${lastError.message}`);

        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
          console.log(`[sdr-pipeline] ${agentName}: Retrying in ${Math.round(delay)}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      } else {
        // Non-retryable error — always throw immediately
        throw error;
      }
    }
  }

  throw lastError || new Error(`${agentName}: All ${maxRetries} attempts failed`);
}
