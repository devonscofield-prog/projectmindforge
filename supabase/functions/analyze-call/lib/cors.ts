// CORS and rate limiting utilities

import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS } from './constants.ts';

// Rate limit map (in-memory, resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Max entries to prevent memory leaks
const RATE_LIMIT_MAP_MAX_SIZE = 1000;

/**
 * Check rate limit for a user with passive cleanup of expired entries
 * Note: Removed setInterval as it's unreliable in edge functions
 */
export function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  
  // Passive cleanup: remove expired entries when checking (max 50 per call for better cleanup)
  let cleanedCount = 0;
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
      cleanedCount++;
      if (cleanedCount >= 50) break;
    }
  }
  
  // If map is too large, force cleanup of oldest entries
  if (rateLimitMap.size > RATE_LIMIT_MAP_MAX_SIZE) {
    const entriesToDelete = rateLimitMap.size - RATE_LIMIT_MAP_MAX_SIZE + 100; // Delete 100 extra for buffer
    let deletedCount = 0;
    for (const key of rateLimitMap.keys()) {
      rateLimitMap.delete(key);
      deletedCount++;
      if (deletedCount >= entriesToDelete) break;
    }
  }
  
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  userLimit.count++;
  return { allowed: true };
}

/**
 * Get CORS headers based on request origin
 */
export function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigins = [
    'https://lovable.dev',
    'https://www.lovable.dev',
  ];
  const devPatterns = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
    /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  ];
  
  // Allow custom domain from environment variable
  const customDomain = Deno.env.get('CUSTOM_DOMAIN');
  if (customDomain) {
    allowedOrigins.push(`https://${customDomain}`);
    allowedOrigins.push(`https://www.${customDomain}`);
  }
  
  // Allow StormWind domain from environment variable
  const stormwindDomain = Deno.env.get('STORMWIND_DOMAIN');
  if (stormwindDomain) {
    allowedOrigins.push(`https://${stormwindDomain}`);
    allowedOrigins.push(`https://www.${stormwindDomain}`);
  }
  
  const requestOrigin = origin || '';
  const isAllowed = allowedOrigins.includes(requestOrigin) || 
    devPatterns.some(pattern => pattern.test(requestOrigin));
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? requestOrigin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}
