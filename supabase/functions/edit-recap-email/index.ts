import { z } from "zod";

// CORS: Restrict to production domains
function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigins = ['https://lovable.dev', 'https://www.lovable.dev'];
  const devPatterns = [/^https?:\/\/localhost(:\d+)?$/, /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/, /^https:\/\/[a-z0-9-]+\.lovable\.app$/];
  
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
  const isAllowed = allowedOrigins.includes(requestOrigin) || devPatterns.some(pattern => pattern.test(requestOrigin));
  return {
    'Access-Control-Allow-Origin': isAllowed ? requestOrigin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  
  if (!entry || now >= entry.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  entry.count++;
  return { allowed: true };
}

// Required links that must be preserved in the output
const REQUIRED_LINKS = [
  '[StormWind Website](https://info.stormwind.com/)',
  '[View Sample Courses](https://info.stormwind.com/training-samples)'
];

// Zod validation schema
const editRecapEmailSchema = z.object({
  original_recap_email_draft: z.string().min(10, "Email draft too short").max(10000, "Email draft too long"),
  edit_instructions: z.string().min(1, "Edit instructions required").max(500, "Instructions too long"),
  call_summary: z.string().max(8000, "Call summary too long").optional().nullable()
});

// System prompt for email editing
const EDIT_SYSTEM_PROMPT = `You are an email editor helping a sales rep refine a recap email.

You will receive:
- The original recap email draft (already factually correct and compliant).
- Optional call summary context.
- A short instruction on how to adjust the email (e.g., shorter, more formal, emphasize X).

Your job is to:
- Adjust tone, length, clarity, and emphasis based on the instructions.
- Keep ALL facts, commitments, dates, and placeholders consistent with the original draft.
- Do NOT invent new promises, pricing, or meeting details.
- Preserve the two links exactly as they appear:
  [StormWind Website](https://info.stormwind.com/)
  [View Sample Courses](https://info.stormwind.com/training-samples)
- Preserve the placeholders like {{ProspectFirstName}}, {{CompanyName}}, {{RepFirstName}}, {{RepCompanyName}}.

Output ONLY the updated email body as plain text with markdown links, same format as the original.`;

interface EditRecapEmailRequest {
  original_recap_email_draft: string;
  edit_instructions: string;
  call_summary?: string | null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[edit-recap-email] Missing or invalid Authorization header');
    return new Response(
      JSON.stringify({ error: 'Missing or invalid Authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Extract user ID from JWT for rate limiting
  const token = authHeader.replace('Bearer ', '');
  let userId = 'anonymous';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    userId = payload.sub || 'anonymous';
  } catch {
    // Use anonymous if token parsing fails
  }

  // Check rate limit
  const rateLimitResult = checkRateLimit(userId);
  if (!rateLimitResult.allowed) {
    console.warn(`[edit-recap-email] Rate limit exceeded for user ${userId}`);
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimitResult.retryAfter || 60)
        } 
      }
    );
  }

  try {
    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = editRecapEmailSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }));
      console.warn('[edit-recap-email] Validation failed:', errors);
      return new Response(
        JSON.stringify({ error: 'Validation failed', issues: errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { original_recap_email_draft, edit_instructions, call_summary }: EditRecapEmailRequest = validation.data;
    console.log('[edit-recap-email] Processing edit request');
    console.log('[edit-recap-email] Instructions:', edit_instructions.substring(0, 100) + '...');

    // Get API key
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[edit-recap-email] LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build user message with context
    let userMessage = `## Original Recap Email Draft:\n\n${original_recap_email_draft}\n\n`;
    
    if (call_summary) {
      userMessage += `## Call Summary (for context):\n\n${call_summary}\n\n`;
    }
    
    userMessage += `## Edit Instructions:\n\n${edit_instructions}\n\n`;
    userMessage += `Please provide the updated email draft based on these instructions. Remember to preserve all links and placeholders exactly.`;

    // Call Lovable AI Gateway
    console.log('[edit-recap-email] Calling Lovable AI Gateway...');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: EDIT_SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[edit-recap-email] AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'AI service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('[edit-recap-email] AI response received');

    // Extract the response content
    const updatedEmail = data.choices?.[0]?.message?.content;
    if (!updatedEmail || typeof updatedEmail !== 'string' || updatedEmail.trim().length === 0) {
      console.error('[edit-recap-email] Empty or invalid response from AI');
      return new Response(
        JSON.stringify({ error: 'AI returned empty response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate that required links are preserved
    if (!REQUIRED_LINKS.every(link => updatedEmail.includes(link))) {
      console.warn('[edit-recap-email] AI output missing required links');
      // Still return the result but log a warning
    }

    console.log('[edit-recap-email] Successfully generated updated email');

    return new Response(
      JSON.stringify({ updated_recap_email_draft: updatedEmail.trim() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[edit-recap-email] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});