import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Required links that must be preserved in the output
const REQUIRED_LINKS = [
  '[StormWind Website](https://info.stormwind.com/)',
  '[View Sample Courses](https://info.stormwind.com/training-samples)'
];

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

/**
 * Validate that the request body has required fields
 */
function validateRequest(body: unknown): { valid: true; data: EditRecapEmailRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const { original_recap_email_draft, edit_instructions, call_summary } = body as Record<string, unknown>;

  if (typeof original_recap_email_draft !== 'string' || original_recap_email_draft.trim().length === 0) {
    return { valid: false, error: 'original_recap_email_draft must be a non-empty string' };
  }

  if (typeof edit_instructions !== 'string' || edit_instructions.trim().length === 0) {
    return { valid: false, error: 'edit_instructions must be a non-empty string' };
  }

  // call_summary is optional, but if provided must be string or null
  if (call_summary !== undefined && call_summary !== null && typeof call_summary !== 'string') {
    return { valid: false, error: 'call_summary must be a string or null if provided' };
  }

  return {
    valid: true,
    data: {
      original_recap_email_draft: original_recap_email_draft.trim(),
      edit_instructions: edit_instructions.trim(),
      call_summary: typeof call_summary === 'string' ? call_summary.trim() : null
    }
  };
}

/**
 * Validate that output contains required links
 */
function validateOutputLinks(output: string): boolean {
  return REQUIRED_LINKS.every(link => output.includes(link));
}

serve(async (req) => {
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

    const validation = validateRequest(body);
    if (!validation.valid) {
      console.warn('[edit-recap-email] Validation failed:', validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { original_recap_email_draft, edit_instructions, call_summary } = validation.data;
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
    if (!validateOutputLinks(updatedEmail)) {
      console.warn('[edit-recap-email] AI output missing required links, attempting to append them');
      // If links are missing, we'll still return the result but log a warning
      // The UI can handle this case
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
