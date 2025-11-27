import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// System prompt for call analysis
const ANALYSIS_SYSTEM_PROMPT = `You are an expert sales call analyst. Analyze the provided call transcript and evaluate the sales representative's performance.

Score each category from 0-100:
- discovery_score: How well the rep uncovered customer needs, pain points, and context
- objection_handling_score: How effectively the rep addressed concerns and objections
- rapport_communication_score: Quality of rapport building, active listening, and communication style
- product_knowledge_score: Accuracy and depth of product/service knowledge demonstrated
- deal_advancement_score: How well the rep moved the deal forward toward next steps
- call_effectiveness_score: Overall call effectiveness and value delivered

Also identify:
- trend_indicators: Object with trend directions (e.g., {"discovery": "improving", "objections": "stable"})
- deal_gaps: Object with "critical_missing_info" (array of strings) and "unresolved_objections" (array of strings)
- strengths: Array of objects with "area" and "example" fields showing what went well
- opportunities: Array of objects with "area" and "example" fields for improvement areas
- skill_tags: Array of skill-related tags (e.g., "discovery_depth_medium", "rapport_strong")
- deal_tags: Array of deal-related tags (e.g., "no_confirmed_timeline", "single_threaded")
- meta_tags: Array of metadata tags (e.g., "short_transcript", "first_call")

Provide a concise call_summary (2-3 sentences) and a confidence score (0.0-1.0) for your analysis.`;

interface TranscriptRow {
  id: string;
  rep_id: string;
  raw_text: string;
  call_date: string;
  source: string;
}

interface AnalysisResult {
  call_id: string;
  rep_id: string;
  model_name: string;
  prompt_version: string;
  confidence: number;
  call_summary: string;
  discovery_score: number;
  objection_handling_score: number;
  rapport_communication_score: number;
  product_knowledge_score: number;
  deal_advancement_score: number;
  call_effectiveness_score: number;
  trend_indicators: Record<string, string>;
  deal_gaps: { critical_missing_info: string[]; unresolved_objections: string[] };
  strengths: Array<{ area: string; example: string }>;
  opportunities: Array<{ area: string; example: string }>;
  skill_tags: string[];
  deal_tags: string[];
  meta_tags: string[];
  call_notes: string;
  recap_email_draft: string;
  raw_json: Record<string, unknown>;
}

/**
 * Generate mock analysis for testing/development
 */
function buildMockAnalysis(transcript: TranscriptRow): AnalysisResult {
  const call_notes = `## Call Overview
- Initial discovery call with prospect from Acme Corp
- 25-minute conversation focused on training platform needs
- Positive engagement throughout

## Participants
- John Smith (IT Director, Acme Corp)
- Sarah Johnson (HR Manager, Acme Corp)

## Business Context & Pain
- Current training solution is outdated and lacks engagement tracking
- Compliance training completion rates are below target (currently 68%)
- Need to onboard 50+ new hires in Q1

## Current State / Environment
- Using legacy LMS from 2018
- Mix of in-person and self-paced training
- No integration with HRIS system

## Solution Topics Discussed
- Cloud-based training platform with real-time analytics
- Mobile-first learning experience
- Automated compliance tracking and reminders

## Decision Process & Stakeholders
- IT Director has budget authority up to $50K
- VP of Operations final sign-off required for larger investments
- Procurement involvement for contracts over $25K

## Timeline & Urgency
- Q1 onboarding creates urgency
- Want to have solution in place by February 15th
- Compliance audit scheduled for March

## Budget / Commercials
- Current spend: ~$30K/year
- Budget for new solution: $40-50K range mentioned
- Open to multi-year commitment for better pricing

## Next Steps & Commitments
- Rep to send product demo video and case studies
- Prospect to share current training content inventory
- Follow-up call scheduled for next Tuesday

## Risks & Open Questions
- Integration with existing HRIS (Workday) needs validation
- Change management concerns from HR team
- Competitor evaluation in progress (mentioned CompetitorX)

## Competitors Mentioned
- CompetitorX (currently in evaluation)
- Legacy vendor pushing for renewal`;

  const recap_email_draft = `Subject: Recap and next steps from today's discussion

Hi John,

Thank you for taking the time to speak with me today about Acme Corp's training initiatives. It was great learning about your goals for improving compliance completion rates and streamlining your Q1 onboarding process.

Here's a quick recap of what we covered:
- Your current challenges with the legacy LMS and engagement tracking
- How our platform can help achieve your target compliance rates
- Timeline considerations around your February 15th target and March audit
- Next steps to move forward with evaluation

I'm confident our solution can help Acme Corp achieve better training outcomes while reducing administrative burden on your team. Our clients in similar situations have seen compliance completion rates improve by 25-30% within the first quarter.

I'll send over the product demo video and relevant case studies by end of day tomorrow. Looking forward to our follow-up call next Tuesday to discuss any questions.

You can learn more here:
[StormWind Website](https://info.stormwind.com/)

View sample courses here:
[View Sample Courses](https://info.stormwind.com/training-samples)

Best,
{{RepFirstName}}
{{RepCompanyName}}`;

  const analysisData = {
    call_id: transcript.id,
    rep_id: transcript.rep_id,
    model_name: 'mock-model',
    prompt_version: 'v0-mock',
    confidence: 0.85,
    call_summary: 'Mock summary of the sales call based on the transcript text.',
    discovery_score: 78,
    objection_handling_score: 82,
    rapport_communication_score: 88,
    product_knowledge_score: 75,
    deal_advancement_score: 70,
    call_effectiveness_score: 80,
    trend_indicators: {
      discovery: 'improving',
      objections: 'stable'
    },
    deal_gaps: {
      critical_missing_info: ['No confirmed decision process'],
      unresolved_objections: ['Pricing concern not fully addressed']
    },
    strengths: [
      { area: 'rapport', example: 'Built good rapport at the start of the call.' },
      { area: 'product_knowledge', example: 'Clear explanation of core features.' }
    ],
    opportunities: [
      { area: 'discovery', example: 'Dig deeper on budget timeline and decision makers.' },
      { area: 'objection_handling', example: 'Address pricing concerns with ROI framing.' }
    ],
    skill_tags: ['discovery_depth_medium', 'objection_follow_up_ok', 'rapport_strong'],
    deal_tags: ['no_confirmed_timeline', 'single_threaded'],
    meta_tags: ['mock_analysis', 'short_transcript'],
    call_notes,
    recap_email_draft
  };

  return {
    ...analysisData,
    raw_json: analysisData
  };
}

/**
 * Generate real analysis using Lovable AI Gateway
 */
async function generateRealAnalysis(transcript: TranscriptRow): Promise<AnalysisResult> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }

  console.log('[analyze-call] Calling Lovable AI Gateway for analysis...');

  // Define the tool for structured output
  const analysisToolSchema = {
    type: "function",
    function: {
      name: "submit_call_analysis",
      description: "Submit the analysis results for a sales call transcript",
      parameters: {
        type: "object",
        properties: {
          call_summary: {
            type: "string",
            description: "2-3 sentence summary of the call"
          },
          confidence: {
            type: "number",
            description: "Confidence in the analysis from 0.0 to 1.0"
          },
          discovery_score: {
            type: "number",
            description: "Score 0-100 for discovery skills"
          },
          objection_handling_score: {
            type: "number",
            description: "Score 0-100 for objection handling"
          },
          rapport_communication_score: {
            type: "number",
            description: "Score 0-100 for rapport and communication"
          },
          product_knowledge_score: {
            type: "number",
            description: "Score 0-100 for product knowledge"
          },
          deal_advancement_score: {
            type: "number",
            description: "Score 0-100 for deal advancement"
          },
          call_effectiveness_score: {
            type: "number",
            description: "Score 0-100 for overall call effectiveness"
          },
          trend_indicators: {
            type: "object",
            description: "Object with trend directions for each area",
            additionalProperties: { type: "string" }
          },
          deal_gaps: {
            type: "object",
            properties: {
              critical_missing_info: {
                type: "array",
                items: { type: "string" },
                description: "List of critical missing information"
              },
              unresolved_objections: {
                type: "array",
                items: { type: "string" },
                description: "List of unresolved objections"
              }
            },
            required: ["critical_missing_info", "unresolved_objections"]
          },
          strengths: {
            type: "array",
            items: {
              type: "object",
              properties: {
                area: { type: "string" },
                example: { type: "string" }
              },
              required: ["area", "example"]
            },
            description: "Array of strength areas with examples"
          },
          opportunities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                area: { type: "string" },
                example: { type: "string" }
              },
              required: ["area", "example"]
            },
            description: "Array of improvement opportunities with examples"
          },
          skill_tags: {
            type: "array",
            items: { type: "string" },
            description: "Skill-related tags"
          },
          deal_tags: {
            type: "array",
            items: { type: "string" },
            description: "Deal-related tags"
          },
          meta_tags: {
            type: "array",
            items: { type: "string" },
            description: "Metadata tags about the call"
          }
        },
        required: [
          "call_summary",
          "confidence",
          "discovery_score",
          "objection_handling_score",
          "rapport_communication_score",
          "product_knowledge_score",
          "deal_advancement_score",
          "call_effectiveness_score",
          "trend_indicators",
          "deal_gaps",
          "strengths",
          "opportunities",
          "skill_tags",
          "deal_tags",
          "meta_tags"
        ]
      }
    }
  };

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        { 
          role: 'user', 
          content: `Please analyze the following sales call transcript:\n\n---\n${transcript.raw_text}\n---\n\nCall Date: ${transcript.call_date}\nSource: ${transcript.source}` 
        }
      ],
      tools: [analysisToolSchema],
      tool_choice: { type: "function", function: { name: "submit_call_analysis" } }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[analyze-call] AI Gateway error:', response.status, errorText);
    
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (response.status === 402) {
      throw new Error('Payment required. Please add credits to your workspace.');
    }
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const data = await response.json();
  console.log('[analyze-call] AI response received');

  // Extract the tool call arguments
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.function.name !== 'submit_call_analysis') {
    console.error('[analyze-call] No valid tool call in response:', JSON.stringify(data));
    throw new Error('AI did not return structured analysis');
  }

  let analysisData: Record<string, unknown>;
  try {
    analysisData = JSON.parse(toolCall.function.arguments);
  } catch (parseError) {
    console.error('[analyze-call] Failed to parse tool arguments:', toolCall.function.arguments);
    throw new Error('Failed to parse AI analysis response');
  }

  // Validate required fields
  const requiredFields = [
    'call_summary', 'confidence', 'discovery_score', 'objection_handling_score',
    'rapport_communication_score', 'product_knowledge_score', 'deal_advancement_score',
    'call_effectiveness_score', 'trend_indicators', 'deal_gaps', 'strengths',
    'opportunities', 'skill_tags', 'deal_tags', 'meta_tags'
  ];

  for (const field of requiredFields) {
    if (analysisData[field] === undefined) {
      console.error(`[analyze-call] Missing required field: ${field}`);
      throw new Error(`AI analysis missing required field: ${field}`);
    }
  }

  // Build the result object
  // Note: call_notes and recap_email_draft are rep-facing outputs that will be 
  // generated in a future iteration of the AI prompt. For now, we use placeholders.
  const result: AnalysisResult = {
    call_id: transcript.id,
    rep_id: transcript.rep_id,
    model_name: 'google/gemini-2.5-flash',
    prompt_version: 'v1',
    confidence: Number(analysisData.confidence) || 0.5,
    call_summary: String(analysisData.call_summary),
    discovery_score: Number(analysisData.discovery_score),
    objection_handling_score: Number(analysisData.objection_handling_score),
    rapport_communication_score: Number(analysisData.rapport_communication_score),
    product_knowledge_score: Number(analysisData.product_knowledge_score),
    deal_advancement_score: Number(analysisData.deal_advancement_score),
    call_effectiveness_score: Number(analysisData.call_effectiveness_score),
    trend_indicators: analysisData.trend_indicators as Record<string, string>,
    deal_gaps: analysisData.deal_gaps as { critical_missing_info: string[]; unresolved_objections: string[] },
    strengths: analysisData.strengths as Array<{ area: string; example: string }>,
    opportunities: analysisData.opportunities as Array<{ area: string; example: string }>,
    skill_tags: analysisData.skill_tags as string[],
    deal_tags: analysisData.deal_tags as string[],
    meta_tags: analysisData.meta_tags as string[],
    call_notes: (analysisData.call_notes as string) || '',
    recap_email_draft: (analysisData.recap_email_draft as string) || '',
    raw_json: analysisData
  };

  console.log('[analyze-call] Analysis parsed successfully');
  return result;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Check if we should use mock AI
  const useMockAI = Deno.env.get('USE_MOCK_AI') !== 'false';
  console.log(`[analyze-call] USE_MOCK_AI: ${useMockAI}`);

  // Get the JWT from Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[analyze-call] Missing or invalid Authorization header');
    return new Response(
      JSON.stringify({ error: 'Missing or invalid Authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create user client bound to request (respects RLS)
  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  // Create service role client for bypassing RLS when writing
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  let callId: string | null = null;

  try {
    // Parse and validate input
    const body = await req.json();
    const { call_id } = body;

    // Validate call_id is present and is a valid UUID
    if (!call_id || typeof call_id !== 'string' || !UUID_REGEX.test(call_id)) {
      console.warn('[analyze-call] Invalid call_id provided:', call_id);
      return new Response(
        JSON.stringify({ error: 'Invalid call_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    callId = call_id;
    console.log(`[analyze-call] Starting analysis for call_id: ${callId}`);

    // Step 1: Read the transcript row using user's RLS context (validates access)
    const { data: transcript, error: fetchError } = await supabaseUser
      .from('call_transcripts')
      .select('id, rep_id, raw_text, call_date, source')
      .eq('id', callId)
      .maybeSingle();

    if (fetchError) {
      console.error('[analyze-call] Error fetching transcript:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch call transcript' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!transcript) {
      console.warn(`[analyze-call] Transcript not found or access denied for call_id: ${callId}`);
      return new Response(
        JSON.stringify({ error: 'Call transcript not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[analyze-call] Transcript found for rep_id: ${transcript.rep_id}`);

    // Step 2: Update analysis_status to 'processing' using service role client
    const { error: updateProcessingError } = await supabaseAdmin
      .from('call_transcripts')
      .update({ analysis_status: 'processing', analysis_error: null })
      .eq('id', callId);

    if (updateProcessingError) {
      console.error('[analyze-call] Error updating status to processing:', updateProcessingError);
      // Continue anyway, this is not critical
    }

    // Step 3: Generate analysis (mock or real based on env flag)
    let analysis: AnalysisResult;
    
    if (useMockAI) {
      console.log('[analyze-call] Using mock analysis');
      analysis = buildMockAnalysis(transcript as TranscriptRow);
    } else {
      console.log('[analyze-call] Using real AI analysis');
      analysis = await generateRealAnalysis(transcript as TranscriptRow);
    }

    console.log('[analyze-call] Analysis generated');

    // Step 4: Insert into ai_call_analysis using service role client
    const { data: analysisResult, error: insertError } = await supabaseAdmin
      .from('ai_call_analysis')
      .insert(analysis)
      .select('id')
      .single();

    if (insertError) {
      console.error('[analyze-call] Error inserting analysis:', insertError);
      
      // Update transcript with error status
      await supabaseAdmin
        .from('call_transcripts')
        .update({
          analysis_status: 'error',
          analysis_error: `Analysis failed: ${insertError.message}`
        })
        .eq('id', callId);

      return new Response(
        JSON.stringify({ error: 'Failed to save analysis' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analysisId = analysisResult.id;
    console.log(`[analyze-call] Analysis inserted with id: ${analysisId}`);

    // Step 5: Update call_transcripts.analysis_status to 'completed'
    const { error: updateCompletedError } = await supabaseAdmin
      .from('call_transcripts')
      .update({ analysis_status: 'completed' })
      .eq('id', callId);

    if (updateCompletedError) {
      console.error('[analyze-call] Error updating status to completed:', updateCompletedError);
      // Analysis was saved, so we still return success
    }

    console.log(`[analyze-call] Analysis completed successfully for call_id: ${callId}`);

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        call_id: callId,
        analysis_id: analysisId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[analyze-call] Unexpected error:', error);

    // If we have a callId, try to update status to error
    if (callId) {
      try {
        await supabaseAdmin
          .from('call_transcripts')
          .update({
            analysis_status: 'error',
            analysis_error: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          })
          .eq('id', callId);
      } catch (updateErr) {
        console.error('[analyze-call] Failed to update error status:', updateErr);
      }
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Analysis failed'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
