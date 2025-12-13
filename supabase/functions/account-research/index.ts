import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

function getCorsHeaders(origin?: string | null): Record<string, string> {
  const CUSTOM_DOMAIN = Deno.env.get('CUSTOM_DOMAIN');
  const STORMWIND_DOMAIN = Deno.env.get('STORMWIND_DOMAIN');
  
  const allowedOrigins = [
    'http://localhost:8080',
    'http://localhost:5173',
    'https://lovableproject.com',
  ];
  
  if (CUSTOM_DOMAIN) {
    allowedOrigins.push(`https://${CUSTOM_DOMAIN}`);
    allowedOrigins.push(`https://www.${CUSTOM_DOMAIN}`);
  }
  if (STORMWIND_DOMAIN) {
    allowedOrigins.push(`https://${STORMWIND_DOMAIN}`);
    allowedOrigins.push(`https://www.${STORMWIND_DOMAIN}`);
  }

  const effectiveOrigin = origin && allowedOrigins.some(allowed => origin.startsWith(allowed.replace(/\/$/, '')))
    ? origin
    : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': effectiveOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Zod validation schema
const researchRequestSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(200),
  website: z.string().url("Invalid website URL").optional(),
  industry: z.string().max(100).optional(),
  stakeholders: z.array(
    z.object({
      name: z.string().min(1).max(100),
      title: z.string().max(100).optional(),
      role: z.string().max(100).optional()
    })
  ).max(20, "Maximum 20 stakeholders allowed").optional(),
  productPitch: z.string().max(1000, "Pitch too long (max 1000 chars)").optional(),
  dealStage: z.string().max(100).optional(),
  knownChallenges: z.string().max(2000).optional(),
  additionalNotes: z.string().max(2000).optional()
});

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    const validation = researchRequestSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }));
      console.warn('[account-research] Validation failed:', errors);
      return new Response(
        JSON.stringify({ error: 'Validation failed', issues: errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { companyName, website, industry, stakeholders, productPitch, dealStage, knownChallenges, additionalNotes } = validation.data;

    console.log('[account-research] Processing research request for:', companyName);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[account-research] LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    

    // Build context sections for the prompt
    const contextSections: string[] = [];
    
    if (website) {
      contextSections.push(`**Website**: ${website}`);
    }
    if (industry) {
      contextSections.push(`**Industry**: ${industry}`);
    }
    if (stakeholders && stakeholders.length > 0) {
      const stakeholderList = stakeholders
        .map(s => `- ${s.name}${s.title ? ` (${s.title})` : ''}${s.role ? ` - ${s.role}` : ''}`)
        .join('\n');
      contextSections.push(`**Key People**:\n${stakeholderList}`);
    }
    if (productPitch) {
      contextSections.push(`**What We're Selling**: ${productPitch}`);
    }
    if (dealStage) {
      contextSections.push(`**Deal Stage**: ${dealStage}`);
    }
    if (knownChallenges) {
      contextSections.push(`**Known Challenges**: ${knownChallenges}`);
    }
    if (additionalNotes) {
      contextSections.push(`**Additional Context**: ${additionalNotes}`);
    }

    const contextBlock = contextSections.length > 0 
      ? `\n\n## Context Provided by Sales Rep\n${contextSections.join('\n\n')}`
      : '';

    const systemPrompt = `You are a seasoned marketing and sales intelligence expert with 25+ years of experience at Fortune 500 companies. You've led competitive intelligence teams, closed multi-million dollar enterprise deals, and know exactly what information moves deals forward.

Your task is to research a company and provide actionable intelligence that helps close deals. Think like a VP of Sales who has seen thousands of deals—focus on what actually matters for winning business.

## Your Research Approach:
1. Synthesize information about the company from your training data
2. Identify specific pain points and challenges based on their industry and context
3. Research key stakeholders if provided (think LinkedIn-style insights)
4. Connect their likely challenges to potential solutions
5. Provide specific, actionable conversation hooks

## Your Response Style:
- Be specific and actionable, not generic
- Use bullet points for easy scanning
- Include specific names, dates, and facts when available
- If you're uncertain about something, say so rather than making things up
- Focus on insights that help WIN DEALS, not just general company info`;

    const userPrompt = `# Research Request: ${companyName}${contextBlock}

---

Please provide comprehensive sales intelligence in the following structure:

## 📊 Company Overview
- What they do, company size, headquarters, market position
- Recent news, announcements, or notable changes (from your training data)
- Key metrics or financial indicators if known

## 🎯 Industry Analysis & Pain Points
- Top 3-5 challenges companies in this industry typically face
- How these challenges specifically apply to ${companyName}
- Market pressures or competitive dynamics affecting them

${stakeholders && stakeholders.length > 0 ? `## 👥 Stakeholder Insights
For each key person provided, analyze:
- Their likely priorities based on their role
- What they probably care about most
- How to tailor your message to them
- Questions to ask them specifically
` : ''}

## 💡 Sales Conversation Hooks
- 3-5 specific talking points tailored to this company
- Opening lines that will resonate with their situation
- Ways to personalize outreach that show you've done your homework

## ❓ Discovery Questions
- 8-10 targeted questions to ask in discovery calls
- Questions that uncover budget, timeline, and decision process
- Questions that reveal pain points and priorities

${productPitch ? `## 🎯 Solution Alignment
- How what you're selling connects to their likely needs
- Specific benefits to emphasize for this company
- Potential objections and how to handle them
` : ''}

## 📈 Signals to Watch
- Hiring patterns that indicate buying intent
- Tech investments or changes to watch for
- Funding, M&A, or financial moves that matter

## ⚠️ Risks & Considerations
- Potential blockers or red flags for this deal
- Competitive threats to watch out for
- Timing considerations

Be specific and actionable. I'm preparing for a sales conversation and need intelligence that helps me WIN this deal.`;

    // Create abort controller with 60-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let response: Response;
    try {
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-pro-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: true,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        console.error('[account-research] Request timed out after 60 seconds');
        return new Response(
          JSON.stringify({ error: 'Research timed out. Please try again.' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw err;
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add funds to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI research failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Streaming research response for:', companyName);

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Account research error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
