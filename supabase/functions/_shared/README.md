# Shared Edge Function Utilities

This directory contains shared modules that can be imported by edge functions.

## Shared Modules

### CORS (`cors.ts`)

All edge functions must use the shared CORS utility. Never use `'Access-Control-Allow-Origin': '*'`.

```typescript
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  // ...
});
```

### Rate Limiting

```typescript
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(
  userId: string, 
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 10 }
): { allowed: boolean; retryAfter?: number } {
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

// Cleanup interval (add once per function)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);
```

### UUID Validation

```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function validateUUID(value: unknown, fieldName: string): string | null {
  if (!isValidUUID(value)) {
    return `${fieldName} must be a valid UUID`;
  }
  return null;
}

function validateUUIDArray(values: unknown, fieldName: string, maxLength = 500): string | null {
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
```

### Message Validation (for chat functions)

```typescript
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function validateMessages(messages: unknown, maxContentLength = 50000): string | null {
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
    if (!['user', 'assistant'].includes(msg.role)) {
      return `messages[${i}].role must be 'user' or 'assistant'`;
    }
    if (typeof msg.content !== 'string' || msg.content.length === 0) {
      return `messages[${i}].content must be a non-empty string`;
    }
    if (msg.content.length > maxContentLength) {
      return `messages[${i}].content exceeds maximum length of ${maxContentLength} characters`;
    }
  }
  return null;
}
```

### Error Response Helpers

```typescript
function errorResponse(
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

function jsonResponse(
  data: unknown, 
  corsHeaders: Record<string, string>,
  status = 200
): Response {
  return new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### User Extraction from JWT

```typescript
function extractUserIdFromJWT(authHeader: string | null): string {
  if (!authHeader) return 'anonymous';
  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || 'anonymous';
  } catch {
    return 'anonymous';
  }
}
```

### OpenAI API Helper

```typescript
interface AIRequestOptions {
  model?: string;
  systemPrompt: string;
  messages: ChatMessage[];
  tools?: unknown[];
  toolChoice?: unknown;
  stream?: boolean;
}

async function callOpenAI(options: AIRequestOptions): Promise<Response> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const body: Record<string, unknown> = {
    model: options.model || 'gpt-5-mini',
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

  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function handleAIResponse(
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
    console.error(`[${functionName}] OpenAI API error:`, response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }
  return response;
}
```

## Usage Pattern

Each edge function should follow this pattern:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Copy required utilities from above

const FUNCTION_NAME = 'my-function';

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract user for rate limiting
    const userId = extractUserIdFromJWT(req.headers.get('Authorization'));
    
    // Check rate limit
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      console.warn(`[${FUNCTION_NAME}] Rate limit exceeded for user ${userId}`);
      return errorResponse('Rate limit exceeded', 429, corsHeaders, rateLimit.retryAfter);
    }

    // Parse and validate input
    const body = await req.json();
    // ... validation

    // Business logic
    // ...

    return jsonResponse(result, corsHeaders);
  } catch (error) {
    console.error(`[${FUNCTION_NAME}] Error:`, error);
    return errorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500,
      corsHeaders
    );
  }
});
```
