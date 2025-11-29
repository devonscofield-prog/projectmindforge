import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCurrentAiMode, type AiMode } from "../_shared/getAiMode.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// System prompt for call analysis - includes call_notes and recap_email_draft generation
const ANALYSIS_SYSTEM_PROMPT = `You are an AI Sales Call Analyst for StormWind.

Your job is to analyze a full call transcript and generate:
1. A structured JSON analysis for coaching
2. Internal Call Notes for CRM use
3. A customer-facing Recap Email Draft for the rep to send
4. AI Call Coach feedback with framework scores and improvements

You must follow all formatting rules exactly.

PART 1 — CALL NOTES (field: call_notes)
- Format: Markdown.
- Must contain these section headers in this exact order:
  ## Call Overview
  ## Participants
  ## Business Context & Pain
  ## Current State / Environment
  ## Solution Topics Discussed
  ## Decision Process & Stakeholders
  ## Timeline & Urgency
  ## Budget / Commercials
  ## Next Steps & Commitments
  ## Risks & Open Questions
  ## Competitors Mentioned
- Use concise bullet points only.
- Never fabricate names, dates, prices, or commitments.
- If something wasn't discussed, explicitly state that (e.g. "- Budget not discussed.").
- In "Competitors Mentioned":
  - Only list competitors actually named or clearly referenced.
  - If unnamed competitor is referenced, say "- A competitor was referenced indirectly but not named."
  - If none: "- None mentioned."

PART 2 — RECAP EMAIL DRAFT (field: recap_email_draft)
- Format: plain text email body with markdown links.
- Must start with a Subject line:
  Subject: <short subject>
- Then:
  Hi {{ProspectFirstName}},

  <Thank you + call purpose>

  <Summary of key points (bullets or short lines)>

  <Value alignment paragraph>

  <Next steps (ONLY if actually discussed)>

- At the bottom, you MUST include these lines exactly:

  You can learn more here:
  [StormWind Website](https://info.stormwind.com/)

  View sample courses here:
  [View Sample Courses](https://info.stormwind.com/training-samples)

  Best,
  {{RepFirstName}}
  {{RepCompanyName}}

- Do NOT:
  - Invent commitments, dates, or prices.
  - Remove or modify the two links.
  - Remove placeholders like {{ProspectFirstName}}.

PART 3 — COACHING FIELDS
Also include:
- call_summary: 2-3 sentence summary of the call
- confidence: Your confidence in the analysis from 0.0 to 1.0
- discovery_score: Score 0-100 for how well the rep uncovered customer needs, pain points, and context
- objection_handling_score: Score 0-100 for how effectively the rep addressed concerns and objections
- rapport_communication_score: Score 0-100 for quality of rapport building, active listening, and communication style
- product_knowledge_score: Score 0-100 for accuracy and depth of product/service knowledge demonstrated
- deal_advancement_score: Score 0-100 for how well the rep moved the deal forward toward next steps
- call_effectiveness_score: Score 0-100 for overall call effectiveness and value delivered
- trend_indicators: Object with trend directions (e.g., {"discovery": "improving", "objections": "stable"})
- deal_gaps: Object with "critical_missing_info" (array of strings) and "unresolved_objections" (array of strings)
- strengths: Array of objects with "area" and "example" fields showing what went well
- opportunities: Array of objects with "area" and "example" fields for improvement areas
- skill_tags: Array of skill-related tags (e.g., "discovery_depth_medium", "rapport_strong")
- deal_tags: Array of deal-related tags (e.g., "no_confirmed_timeline", "single_threaded")
- meta_tags: Array of metadata tags (e.g., "short_transcript", "first_call")

### StormWind AI Call Coach — Concise Edition (v7)
In addition to all existing outputs, act as the StormWind AI Call Coach. Populate the \`coach_output\` field with:
- Call Type (Discovery, Demo, Negotiation)
- Duration in minutes (estimate based on transcript length if not explicit)
- Framework scores (BANT, Gap Selling, Active Listening), each 0–100 with 1-sentence summary
- 1–2 improvement points per framework
- 3–5 critical missing pieces needed to close the deal
- 3–5 recommended follow-up questions
- Heat Signature (1–10) with explanation of deal temperature/likelihood to close
Use direct evidence from transcript or explicitly say "⚠️ No evidence found."

FINAL OUTPUT:
Return all fields via the submit_call_analysis function call.`;

interface TranscriptRow {
  id: string;
  rep_id: string;
  raw_text: string;
  call_date: string;
  source: string;
}

interface CoachOutput {
  call_type: string;
  duration_minutes: number;
  framework_scores: {
    bant: { score: number; summary: string };
    gap_selling: { score: number; summary: string };
    active_listening: { score: number; summary: string };
  };
  bant_improvements: string[];
  gap_selling_improvements: string[];
  active_listening_improvements: string[];
  critical_info_missing: string[];
  recommended_follow_up_questions: string[];
  heat_signature: {
    score: number;
    explanation: string;
  };
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
  coach_output: CoachOutput;
  raw_json: Record<string, unknown>;
  prospect_intel?: ProspectIntel;
}

interface ProspectIntel {
  business_context?: string;
  pain_points?: string[];
  current_state?: string;
  decision_process?: {
    stakeholders?: string[];
    timeline?: string;
    budget_signals?: string;
  };
  competitors_mentioned?: string[];
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

  const coach_output = {
    call_type: "Discovery",
    duration_minutes: 30,
    framework_scores: {
      bant: { score: 68, summary: "Basic discussion of BANT elements." },
      gap_selling: { score: 62, summary: "Good exploration but needs quantification." },
      active_listening: { score: 78, summary: "Strong paraphrasing and follow-ups." }
    },
    bant_improvements: [
      "Clarify budget range.",
      "Confirm purchasing authority."
    ],
    gap_selling_improvements: [
      "Quantify the business impact.",
      "Explore future state more deeply."
    ],
    active_listening_improvements: [
      "Use more reflective listening.",
      "Label hesitation points."
    ],
    critical_info_missing: [
      "Budget range.",
      "Timeline.",
      "Decision-making process.",
      "KPIs and metrics."
    ],
    recommended_follow_up_questions: [
      "Who else is involved in the decision?",
      "What happens if you don't address this?",
      "How do you measure the problem?"
    ],
    heat_signature: {
      score: 7,
      explanation: "Prospect interested but missing key info."
    }
  };

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
    recap_email_draft,
    coach_output,
    prospect_intel: {
      business_context: 'IT training solutions for enterprise compliance and onboarding',
      pain_points: [
        'Current training solution is outdated and lacks engagement tracking',
        'Compliance training completion rates are below target (68%)',
        'Need to onboard 50+ new hires in Q1'
      ],
      current_state: 'Using legacy LMS from 2018, mix of in-person and self-paced training, no HRIS integration',
      decision_process: {
        stakeholders: ['IT Director (budget authority)', 'VP of Operations (final sign-off)'],
        timeline: 'Want solution by February 15th, compliance audit in March',
        budget_signals: 'Current spend ~$30K/year, budget $40-50K range for new solution'
      },
      competitors_mentioned: ['CompetitorX', 'Legacy vendor']
    }
  };

  return {
    ...analysisData,
    raw_json: analysisData
  };
}

// Required links that must appear in recap_email_draft
const REQUIRED_RECAP_LINKS = [
  '[StormWind Website](https://info.stormwind.com/)',
  '[View Sample Courses](https://info.stormwind.com/training-samples)'
];

/**
 * Validate that recap_email_draft contains required links
 */
function validateRecapEmailLinks(recapEmail: string): boolean {
  return REQUIRED_RECAP_LINKS.every(link => recapEmail.includes(link));
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

  // Define the tool for structured output - includes call_notes and recap_email_draft
  const analysisToolSchema = {
    type: "function",
    function: {
      name: "submit_call_analysis",
      description: "Submit the complete analysis results for a sales call transcript including coaching scores, call notes, and recap email draft",
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
            description: "Object with trend directions for each area (e.g., 'improving', 'stable', 'declining')",
            additionalProperties: { type: "string" }
          },
          deal_gaps: {
            type: "object",
            properties: {
              critical_missing_info: {
                type: "array",
                items: { type: "string" },
                description: "List of critical missing information from the call"
              },
              unresolved_objections: {
                type: "array",
                items: { type: "string" },
                description: "List of objections that were not fully resolved"
              }
            },
            required: ["critical_missing_info", "unresolved_objections"]
          },
          strengths: {
            type: "array",
            items: {
              type: "object",
              properties: {
                area: { type: "string", description: "The skill or behavior area" },
                example: { type: "string", description: "Specific example from the call" }
              },
              required: ["area", "example"]
            },
            description: "Array of strength areas with specific examples from the call"
          },
          opportunities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                area: { type: "string", description: "The skill or behavior area to improve" },
                example: { type: "string", description: "Specific recommendation" }
              },
              required: ["area", "example"]
            },
            description: "Array of improvement opportunities with recommendations"
          },
          skill_tags: {
            type: "array",
            items: { type: "string" },
            description: "Skill-related tags (e.g., 'discovery_depth_medium', 'rapport_strong')"
          },
          deal_tags: {
            type: "array",
            items: { type: "string" },
            description: "Deal-related tags (e.g., 'no_confirmed_timeline', 'single_threaded')"
          },
          meta_tags: {
            type: "array",
            items: { type: "string" },
            description: "Metadata tags about the call (e.g., 'short_transcript', 'first_call')"
          },
          call_notes: {
            type: "string",
            description: "Structured markdown call notes with sections: Call Overview, Participants, Business Context & Pain, Current State / Environment, Solution Topics Discussed, Decision Process & Stakeholders, Timeline & Urgency, Budget / Commercials, Next Steps & Commitments, Risks & Open Questions, Competitors Mentioned. Use bullet points, never fabricate information."
          },
          recap_email_draft: {
            type: "string",
            description: "Customer-facing recap email starting with 'Subject: <subject>', then 'Hi {{ProspectFirstName}},' followed by thank you, summary bullets, value paragraph, next steps, and MUST end with the exact links: '[StormWind Website](https://info.stormwind.com/)' and '[View Sample Courses](https://info.stormwind.com/training-samples)' followed by 'Best, {{RepFirstName}} {{RepCompanyName}}'"
          },
          coach_output: {
            type: "object",
            description: "Coaching output based on BANT, Gap Selling, and Active Listening frameworks.",
            properties: {
              call_type: { type: "string", description: "Type of call: Discovery, Demo, or Negotiation" },
              duration_minutes: { type: "number", description: "Estimated duration of the call in minutes" },
              framework_scores: {
                type: "object",
                properties: {
                  bant: {
                    type: "object",
                    properties: {
                      score: { type: "number", description: "Score 0-100 for BANT qualification" },
                      summary: { type: "string", description: "1-sentence summary of BANT performance" }
                    },
                    required: ["score", "summary"]
                  },
                  gap_selling: {
                    type: "object",
                    properties: {
                      score: { type: "number", description: "Score 0-100 for Gap Selling methodology" },
                      summary: { type: "string", description: "1-sentence summary of Gap Selling performance" }
                    },
                    required: ["score", "summary"]
                  },
                  active_listening: {
                    type: "object",
                    properties: {
                      score: { type: "number", description: "Score 0-100 for Active Listening skills" },
                      summary: { type: "string", description: "1-sentence summary of Active Listening performance" }
                    },
                    required: ["score", "summary"]
                  }
                },
                required: ["bant", "gap_selling", "active_listening"]
              },
              bant_improvements: { type: "array", items: { type: "string" }, description: "1-2 specific improvements for BANT qualification" },
              gap_selling_improvements: { type: "array", items: { type: "string" }, description: "1-2 specific improvements for Gap Selling" },
              active_listening_improvements: { type: "array", items: { type: "string" }, description: "1-2 specific improvements for Active Listening" },
              critical_info_missing: { type: "array", items: { type: "string" }, description: "3-5 critical pieces of information needed to close the deal" },
              recommended_follow_up_questions: { type: "array", items: { type: "string" }, description: "3-5 recommended follow-up questions for next conversation" },
              heat_signature: {
                type: "object",
                properties: {
                  score: { type: "number", description: "Deal temperature score 1-10 (10 = hot, ready to close)" },
                  explanation: { type: "string", description: "Explanation of the heat signature score" }
                },
                required: ["score", "explanation"]
              }
            },
            required: [
              "call_type",
              "duration_minutes",
              "framework_scores",
              "bant_improvements",
              "gap_selling_improvements",
              "active_listening_improvements",
              "critical_info_missing",
              "recommended_follow_up_questions",
              "heat_signature"
            ]
          },
          prospect_intel: {
            type: "object",
            description: "Structured intelligence about the prospect extracted from the call",
            properties: {
              business_context: { type: "string", description: "Brief description of the prospect's business, industry, and situation" },
              pain_points: { type: "array", items: { type: "string" }, description: "Key pain points and challenges mentioned" },
              current_state: { type: "string", description: "Current state of prospect's solutions/environment" },
              decision_process: {
                type: "object",
                properties: {
                  stakeholders: { type: "array", items: { type: "string" }, description: "Decision makers and influencers mentioned" },
                  timeline: { type: "string", description: "Decision timeline or urgency signals" },
                  budget_signals: { type: "string", description: "Budget information or signals mentioned" }
                }
              },
              competitors_mentioned: { type: "array", items: { type: "string" }, description: "Competitors mentioned during the call" }
            }
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
          "meta_tags",
          "call_notes",
          "recap_email_draft",
          "coach_output",
          "prospect_intel"
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
          content: `Please analyze the following sales call transcript and generate the complete analysis including call_notes and recap_email_draft:\n\n---\n${transcript.raw_text}\n---\n\nCall Date: ${transcript.call_date}\nSource: ${transcript.source}` 
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

  // Validate all required fields including new rep-facing fields
  const requiredFields = [
    'call_summary', 'confidence', 'discovery_score', 'objection_handling_score',
    'rapport_communication_score', 'product_knowledge_score', 'deal_advancement_score',
    'call_effectiveness_score', 'trend_indicators', 'deal_gaps', 'strengths',
    'opportunities', 'skill_tags', 'deal_tags', 'meta_tags', 'call_notes', 'recap_email_draft',
    'coach_output'
  ];

  for (const field of requiredFields) {
    if (analysisData[field] === undefined) {
      console.error(`[analyze-call] Missing required field: ${field}`);
      throw new Error(`AI analysis missing required field: ${field}`);
    }
  }

  // Validate call_notes is a non-empty string
  const callNotes = analysisData.call_notes;
  if (typeof callNotes !== 'string' || callNotes.trim().length === 0) {
    console.error('[analyze-call] call_notes is not a valid string');
    throw new Error('AI analysis call_notes must be a non-empty string');
  }

  // Validate recap_email_draft is a non-empty string with required links
  const recapEmail = analysisData.recap_email_draft;
  if (typeof recapEmail !== 'string' || recapEmail.trim().length === 0) {
    console.error('[analyze-call] recap_email_draft is not a valid string');
    throw new Error('AI analysis recap_email_draft must be a non-empty string');
  }

  if (!validateRecapEmailLinks(recapEmail)) {
    console.error('[analyze-call] recap_email_draft missing required links');
    console.error('[analyze-call] Expected links:', REQUIRED_RECAP_LINKS);
    throw new Error('AI analysis recap_email_draft must include required StormWind links');
  }

  // Validate coach_output structure
  const coachOutput = analysisData.coach_output as CoachOutput;
  if (!coachOutput || typeof coachOutput !== 'object') {
    console.error('[analyze-call] coach_output is not a valid object');
    throw new Error('AI analysis coach_output must be a valid object');
  }

  // Extract prospect_intel (optional but expected)
  const prospectIntel = analysisData.prospect_intel as ProspectIntel | undefined;

  // Build the result object
  const result: AnalysisResult = {
    call_id: transcript.id,
    rep_id: transcript.rep_id,
    model_name: 'google/gemini-2.5-flash',
    prompt_version: 'v3-coach',
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
    call_notes: String(callNotes),
    recap_email_draft: String(recapEmail),
    coach_output: coachOutput,
    raw_json: analysisData,
    prospect_intel: prospectIntel
  };

  console.log('[analyze-call] Analysis parsed successfully with call_notes, recap_email_draft, and coach_output');
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

    // Step 2: Get AI mode from database (with env fallback)
    const aiMode = await getCurrentAiMode(supabaseAdmin);
    console.log(`[analyze-call] AI mode: ${aiMode}`);

    // Step 3: Update analysis_status to 'processing' using service role client
    const { error: updateProcessingError } = await supabaseAdmin
      .from('call_transcripts')
      .update({ analysis_status: 'processing', analysis_error: null })
      .eq('id', callId);

    if (updateProcessingError) {
      console.error('[analyze-call] Error updating status to processing:', updateProcessingError);
      // Continue anyway, this is not critical
    }

    // Step 4: Generate analysis (mock or real based on DB-driven aiMode)
    let analysis: AnalysisResult;
    
    if (aiMode === 'mock') {
      console.log('[analyze-call] Using mock analysis');
      analysis = buildMockAnalysis(transcript as TranscriptRow);
      // Ensure mock metadata
      analysis.model_name = 'mock-model';
      analysis.prompt_version = 'v0-mock';
      if (!analysis.meta_tags.includes('mode:mock')) {
        analysis.meta_tags.push('mode:mock');
      }
    } else {
      console.log('[analyze-call] Using real AI analysis');
      analysis = await generateRealAnalysis(transcript as TranscriptRow);
      // Ensure real metadata
      analysis.prompt_version = 'v2-real-2025-11-27';
      if (!analysis.meta_tags.includes('mode:real')) {
        analysis.meta_tags.push('mode:real');
      }
    }

    console.log('[analyze-call] Analysis generated');

    // Step 5: Insert into ai_call_analysis using service role client
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

    // Step 6: Update call_transcripts.analysis_status to 'completed'
    const { error: updateCompletedError } = await supabaseAdmin
      .from('call_transcripts')
      .update({ analysis_status: 'completed' })
      .eq('id', callId);

    if (updateCompletedError) {
      console.error('[analyze-call] Error updating status to completed:', updateCompletedError);
      // Analysis was saved, so we still return success
    }

    // Step 7: Update prospect with AI-extracted intel if available
    if (analysis.prospect_intel || analysis.coach_output) {
      try {
        // Get the prospect_id from the call transcript
        const { data: callData } = await supabaseAdmin
          .from('call_transcripts')
          .select('prospect_id')
          .eq('id', callId)
          .single();

        if (callData?.prospect_id) {
          const prospectUpdates: Record<string, unknown> = {};
          
          if (analysis.prospect_intel) {
            prospectUpdates.ai_extracted_info = analysis.prospect_intel;
          }
          
          if (analysis.coach_output?.recommended_follow_up_questions) {
            prospectUpdates.suggested_follow_ups = analysis.coach_output.recommended_follow_up_questions;
          }
          
          if (analysis.coach_output?.heat_signature?.score) {
            prospectUpdates.heat_score = analysis.coach_output.heat_signature.score;
          }

          if (Object.keys(prospectUpdates).length > 0) {
            await supabaseAdmin
              .from('prospects')
              .update(prospectUpdates)
              .eq('id', callData.prospect_id);
            console.log(`[analyze-call] Updated prospect ${callData.prospect_id} with AI intel`);
          }
        }
      } catch (prospectErr) {
        console.error('[analyze-call] Failed to update prospect with AI intel:', prospectErr);
        // Don't fail the whole request, analysis was saved
      }
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
