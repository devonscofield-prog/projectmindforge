/**
 * Shared Edge Function Utilities
 * 
 * IMPORTANT: Since Supabase edge functions cannot import from other local files,
 * copy the utilities you need into your function's index.ts file.
 * 
 * This file serves as a reference implementation.
 */

// ============================================================================
// CORS UTILITIES
// ============================================================================

/**
 * Standard CORS headers for Lovable domains
 */
export function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigins = ['https://lovable.dev', 'https://www.lovable.dev'];
  const devPatterns = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
    /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  ];
  
  const requestOrigin = origin || '';
  const isAllowed = allowedOrigins.includes(requestOrigin) || 
    devPatterns.some(pattern => pattern.test(requestOrigin));
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? requestOrigin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// ============================================================================
// RATE LIMITING
// ============================================================================

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Simple in-memory rate limiter
 */
export function checkRateLimit(
  userId: string, 
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 10 }
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  
  if (!entry || now >= entry.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + config.windowMs });
    return { allowed: true };
  }
  
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  entry.count++;
  return { allowed: true };
}

/**
 * Start rate limit cleanup interval (call once per function)
 */
export function startRateLimitCleanup(intervalMs = 60000): void {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, intervalMs);
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if a value is a valid UUID
 */
export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * Validate a single UUID field
 */
export function validateUUID(value: unknown, fieldName: string): string | null {
  if (!isValidUUID(value)) {
    return `${fieldName} must be a valid UUID`;
  }
  return null;
}

/**
 * Validate an array of UUIDs
 */
export function validateUUIDArray(
  values: unknown, 
  fieldName: string, 
  maxLength = 500
): string | null {
  if (!Array.isArray(values)) {
    return `${fieldName} must be an array`;
  }
  if (values.length === 0) {
    return `${fieldName} cannot be empty`;
  }
  if (values.length > maxLength) {
    return `${fieldName} cannot exceed ${maxLength} items`;
  }
  for (let i = 0; i < values.length; i++) {
    if (!isValidUUID(values[i])) {
      return `${fieldName}[${i}] must be a valid UUID`;
    }
  }
  return null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Validate chat messages array
 */
export function validateMessages(
  messages: unknown, 
  maxContentLength = 50000
): string | null {
  if (!Array.isArray(messages)) {
    return 'messages must be an array';
  }
  if (messages.length === 0) {
    return 'messages cannot be empty';
  }
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || typeof msg !== 'object') {
      return `messages[${i}] must be an object`;
    }
    if (!['user', 'assistant'].includes((msg as ChatMessage).role)) {
      return `messages[${i}].role must be 'user' or 'assistant'`;
    }
    if (typeof (msg as ChatMessage).content !== 'string' || (msg as ChatMessage).content.length === 0) {
      return `messages[${i}].content must be a non-empty string`;
    }
    if ((msg as ChatMessage).content.length > maxContentLength) {
      return `messages[${i}].content exceeds maximum length of ${maxContentLength} characters`;
    }
  }
  return null;
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/**
 * Create a JSON error response
 */
export function errorResponse(
  message: string, 
  status: number, 
  corsHeaders: Record<string, string>,
  retryAfter?: number
): Response {
  const headers: Record<string, string> = { 
    ...corsHeaders, 
    'Content-Type': 'application/json' 
  };
  if (retryAfter) {
    headers['Retry-After'] = String(retryAfter);
  }
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers }
  );
}

/**
 * Create a JSON success response
 */
export function jsonResponse(
  data: unknown, 
  corsHeaders: Record<string, string>,
  status = 200
): Response {
  return new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ============================================================================
// AUTH UTILITIES
// ============================================================================

/**
 * Extract user ID from JWT token
 */
export function extractUserIdFromJWT(authHeader: string | null): string {
  if (!authHeader) return 'anonymous';
  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || 'anonymous';
  } catch {
    return 'anonymous';
  }
}

// ============================================================================
// LOVABLE AI GATEWAY
// ============================================================================

export interface AIRequestOptions {
  model?: string;
  systemPrompt: string;
  messages: ChatMessage[];
  tools?: unknown[];
  toolChoice?: unknown;
  stream?: boolean;
}

/**
 * Call Lovable AI Gateway
 */
export async function callLovableAI(options: AIRequestOptions): Promise<Response> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  const body: Record<string, unknown> = {
    model: options.model || 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: options.systemPrompt },
      ...options.messages,
    ],
  };

  if (options.tools) {
    body.tools = options.tools;
  }
  if (options.toolChoice) {
    body.tool_choice = options.toolChoice;
  }
  if (options.stream) {
    body.stream = true;
  }

  return fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

/**
 * Handle AI Gateway response, converting errors to proper responses
 */
export async function handleAIResponse(
  response: Response, 
  corsHeaders: Record<string, string>,
  functionName: string
): Promise<Response> {
  if (!response.ok) {
    if (response.status === 429) {
      return errorResponse('Rate limit exceeded, please try again in a moment', 429, corsHeaders);
    }
    if (response.status === 402) {
      return errorResponse('Usage limit reached, please add credits', 402, corsHeaders);
    }
    const errorText = await response.text();
    console.error(`[${functionName}] AI Gateway error:`, response.status, errorText);
    throw new Error(`AI Gateway error: ${response.status}`);
  }
  return response;
}

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Create a prefixed logger for consistent logging
 */
export function createLogger(functionName: string) {
  return {
    info: (message: string, data?: unknown) => {
      console.log(`[${functionName}] ${message}`, data ? JSON.stringify(data) : '');
    },
    warn: (message: string, data?: unknown) => {
      console.warn(`[${functionName}] ${message}`, data ? JSON.stringify(data) : '');
    },
    error: (message: string, data?: unknown) => {
      console.error(`[${functionName}] ${message}`, data ? JSON.stringify(data) : '');
    },
  };
}
