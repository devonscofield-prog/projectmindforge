/**
 * Shared CORS utility for Supabase Edge Functions.
 *
 * Validates the request Origin against an allowlist of production domains,
 * development patterns, and optional custom domains from environment variables.
 *
 * Usage:
 *   import { getCorsHeaders } from "../_shared/cors.ts";
 *
 *   Deno.serve(async (req) => {
 *     const origin = req.headers.get('Origin');
 *     const corsHeaders = getCorsHeaders(origin);
 *     if (req.method === 'OPTIONS') {
 *       return new Response(null, { headers: corsHeaders });
 *     }
 *     // ... handler logic ...
 *   });
 */

/**
 * Returns CORS headers with the Access-Control-Allow-Origin set to the
 * request origin only when it matches the allowlist. Otherwise falls back
 * to the first allowed origin so the browser will reject the response.
 */
export function getCorsHeaders(origin?: string | null): Record<string, string> {
  // --- static allowlist ---------------------------------------------------
  const allowedOrigins = [
    'https://lovable.dev',
    'https://www.lovable.dev',
  ];

  // --- dynamic patterns for dev / preview environments --------------------
  const devPatterns = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
    /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  ];

  // --- environment-driven origins -----------------------------------------
  // ALLOWED_ORIGINS: comma-separated list of extra allowed origins
  const extraOrigins = Deno.env.get('ALLOWED_ORIGINS');
  if (extraOrigins) {
    for (const o of extraOrigins.split(',')) {
      const trimmed = o.trim();
      if (trimmed) allowedOrigins.push(trimmed);
    }
  }

  // CUSTOM_DOMAIN: convenience for a single custom domain
  const customDomain = Deno.env.get('CUSTOM_DOMAIN');
  if (customDomain) {
    const cleanDomain = customDomain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '')
      .trim();
    if (cleanDomain) {
      allowedOrigins.push(`https://${cleanDomain}`);
      allowedOrigins.push(`https://www.${cleanDomain}`);
    }
  }

  // STORMWIND_DOMAIN: product-specific custom domain
  const stormwindDomain = Deno.env.get('STORMWIND_DOMAIN');
  if (stormwindDomain) {
    allowedOrigins.push(`https://${stormwindDomain}`);
    allowedOrigins.push(`https://www.${stormwindDomain}`);
  }

  // --- origin check -------------------------------------------------------
  const requestOrigin = origin || '';
  const isAllowed =
    allowedOrigins.includes(requestOrigin) ||
    devPatterns.some((pattern) => pattern.test(requestOrigin));

  return {
    'Access-Control-Allow-Origin': isAllowed ? requestOrigin : allowedOrigins[0],
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}
