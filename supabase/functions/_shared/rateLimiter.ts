/**
 * Database-backed rate limiter using Supabase.
 *
 * Uses upsert on a `rate_limits` table to count requests per window.
 * Falls back to allowing the request with a warning if the table doesn't exist.
 *
 * Expected table schema (auto-creates if missing):
 *   rate_limits (
 *     key TEXT PRIMARY KEY,
 *     request_count INTEGER NOT NULL DEFAULT 1,
 *     window_start TIMESTAMPTZ NOT NULL DEFAULT now()
 *   )
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

/**
 * Check rate limit for a user+function combination using database state.
 * This is shared across all edge function instances, unlike in-memory Maps.
 */
export async function checkRateLimit(
  supabaseAdmin: SupabaseClient,
  userId: string,
  functionName: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const key = `${functionName}:${userId}`;
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  try {
    // Try to get existing entry within the current window
    const { data: existing, error: selectError } = await supabaseAdmin
      .from('rate_limits')
      .select('request_count, window_start')
      .eq('key', key)
      .gte('window_start', windowStart)
      .maybeSingle();

    if (selectError) {
      // Table likely doesn't exist - allow request with warning
      if (selectError.message?.includes('relation') || selectError.code === '42P01') {
        console.warn(`[rateLimiter] rate_limits table not found, allowing request. Run migration to create it.`);
        return { allowed: true };
      }
      console.warn(`[rateLimiter] DB error checking rate limit for ${key}:`, selectError.message);
      // On unexpected DB errors, allow the request to avoid blocking users
      return { allowed: true };
    }

    if (existing) {
      // Entry exists within window - check if over limit
      if (existing.request_count >= maxRequests) {
        const windowEnd = new Date(new Date(existing.window_start).getTime() + windowSeconds * 1000);
        const retryAfter = Math.max(1, Math.ceil((windowEnd.getTime() - Date.now()) / 1000));
        return { allowed: false, retryAfter };
      }

      // Increment counter
      const { error: updateError } = await supabaseAdmin
        .from('rate_limits')
        .update({ request_count: existing.request_count + 1 })
        .eq('key', key)
        .gte('window_start', windowStart);

      if (updateError) {
        console.warn(`[rateLimiter] Failed to increment counter for ${key}:`, updateError.message);
      }

      return { allowed: true };
    }

    // No entry in current window - create new one (upsert handles race conditions)
    const { error: upsertError } = await supabaseAdmin
      .from('rate_limits')
      .upsert(
        { key, request_count: 1, window_start: new Date().toISOString() },
        { onConflict: 'key' }
      );

    if (upsertError) {
      if (upsertError.message?.includes('relation') || upsertError.code === '42P01') {
        console.warn(`[rateLimiter] rate_limits table not found, allowing request. Run migration to create it.`);
        return { allowed: true };
      }
      console.warn(`[rateLimiter] Failed to upsert rate limit for ${key}:`, upsertError.message);
    }

    return { allowed: true };
  } catch (err) {
    // Never block requests due to rate limiter infrastructure failure
    console.warn(`[rateLimiter] Unexpected error for ${key}:`, err instanceof Error ? err.message : err);
    return { allowed: true };
  }
}
