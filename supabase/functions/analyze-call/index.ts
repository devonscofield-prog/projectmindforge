import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime for Supabase Edge Functions
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

// Rate limiting: 5 requests per minute per user (heavy AI operation)
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
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

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60 * 1000);

// CORS: Restrict to production domains
function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigins = [
    'https://lovable.dev',
    'https://www.lovable.dev',
  ];
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

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Compressed system prompt - optimized for token efficiency while maintaining clarity
const ANALYSIS_SYSTEM_PROMPT = `You are an AI Sales Call Analyst for StormWind. Analyze call transcripts and generate:
1. Structured JSON analysis for coaching
2. Internal Call Notes (markdown)
3. Customer-facing Recap Email Draft
4. AI Call Coach feedback with framework scores
5. Stakeholder intelligence

CALL NOTES (markdown, bullet points only):
Required sections in order: ## Call Overview, ## Participants, ## Business Context & Pain, ## Current State / Environment, ## Solution Topics Discussed, ## Decision Process & Stakeholders, ## Timeline & Urgency, ## Budget / Commercials, ## Next Steps & Commitments, ## Risks & Open Questions, ## Competitors Mentioned
- Never fabricate data. If not discussed, state "- Not discussed."
- Competitors: Only list if named. If referenced indirectly: "- A competitor was referenced indirectly but not named."

RECAP EMAIL (plain text with markdown links):
Format: Subject: <short subject>
Hi {{ProspectFirstName}},
<Thank you + summary bullets + value paragraph + next steps if discussed>

CRITICAL - REQUIRED LINKS (copy verbatim at email end):
You can learn more here:
[StormWind Website](https://info.stormwind.com/)
View sample courses here:
[View Sample Courses](https://info.stormwind.com/training-samples)
Best,
{{RepFirstName}}
{{RepCompanyName}}

COACHING FIELDS:
- call_summary: 2-3 sentences
- confidence: 0.0-1.0
- trend_indicators: {area: "improving"|"stable"|"declining"}
- deal_gaps: {critical_missing_info: [], unresolved_objections: []}
- strengths/opportunities: [{area, example}]
- skill_tags, deal_tags, meta_tags: string[]

MEDDPICC (Most Important) - Score 0-100 + justification for each:
M=Metrics (quantifiable outcomes), E=Economic Buyer (budget authority), D1=Decision Criteria, D2=Decision Process, P=Paper Process (procurement/legal), I=Identify Pain, C=Champion (internal advocate), C2=Competition
+ overall_score (weighted avg) + summary (2-3 sentences)

Gap Selling & Active Listening: Score 0-100 + 1-sentence summary + 1-2 improvements

Additional Coaching:
- 3-5 critical_info_missing with missed_opportunity (reference specific call moments)
- 3-5 recommended_follow_up_questions with timing_example
- heat_signature: 1-10 score + explanation

STAKEHOLDER INTEL - For each person:
- name, job_title, influence_level (light_influencer|heavy_influencer|secondary_dm|final_dm)
- champion_score (1-10), champion_score_reasoning, was_present (bool), ai_notes

USER COUNTS (only if explicitly mentioned, never estimate):
- it_users, end_users, ai_users with source_quote

Return all fields via submit_call_analysis function.`;

// Tool schema for structured output - defined once at cold start
const ANALYSIS_TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "submit_call_analysis",
    description: "Submit complete analysis results for a sales call transcript",
    parameters: {
      type: "object",
      properties: {
        call_summary: { type: "string", description: "2-3 sentence summary" },
        confidence: { type: "number", description: "0.0-1.0" },
        trend_indicators: { type: "object", additionalProperties: { type: "string" } },
        deal_gaps: {
          type: "object",
          properties: {
            critical_missing_info: { type: "array", items: { type: "string" } },
            unresolved_objections: { type: "array", items: { type: "string" } }
          },
          required: ["critical_missing_info", "unresolved_objections"]
        },
        strengths: {
          type: "array",
          items: {
            type: "object",
            properties: { area: { type: "string" }, example: { type: "string" } },
            required: ["area", "example"]
          }
        },
        opportunities: {
          type: "array",
          items: {
            type: "object",
            properties: { area: { type: "string" }, example: { type: "string" } },
            required: ["area", "example"]
          }
        },
        skill_tags: { type: "array", items: { type: "string" } },
        deal_tags: { type: "array", items: { type: "string" } },
        meta_tags: { type: "array", items: { type: "string" } },
        call_notes: { type: "string", description: "Markdown with required sections" },
        recap_email_draft: { type: "string", description: "Email with required links" },
        coach_output: {
          type: "object",
          properties: {
            call_type: { type: "string" },
            duration_minutes: { type: "number" },
            framework_scores: {
              type: "object",
              properties: {
                meddpicc: {
                  type: "object",
                  properties: {
                    metrics: { type: "object", properties: { score: { type: "number" }, justification: { type: "string" } }, required: ["score", "justification"] },
                    economic_buyer: { type: "object", properties: { score: { type: "number" }, justification: { type: "string" } }, required: ["score", "justification"] },
                    decision_criteria: { type: "object", properties: { score: { type: "number" }, justification: { type: "string" } }, required: ["score", "justification"] },
                    decision_process: { type: "object", properties: { score: { type: "number" }, justification: { type: "string" } }, required: ["score", "justification"] },
                    paper_process: { type: "object", properties: { score: { type: "number" }, justification: { type: "string" } }, required: ["score", "justification"] },
                    identify_pain: { type: "object", properties: { score: { type: "number" }, justification: { type: "string" } }, required: ["score", "justification"] },
                    champion: { type: "object", properties: { score: { type: "number" }, justification: { type: "string" } }, required: ["score", "justification"] },
                    competition: { type: "object", properties: { score: { type: "number" }, justification: { type: "string" } }, required: ["score", "justification"] },
                    overall_score: { type: "number" },
                    summary: { type: "string" }
                  },
                  required: ["metrics", "economic_buyer", "decision_criteria", "decision_process", "paper_process", "identify_pain", "champion", "competition", "overall_score", "summary"]
                },
                gap_selling: { type: "object", properties: { score: { type: "number" }, summary: { type: "string" } }, required: ["score", "summary"] },
                active_listening: { type: "object", properties: { score: { type: "number" }, summary: { type: "string" } }, required: ["score", "summary"] }
              },
              required: ["meddpicc", "gap_selling", "active_listening"]
            },
            meddpicc_improvements: { type: "array", items: { type: "string" } },
            gap_selling_improvements: { type: "array", items: { type: "string" } },
            active_listening_improvements: { type: "array", items: { type: "string" } },
            critical_info_missing: {
              type: "array",
              items: {
                type: "object",
                properties: { info: { type: "string" }, missed_opportunity: { type: "string" } },
                required: ["info", "missed_opportunity"]
              }
            },
            recommended_follow_up_questions: {
              type: "array",
              items: {
                type: "object",
                properties: { question: { type: "string" }, timing_example: { type: "string" } },
                required: ["question", "timing_example"]
              }
            },
            heat_signature: {
              type: "object",
              properties: { score: { type: "number" }, explanation: { type: "string" } },
              required: ["score", "explanation"]
            }
          },
          required: ["call_type", "duration_minutes", "framework_scores", "meddpicc_improvements", "gap_selling_improvements", "active_listening_improvements", "critical_info_missing", "recommended_follow_up_questions", "heat_signature"]
        },
        prospect_intel: {
          type: "object",
          properties: {
            business_context: { type: "string" },
            pain_points: { type: "array", items: { type: "string" } },
            current_state: { type: "string" },
            decision_process: {
              type: "object",
              properties: {
                stakeholders: { type: "array", items: { type: "string" } },
                timeline: { type: "string" },
                budget_signals: { type: "string" }
              }
            },
            competitors_mentioned: { type: "array", items: { type: "string" } },
            industry: { type: "string", enum: ["education", "local_government", "state_government", "federal_government", "healthcare", "msp", "technology", "finance", "manufacturing", "retail", "nonprofit", "other"] },
            user_counts: {
              type: "object",
              properties: {
                it_users: { type: "number" },
                end_users: { type: "number" },
                ai_users: { type: "number" },
                source_quote: { type: "string" }
              }
            }
          }
        },
        stakeholders_intel: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              job_title: { type: "string" },
              influence_level: { type: "string", enum: ["light_influencer", "heavy_influencer", "secondary_dm", "final_dm"] },
              champion_score: { type: "number" },
              champion_score_reasoning: { type: "string" },
              was_present: { type: "boolean" },
              ai_notes: { type: "string" }
            },
            required: ["name", "influence_level"]
          }
        }
      },
      required: ["call_summary", "confidence", "trend_indicators", "deal_gaps", "strengths", "opportunities", "skill_tags", "deal_tags", "meta_tags", "call_notes", "recap_email_draft", "coach_output", "prospect_intel"]
    }
  }
} as const;

// AI Gateway timeout (55s to leave buffer before edge function 60s timeout)
const AI_GATEWAY_TIMEOUT_MS = 55000;

interface TranscriptRow {
  id: string;
  rep_id: string;
  raw_text: string;
  call_date: string;
  source: string;
}

// MEDDPICC element with score and justification
interface MEDDPICCElement {
  score: number;
  justification: string;
}

// Full MEDDPICC scores structure
interface MEDDPICCScores {
  metrics: MEDDPICCElement;
  economic_buyer: MEDDPICCElement;
  decision_criteria: MEDDPICCElement;
  decision_process: MEDDPICCElement;
  paper_process: MEDDPICCElement;
  identify_pain: MEDDPICCElement;
  champion: MEDDPICCElement;
  competition: MEDDPICCElement;
  overall_score: number;
  summary: string;
}

interface CoachOutput {
  call_type: string;
  duration_minutes: number;
  framework_scores: {
    meddpicc: MEDDPICCScores;
    gap_selling: { score: number; summary: string };
    active_listening: { score: number; summary: string };
  };
  meddpicc_improvements: string[];
  gap_selling_improvements: string[];
  active_listening_improvements: string[];
  critical_info_missing: Array<{
    info: string;
    missed_opportunity: string;
  }>;
  recommended_follow_up_questions: Array<{
    question: string;
    timing_example: string;
  }>;
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
  // Individual scores kept for backward compatibility but set to 0 for new analyses
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
  stakeholders_intel?: StakeholderIntel[];
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
  industry?: string;
  user_counts?: {
    it_users?: number;
    end_users?: number;
    ai_users?: number;
    source_quote?: string;
  };
}

interface StakeholderIntel {
  name: string;
  job_title?: string;
  influence_level: 'light_influencer' | 'heavy_influencer' | 'secondary_dm' | 'final_dm';
  champion_score?: number;
  champion_score_reasoning?: string;
  was_present?: boolean;
  ai_notes?: string;
}

// Required links that must appear in recap_email_draft
const REQUIRED_RECAP_LINKS = [
  '[StormWind Website](https://info.stormwind.com/)',
  '[View Sample Courses](https://info.stormwind.com/training-samples)'
];

// Required section headers in call_notes
const REQUIRED_CALL_NOTES_SECTIONS = [
  '## Call Overview',
  '## Participants',
  '## Business Context & Pain',
  '## Current State / Environment',
  '## Solution Topics Discussed',
  '## Decision Process & Stakeholders',
  '## Timeline & Urgency',
  '## Budget / Commercials',
  '## Next Steps & Commitments',
  '## Risks & Open Questions',
  '## Competitors Mentioned'
];

// Minimum length for complete call_notes (characters)
const MIN_CALL_NOTES_LENGTH = 1500;

// Adaptive token limits based on transcript length
const TOKEN_LIMITS = {
  SHORT: 16384,      // Transcripts < 15,000 chars
  MEDIUM: 24576,     // Transcripts 15,000-25,000 chars
  LONG: 32768,       // Transcripts > 25,000 chars or retry
  MAX_RETRY: 40960   // Maximum for second retry
};

// Transcript length thresholds (characters)
const TRANSCRIPT_LENGTH_THRESHOLDS = {
  MEDIUM: 15000,
  LONG: 25000
};

/**
 * Calculate adaptive max_tokens based on transcript length and retry count
 */
function calculateMaxTokens(transcriptLength: number, retryCount: number): number {
  // On retry, use higher limits
  if (retryCount >= 2) return TOKEN_LIMITS.MAX_RETRY;
  if (retryCount === 1) return TOKEN_LIMITS.LONG;
  
  // First attempt - base on transcript length
  if (transcriptLength > TRANSCRIPT_LENGTH_THRESHOLDS.LONG) {
    return TOKEN_LIMITS.MEDIUM;
  }
  if (transcriptLength > TRANSCRIPT_LENGTH_THRESHOLDS.MEDIUM) {
    return TOKEN_LIMITS.MEDIUM;
  }
  return TOKEN_LIMITS.SHORT;
}

/**
 * Validate that recap_email_draft contains required links
 */
function validateRecapEmailLinks(recapEmail: string): boolean {
  return REQUIRED_RECAP_LINKS.every(link => recapEmail.includes(link));
}

/**
 * Validate call_notes for completeness and detect truncation
 */
function validateCallNotes(callNotes: string): { valid: boolean; issues: string[]; missingSections: string[] } {
  const issues: string[] = [];
  
  // Check minimum length
  if (callNotes.length < MIN_CALL_NOTES_LENGTH) {
    issues.push(`Call notes too short (${callNotes.length} chars, minimum ${MIN_CALL_NOTES_LENGTH})`);
  }
  
  // Check for required sections
  const missingSections = REQUIRED_CALL_NOTES_SECTIONS.filter(
    section => !callNotes.includes(section)
  );
  if (missingSections.length > 0) {
    issues.push(`Missing sections: ${missingSections.join(', ')}`);
  }
  
  // Check for truncation indicators (ends mid-sentence without punctuation)
  const trimmed = callNotes.trim();
  const lastChar = trimmed.charAt(trimmed.length - 1);
  const validEndChars = ['.', ')', ']', '"', "'", '!', '?', '-', '*'];
  if (!validEndChars.includes(lastChar)) {
    issues.push(`Possible truncation detected (ends with: "${lastChar}")`);
  }
  
  return { valid: issues.length === 0, issues, missingSections };
}

/**
 * Generate real analysis using Lovable AI Gateway with automatic retry on truncation
 */
async function generateRealAnalysis(
  transcript: TranscriptRow,
  retryCount: number = 0
): Promise<AnalysisResult> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }

  const transcriptLength = transcript.raw_text.length;
  const maxTokens = calculateMaxTokens(transcriptLength, retryCount);
  
  const startTime = Date.now();
  console.log(`[analyze-call] Calling Lovable AI Gateway (attempt ${retryCount + 1}, transcript: ${transcriptLength} chars, max_tokens: ${maxTokens})...`);

  // Add timeout via AbortController to prevent hanging requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_GATEWAY_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
          { 
            role: 'user', 
            content: `Please analyze the following sales call transcript and generate the complete analysis including call_notes and recap_email_draft:\n\n---\n${transcript.raw_text}\n---\n\nCall Date: ${transcript.call_date}\nSource: ${transcript.source}` 
          }
        ],
        tools: [ANALYSIS_TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "submit_call_analysis" } }
      }),
    });
  } catch (fetchError) {
    clearTimeout(timeoutId);
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      console.error(`[analyze-call] AI Gateway timeout after ${AI_GATEWAY_TIMEOUT_MS}ms`);
      throw new Error('AI analysis timed out. Please try again.');
    }
    throw fetchError;
  } finally {
    clearTimeout(timeoutId);
  }

  const aiDurationMs = Date.now() - startTime;
  console.log(`[analyze-call] AI Gateway response received in ${aiDurationMs}ms`);

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
  
  // Extract and log finish_reason to detect truncation
  const finishReason = data.choices?.[0]?.finish_reason;
  console.log(`[analyze-call] AI response received (finish_reason: ${finishReason}, transcript: ${transcriptLength} chars)`);

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

  // Validate all required fields (individual scores no longer required - using MEDDPICC instead)
  const requiredFields = [
    'call_summary', 'confidence', 'trend_indicators', 'deal_gaps', 'strengths',
    'opportunities', 'skill_tags', 'deal_tags', 'meta_tags', 'call_notes', 'recap_email_draft',
    'coach_output'
  ];

  for (const field of requiredFields) {
    if (analysisData[field] === undefined) {
      console.error(`[analyze-call] Missing required field: ${field}`);
      throw new Error(`AI analysis missing required field: ${field}`);
    }
  }

  // Validate call_notes is a non-empty string with all required sections
  const callNotes = analysisData.call_notes;
  if (typeof callNotes !== 'string' || callNotes.trim().length === 0) {
    console.error('[analyze-call] call_notes is not a valid string');
    throw new Error('AI analysis call_notes must be a non-empty string');
  }
  
  // Validate call_notes completeness
  const callNotesValidation = validateCallNotes(callNotes as string);
  
  // Check if truncation occurred (finish_reason === 'length' or validation failed)
  const wasTruncated = finishReason === 'length' || !callNotesValidation.valid;
  
  if (wasTruncated) {
    console.warn('[analyze-call] Output truncation detected:', {
      finish_reason: finishReason,
      call_notes_length: (callNotes as string).length,
      transcript_length: transcriptLength,
      max_tokens_used: maxTokens,
      validation_issues: callNotesValidation.issues,
      missing_sections: callNotesValidation.missingSections
    });
    
    // Retry with higher max_tokens if we haven't exceeded retry limit
    const MAX_RETRIES = 2;
    if (retryCount < MAX_RETRIES) {
      console.log(`[analyze-call] Retrying with higher max_tokens (attempt ${retryCount + 2} of ${MAX_RETRIES + 1})...`);
      return generateRealAnalysis(transcript, retryCount + 1);
    }
    
    // After all retries, throw error if still invalid
    if (!callNotesValidation.valid) {
      console.error('[analyze-call] Call notes still incomplete after retries:', callNotesValidation.issues);
      throw new Error(`Call notes incomplete after ${MAX_RETRIES + 1} attempts. Missing: ${callNotesValidation.missingSections.join(', ')}`);
    }
  }

  // Validate recap_email_draft is a non-empty string with required links
  const recapEmail = analysisData.recap_email_draft;
  if (typeof recapEmail !== 'string' || recapEmail.trim().length === 0) {
    console.error('[analyze-call] recap_email_draft is not a valid string');
    throw new Error('AI analysis recap_email_draft must be a non-empty string');
  }

  // Auto-append required links if missing instead of failing
  let finalRecapEmail = recapEmail;
  if (!validateRecapEmailLinks(recapEmail)) {
    console.warn('[analyze-call] recap_email_draft missing required links - auto-appending');
    console.warn('[analyze-call] Missing links from:', REQUIRED_RECAP_LINKS);
    
    const linksFooter = `

You can learn more here:
[StormWind Website](https://info.stormwind.com/)

View sample courses here:
[View Sample Courses](https://info.stormwind.com/training-samples)`;
    
    finalRecapEmail = recapEmail.trim() + linksFooter;
    console.log('[analyze-call] Links auto-appended to recap_email_draft');
  }

  // Validate coach_output structure
  const coachOutput = analysisData.coach_output as CoachOutput;
  if (!coachOutput || typeof coachOutput !== 'object') {
    console.error('[analyze-call] coach_output is not a valid object');
    throw new Error('AI analysis coach_output must be a valid object');
  }

  // Extract prospect_intel (optional but expected)
  const prospectIntel = analysisData.prospect_intel as ProspectIntel | undefined;
  
  // Extract stakeholders_intel (optional)
  const stakeholdersIntel = analysisData.stakeholders_intel as StakeholderIntel[] | undefined;

  // Build the result object with analysis metadata for debugging
  const result: AnalysisResult = {
    call_id: transcript.id,
    rep_id: transcript.rep_id,
    model_name: 'google/gemini-2.5-flash',
    prompt_version: 'v4-meddpicc',
    confidence: Number(analysisData.confidence) || 0.5,
    call_summary: String(analysisData.call_summary),
    // Individual scores set to 0 for backward compatibility - no longer generated
    discovery_score: 0,
    objection_handling_score: 0,
    rapport_communication_score: 0,
    product_knowledge_score: 0,
    deal_advancement_score: 0,
    call_effectiveness_score: 0,
    trend_indicators: analysisData.trend_indicators as Record<string, string>,
    deal_gaps: analysisData.deal_gaps as { critical_missing_info: string[]; unresolved_objections: string[] },
    strengths: analysisData.strengths as Array<{ area: string; example: string }>,
    opportunities: analysisData.opportunities as Array<{ area: string; example: string }>,
    skill_tags: analysisData.skill_tags as string[],
    deal_tags: analysisData.deal_tags as string[],
    meta_tags: analysisData.meta_tags as string[],
    call_notes: String(callNotes),
    recap_email_draft: String(finalRecapEmail),
    coach_output: coachOutput,
    raw_json: {
      ...analysisData,
      _analysis_metadata: {
        finish_reason: finishReason,
        retry_count: retryCount,
        transcript_length: transcriptLength,
        max_tokens_used: maxTokens,
        call_notes_length: (callNotes as string).length
      }
    },
    prospect_intel: prospectIntel,
    stakeholders_intel: stakeholdersIntel
  };

  console.log(`[analyze-call] Analysis parsed successfully (attempts: ${retryCount + 1}, call_notes: ${(callNotes as string).length} chars)`);
  return result;
}

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
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

  // Verify user and check rate limit
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid authentication' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check rate limit
  const rateLimit = checkRateLimit(user.id);
  if (!rateLimit.allowed) {
    console.log(`[analyze-call] Rate limit exceeded for user: ${user.id}`);
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimit.retryAfter || 60)
        } 
      }
    );
  }

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

    // Step 1: Read transcript WITH prospect in single query (validates access via RLS)
    const { data: transcriptWithProspect, error: fetchError } = await supabaseUser
      .from('call_transcripts')
      .select(`
        id, rep_id, raw_text, call_date, source, prospect_id,
        prospect:prospects(
          id, industry, opportunity_details, ai_extracted_info, heat_score, suggested_follow_ups
        )
      `)
      .eq('id', callId)
      .maybeSingle();

    if (fetchError) {
      console.error('[analyze-call] Error fetching transcript:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch call transcript' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!transcriptWithProspect) {
      console.warn(`[analyze-call] Transcript not found or access denied for call_id: ${callId}`);
      return new Response(
        JSON.stringify({ error: 'Call transcript not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cache IDs upfront to avoid redundant fetches
    const repId = transcriptWithProspect.rep_id;
    const prospectId = transcriptWithProspect.prospect_id;
    // Handle prospect relation - Supabase returns array for relations, but we want single object
    const prospectData = transcriptWithProspect.prospect;
    const currentProspect = (Array.isArray(prospectData) ? prospectData[0] : prospectData) as {
      id: string;
      industry: string | null;
      opportunity_details: Record<string, unknown> | null;
      ai_extracted_info: Record<string, unknown> | null;
      heat_score: number | null;
      suggested_follow_ups: unknown[] | null;
    } | null;

    // Extract transcript data for analysis
    const transcript: TranscriptRow = {
      id: transcriptWithProspect.id,
      rep_id: repId,
      raw_text: transcriptWithProspect.raw_text,
      call_date: transcriptWithProspect.call_date,
      source: transcriptWithProspect.source
    };

    console.log(`[analyze-call] Transcript found for rep_id: ${repId}, prospect_id: ${prospectId || 'none'}`);

    // Step 2: Update analysis_status to 'processing' using service role client
    const { error: updateProcessingError } = await supabaseAdmin
      .from('call_transcripts')
      .update({ analysis_status: 'processing', analysis_error: null })
      .eq('id', callId);

    if (updateProcessingError) {
      console.error('[analyze-call] Error updating status to processing:', updateProcessingError);
      // Continue anyway, this is not critical
    }

    // Step 3: Generate analysis using real AI
    console.log('[analyze-call] Using real AI analysis');
    const analysis = await generateRealAnalysis(transcript);
    analysis.prompt_version = 'v2-real-2025-11-27';

    console.log('[analyze-call] Analysis generated');

    // Step 4: Insert into ai_call_analysis using service role client
    // Extract stakeholders_intel before inserting (it's not a column in the table)
    const { stakeholders_intel, ...analysisForDb } = analysis;
    
    const { data: analysisResult, error: insertError } = await supabaseAdmin
      .from('ai_call_analysis')
      .insert(analysisForDb)
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

    // Step 6: CONSOLIDATED prospect update - build single update object
    if (prospectId && currentProspect && (analysis.prospect_intel || analysis.coach_output)) {
      try {
        const prospectUpdates: Record<string, unknown> = {};
        
        // AI-extracted info
        if (analysis.prospect_intel) {
          prospectUpdates.ai_extracted_info = analysis.prospect_intel;
          
          // Auto-populate industry only if not already set
          if (analysis.prospect_intel.industry && !currentProspect.industry) {
            prospectUpdates.industry = analysis.prospect_intel.industry;
            console.log(`[analyze-call] Auto-populating industry: ${analysis.prospect_intel.industry}`);
          }
        }
        
        // Suggested follow-ups from coaching
        if (analysis.coach_output?.recommended_follow_up_questions) {
          prospectUpdates.suggested_follow_ups = analysis.coach_output.recommended_follow_up_questions;
        }
        
        // Heat score
        if (analysis.coach_output?.heat_signature?.score) {
          prospectUpdates.heat_score = analysis.coach_output.heat_signature.score;
        }

        // Auto-populate opportunity_details with user counts if extracted
        const userCounts = analysis.prospect_intel?.user_counts;
        if (userCounts && (userCounts.it_users || userCounts.end_users || userCounts.ai_users)) {
          const currentDetails = (currentProspect.opportunity_details as Record<string, unknown>) || {};
          prospectUpdates.opportunity_details = {
            ...currentDetails,
            it_users_count: userCounts.it_users || currentDetails.it_users_count,
            end_users_count: userCounts.end_users || currentDetails.end_users_count,
            ai_users_count: userCounts.ai_users || currentDetails.ai_users_count,
            auto_populated_from: {
              source: 'transcript' as const,
              source_id: callId,
              extracted_at: new Date().toISOString(),
            },
          };
          console.log('[analyze-call] Including user counts in prospect update');
        }

        // Execute single consolidated prospect update
        if (Object.keys(prospectUpdates).length > 0) {
          const { error: updateProspectError } = await supabaseAdmin
            .from('prospects')
            .update(prospectUpdates)
            .eq('id', prospectId);
          
          if (updateProspectError) {
            console.error('[analyze-call] Failed to update prospect:', updateProspectError);
          } else {
            console.log(`[analyze-call] Updated prospect ${prospectId} with AI intel (single query)`);
          }
        }
      } catch (prospectErr) {
        console.error('[analyze-call] Failed to update prospect with AI intel:', prospectErr);
        // Don't fail the whole request, analysis was saved
      }
    }

    // Step 7: BATCHED stakeholder processing
    if (prospectId && stakeholders_intel && stakeholders_intel.length > 0) {
      try {
        console.log(`[analyze-call] Processing ${stakeholders_intel.length} stakeholders (batched)`);
        
        // Single query to get all existing stakeholders for this prospect
        const { data: existingStakeholders } = await supabaseAdmin
          .from('stakeholders')
          .select('id, name')
          .eq('prospect_id', prospectId)
          .is('deleted_at', null);
        
        // Create lookup map (lowercase name -> id)
        const existingMap = new Map<string, string>();
        if (existingStakeholders) {
          for (const s of existingStakeholders) {
            existingMap.set(s.name.toLowerCase(), s.id);
          }
        }
        
        // Separate into updates and inserts
        const stakeholderUpdates: Array<{ id: string; data: Record<string, unknown> }> = [];
        const stakeholderInserts: Array<Record<string, unknown>> = [];
        const mentionsToInsert: Array<{ call_id: string; stakeholder_id: string; was_present: boolean; context_notes: string | null }> = [];
        
        for (const intel of stakeholders_intel) {
          if (!intel.name) continue;
          
          const existingId = existingMap.get(intel.name.toLowerCase());
          const baseData = {
            job_title: intel.job_title || null,
            influence_level: intel.influence_level || 'light_influencer',
            champion_score: intel.champion_score || null,
            champion_score_reasoning: intel.champion_score_reasoning || null,
            ai_extracted_info: intel.ai_notes ? { notes: intel.ai_notes } : null,
            last_interaction_date: new Date().toISOString().split('T')[0],
          };
          
          if (existingId) {
            stakeholderUpdates.push({ id: existingId, data: baseData });
            // Queue mention
            if (intel.was_present !== false) {
              mentionsToInsert.push({
                call_id: callId,
                stakeholder_id: existingId,
                was_present: intel.was_present ?? true,
                context_notes: intel.ai_notes || null,
              });
            }
          } else {
            stakeholderInserts.push({
              prospect_id: prospectId,
              rep_id: repId,
              name: intel.name,
              ...baseData,
              is_primary_contact: false,
            });
          }
        }
        
        // Execute batch updates (can't truly batch updates, but at least we minimize queries)
        for (const update of stakeholderUpdates) {
          await supabaseAdmin
            .from('stakeholders')
            .update(update.data)
            .eq('id', update.id);
        }
        console.log(`[analyze-call] Updated ${stakeholderUpdates.length} existing stakeholders`);
        
        // Batch insert new stakeholders
        if (stakeholderInserts.length > 0) {
          const { data: newStakeholders, error: insertStakeholdersError } = await supabaseAdmin
            .from('stakeholders')
            .insert(stakeholderInserts)
            .select('id, name');
          
          if (insertStakeholdersError) {
            console.error('[analyze-call] Failed to batch insert stakeholders:', insertStakeholdersError);
          } else if (newStakeholders) {
            console.log(`[analyze-call] Created ${newStakeholders.length} new stakeholders`);
            
            // Queue mentions for new stakeholders
            for (const newS of newStakeholders) {
              const intel = stakeholders_intel.find(i => i.name?.toLowerCase() === newS.name.toLowerCase());
              if (intel && intel.was_present !== false) {
                mentionsToInsert.push({
                  call_id: callId,
                  stakeholder_id: newS.id,
                  was_present: intel.was_present ?? true,
                  context_notes: intel.ai_notes || null,
                });
              }
            }
          }
        }
        
        // Batch upsert all call_stakeholder_mentions
        if (mentionsToInsert.length > 0) {
          const { error: mentionsError } = await supabaseAdmin
            .from('call_stakeholder_mentions')
            .upsert(mentionsToInsert, { onConflict: 'call_id,stakeholder_id' });
          
          if (mentionsError) {
            console.error('[analyze-call] Failed to batch upsert mentions:', mentionsError);
          } else {
            console.log(`[analyze-call] Upserted ${mentionsToInsert.length} stakeholder mentions`);
          }
        }
        
        console.log(`[analyze-call] Finished processing stakeholders`);
      } catch (stakeholderErr) {
        console.error('[analyze-call] Failed to process stakeholders:', stakeholderErr);
        // Don't fail the whole request, analysis was saved
      }
    }

    console.log(`[analyze-call] Analysis completed successfully for call_id: ${callId}`);

    // Step 8: Trigger follow-up generation in background if prospect exists (using cached prospectId)
    if (prospectId) {
      console.log(`[analyze-call] Triggering follow-up generation for prospect: ${prospectId}`);
      
      // Fire and forget - don't await, let it run in background
      EdgeRuntime.waitUntil(
        fetch(`${supabaseUrl}/functions/v1/generate-account-follow-ups`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ prospect_id: prospectId })
        }).catch(err => console.error('[analyze-call] Failed to trigger follow-up generation:', err))
      );
    }

    // Step 9: Trigger transcript chunking in background for RAG indexing (using cached callId)
    console.log(`[analyze-call] Triggering transcript chunking for call: ${callId}`);
    EdgeRuntime.waitUntil(
      fetch(`${supabaseUrl}/functions/v1/chunk-transcripts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ call_ids: [callId] })
      }).catch(err => console.error('[analyze-call] Failed to trigger chunking:', err))
    );

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis_id: analysisId,
        message: 'Analysis completed successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[analyze-call] Unexpected error:', error);
    
    // Try to update transcript status to error if we have a callId
    if (callId) {
      try {
        await supabaseAdmin
          .from('call_transcripts')
          .update({ 
            analysis_status: 'error',
            analysis_error: error instanceof Error ? error.message : 'Unexpected error during analysis'
          })
          .eq('id', callId);
      } catch (updateError) {
        console.error('[analyze-call] Failed to update error status:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
