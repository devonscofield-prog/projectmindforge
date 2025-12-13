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

// Zod validation schema for request
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

// Tool definition for structured output
const RESEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'submit_account_research',
    description: 'Submit structured account research findings',
    parameters: {
      type: 'object',
      properties: {
        company_overview: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'Brief company description' },
            size: { type: 'string', description: 'Company size (employees, revenue)' },
            headquarters: { type: 'string', description: 'Headquarters location' },
            recent_news: { type: 'array', items: { type: 'string' }, description: 'Recent news or announcements (2-4 items)' },
            key_metrics: { type: 'array', items: { type: 'string' }, description: 'Key business metrics or facts (2-4 items)' }
          },
          required: ['description', 'size', 'headquarters', 'recent_news', 'key_metrics']
        },
        industry_analysis: {
          type: 'object',
          properties: {
            top_challenges: { type: 'array', items: { type: 'string' }, description: 'Top 3-5 industry challenges' },
            company_specific_challenges: { type: 'array', items: { type: 'string' }, description: 'How challenges apply to this company (2-4 items)' },
            market_pressures: { type: 'array', items: { type: 'string' }, description: 'Market pressures or competitive dynamics (2-3 items)' }
          },
          required: ['top_challenges', 'company_specific_challenges', 'market_pressures']
        },
        stakeholder_insights: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              priorities: { type: 'array', items: { type: 'string' }, description: '2-3 likely priorities' },
              messaging_approach: { type: 'string', description: 'How to tailor message to them' },
              questions_to_ask: { type: 'array', items: { type: 'string' }, description: '2-3 specific questions' }
            },
            required: ['name', 'priorities', 'messaging_approach', 'questions_to_ask']
          },
          description: 'Insights for each stakeholder provided'
        },
        conversation_hooks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              hook: { type: 'string', description: 'The conversation opener or talking point' },
              context: { type: 'string', description: 'Why this hook works for this company' }
            },
            required: ['hook', 'context']
          },
          description: '3-5 personalized conversation hooks'
        },
        discovery_questions: {
          type: 'array',
          items: { type: 'string' },
          description: '8-10 targeted discovery questions'
        },
        solution_alignment: {
          type: 'object',
          properties: {
            needs_connection: { type: 'string', description: 'How the solution connects to their needs' },
            benefits: { type: 'array', items: { type: 'string' }, description: '3-5 specific benefits to emphasize' },
            objections_and_responses: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  objection: { type: 'string' },
                  response: { type: 'string' }
                },
                required: ['objection', 'response']
              },
              description: '2-4 potential objections with responses'
            }
          },
          required: ['needs_connection', 'benefits', 'objections_and_responses'],
          description: 'Only include if product pitch was provided'
        },
        signals_to_watch: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              signal_type: { type: 'string', enum: ['hiring', 'technology', 'funding', 'expansion', 'leadership_change', 'other'] },
              description: { type: 'string' }
            },
            required: ['signal_type', 'description']
          },
          description: '3-5 signals indicating buying intent'
        },
        risks_and_considerations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              risk_type: { type: 'string', enum: ['competitive', 'timing', 'budget', 'decision_process', 'technical', 'other'] },
              description: { type: 'string' }
            },
            required: ['risk_type', 'description']
          },
          description: '2-4 potential blockers or red flags'
        }
      },
      required: ['company_overview', 'industry_analysis', 'conversation_hooks', 'discovery_questions', 'signals_to_watch', 'risks_and_considerations']
    }
  }
};

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

    console.log('[account-research] Processing structured research request for:', companyName);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[account-research] LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context for the prompt
    const contextParts: string[] = [];
    if (website) contextParts.push(`Website: ${website}`);
    if (industry) contextParts.push(`Industry: ${industry}`);
    if (stakeholders && stakeholders.length > 0) {
      const stakeholderList = stakeholders
        .map(s => `- ${s.name}${s.title ? ` (${s.title})` : ''}${s.role ? ` - ${s.role}` : ''}`)
        .join('\n');
      contextParts.push(`Key Stakeholders:\n${stakeholderList}`);
    }
    if (productPitch) contextParts.push(`What We're Selling: ${productPitch}`);
    if (dealStage) contextParts.push(`Deal Stage: ${dealStage}`);
    if (knownChallenges) contextParts.push(`Known Challenges: ${knownChallenges}`);
    if (additionalNotes) contextParts.push(`Additional Context: ${additionalNotes}`);

    const contextBlock = contextParts.length > 0 
      ? `\n\nContext provided:\n${contextParts.join('\n\n')}`
      : '';

    const systemPrompt = `You are a seasoned sales intelligence expert with 25+ years of experience at Fortune 500 companies. You research companies to provide actionable intelligence that helps close deals.

Your task: Research "${companyName}" and provide comprehensive, structured intelligence.

Guidelines:
- Be specific and actionable, not generic
- Include specific names, dates, and facts when available
- If uncertain, note it rather than inventing
- Focus on insights that help WIN DEALS
${stakeholders && stakeholders.length > 0 ? '- Provide insights for EACH stakeholder listed' : '- Skip stakeholder_insights section (none provided)'}
${productPitch ? '- Include solution_alignment section connecting the product to their needs' : '- Set solution_alignment to null (no product pitch provided)'}

Call the submit_account_research function with your findings.`;

    const userPrompt = `Research: ${companyName}${contextBlock}`;

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
          tools: [RESEARCH_TOOL],
          tool_choice: { type: 'function', function: { name: 'submit_account_research' } },
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
      console.error('[account-research] AI gateway error:', response.status, errorText);
      
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

    const data = await response.json();
    console.log('[account-research] Got response for:', companyName);

    // Extract tool call arguments
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== 'submit_account_research') {
      console.error('[account-research] No tool call in response:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: 'AI did not return structured research' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let research: unknown;
    try {
      research = JSON.parse(toolCall.function.arguments);
    } catch (err) {
      console.error('[account-research] Failed to parse tool arguments:', err);
      return new Response(
        JSON.stringify({ error: 'Failed to parse research data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[account-research] Successfully extracted structured research for:', companyName);

    return new Response(
      JSON.stringify({ research }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[account-research] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
