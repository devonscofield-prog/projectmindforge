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

// System prompt for call analysis - includes call_notes and recap_email_draft generation
const ANALYSIS_SYSTEM_PROMPT = `You are an AI Sales Call Analyst for StormWind.

Your job is to analyze a full call transcript and generate:
1. A structured JSON analysis for coaching
2. Internal Call Notes for CRM use
3. A customer-facing Recap Email Draft for the rep to send
4. AI Call Coach feedback with framework scores and improvements
5. Stakeholder intelligence - details about each person mentioned in the call

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
- trend_indicators: Object with trend directions (e.g., {"discovery": "improving", "objections": "stable"})
- deal_gaps: Object with "critical_missing_info" (array of strings) and "unresolved_objections" (array of strings)
- strengths: Array of objects with "area" and "example" fields showing what went well
- opportunities: Array of objects with "area" and "example" fields for improvement areas
- skill_tags: Array of skill-related tags (e.g., "discovery_depth_medium", "rapport_strong")
- deal_tags: Array of deal-related tags (e.g., "no_confirmed_timeline", "single_threaded")
- meta_tags: Array of metadata tags (e.g., "short_transcript", "first_call")

### StormWind AI Call Coach — Concise Edition (v8)
In addition to all existing outputs, act as the StormWind AI Call Coach. Populate the \`coach_output\` field with:
- Call Type (Discovery, Demo, Negotiation)
- Duration in minutes (estimate based on transcript length if not explicit)
- Framework scores (MEDDPICC, Gap Selling, Active Listening)

#### MEDDPICC Framework (Most Important)
For MEDDPICC, provide a SCORE (0-100) and JUSTIFICATION for EACH of the 8 elements:
• Metrics (M): Did the rep uncover quantifiable business outcomes the prospect wants to achieve?
• Economic Buyer (E): Was the person with final budget authority and sign-off power identified?
• Decision Criteria (D1): Were the formal evaluation criteria and requirements established?
• Decision Process (D2): Was the buying process, approval chain, and timeline mapped out?
• Paper Process (P): Was procurement, legal review, or contract process discussed?
• Identify Pain (I): Were business pains, their root causes, and business impact thoroughly uncovered?
• Champion (C): Is there an internal advocate who is actively selling on your behalf?
• Competition (C2): Were alternatives, competitors, or "do nothing" options understood?

For each element, provide:
- score: 0-100 based on evidence from the transcript
- justification: 1-2 sentences with specific examples from the call explaining the score

Also provide:
- overall_score: Weighted average of all 8 elements (0-100)
- summary: 2-3 sentence assessment of MEDDPICC qualification status

#### Gap Selling Framework
- Score 0-100 with 1-sentence summary
- 1-2 improvement points

#### Active Listening Framework
- Score 0-100 with 1-sentence summary
- 1-2 improvement points

#### Additional Coaching Output
- 3–5 critical missing pieces needed to close the deal, each with a specific example of when during the call the rep missed an opportunity to ask for this information (referencing what the prospect said or the moment in the conversation)
- 3–5 recommended follow-up questions, each with a specific example of when during the call it would have been best to ask (referencing what the prospect said or the moment in the conversation)
- Heat Signature (1–10) with explanation of deal temperature/likelihood to close
Use direct evidence from transcript or explicitly say "⚠️ No evidence found."

### Stakeholder Intelligence
Extract information about EVERY person/stakeholder mentioned in the transcript. For each person:
- name: Full name as mentioned
- job_title: Their role/title if mentioned
- influence_level: One of "light_influencer", "heavy_influencer", "secondary_dm", "final_dm" based on context clues
- champion_score: 1-10 rating of how bought-in they are to the product/solution
- champion_score_reasoning: 1-2 sentences explaining the score based on their statements/actions
- was_present: true if they were on the call, false if just mentioned
- ai_notes: Any other relevant observations about this person

Influence level guidelines:
- final_dm: Has final budget/sign-off authority, can make the decision alone
- secondary_dm: Has significant decision power but needs approval from above
- heavy_influencer: Strong voice in the decision, technical gatekeeper, or key advocate
- light_influencer: Involved but limited decision power, may be end user or junior stakeholder

Champion score guidelines:
- 8-10: Actively advocating internally, asking about implementation, pushing timeline
- 5-7: Interested and engaged, but not actively pushing internally yet
- 3-4: Neutral or showing some concerns that need addressing
- 1-2: Skeptical, resistant, or actively blocking

### User Count Extraction
Extract organization size information when the prospect mentions team sizes, user counts, or organization details:
- it_users: Number of IT/technical staff mentioned
- end_users: Total employee count or non-technical users mentioned
- ai_users: Users who would need AI-specific training mentioned
- source_quote: The exact quote where this information was mentioned
Only extract if explicitly mentioned - do not estimate or guess.

FINAL OUTPUT:
Return all fields via the submit_call_analysis function call.`;

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

/**
 * Validate that recap_email_draft contains required links
 */
function validateRecapEmailLinks(recapEmail: string): boolean {
  return REQUIRED_RECAP_LINKS.every(link => recapEmail.includes(link));
}

/**
 * Validate call_notes for completeness and detect truncation
 */
function validateCallNotes(callNotes: string): { valid: boolean; issues: string[] } {
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
  
  return { valid: issues.length === 0, issues };
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
            description: "Coaching output based on MEDDPICC, Gap Selling, and Active Listening frameworks.",
            properties: {
              call_type: { type: "string", description: "Type of call: Discovery, Demo, or Negotiation" },
              duration_minutes: { type: "number", description: "Estimated duration of the call in minutes" },
              framework_scores: {
                type: "object",
                properties: {
                  meddpicc: {
                    type: "object",
                    description: "MEDDPICC qualification framework with per-element scoring",
                    properties: {
                      metrics: {
                        type: "object",
                        properties: {
                          score: { type: "number", description: "Score 0-100 for Metrics qualification" },
                          justification: { type: "string", description: "1-2 sentences explaining the score with specific examples from the call" }
                        },
                        required: ["score", "justification"]
                      },
                      economic_buyer: {
                        type: "object",
                        properties: {
                          score: { type: "number", description: "Score 0-100 for Economic Buyer identification" },
                          justification: { type: "string", description: "1-2 sentences explaining the score with specific examples from the call" }
                        },
                        required: ["score", "justification"]
                      },
                      decision_criteria: {
                        type: "object",
                        properties: {
                          score: { type: "number", description: "Score 0-100 for Decision Criteria establishment" },
                          justification: { type: "string", description: "1-2 sentences explaining the score with specific examples from the call" }
                        },
                        required: ["score", "justification"]
                      },
                      decision_process: {
                        type: "object",
                        properties: {
                          score: { type: "number", description: "Score 0-100 for Decision Process mapping" },
                          justification: { type: "string", description: "1-2 sentences explaining the score with specific examples from the call" }
                        },
                        required: ["score", "justification"]
                      },
                      paper_process: {
                        type: "object",
                        properties: {
                          score: { type: "number", description: "Score 0-100 for Paper Process understanding" },
                          justification: { type: "string", description: "1-2 sentences explaining the score with specific examples from the call" }
                        },
                        required: ["score", "justification"]
                      },
                      identify_pain: {
                        type: "object",
                        properties: {
                          score: { type: "number", description: "Score 0-100 for Identify Pain depth" },
                          justification: { type: "string", description: "1-2 sentences explaining the score with specific examples from the call" }
                        },
                        required: ["score", "justification"]
                      },
                      champion: {
                        type: "object",
                        properties: {
                          score: { type: "number", description: "Score 0-100 for Champion identification" },
                          justification: { type: "string", description: "1-2 sentences explaining the score with specific examples from the call" }
                        },
                        required: ["score", "justification"]
                      },
                      competition: {
                        type: "object",
                        properties: {
                          score: { type: "number", description: "Score 0-100 for Competition understanding" },
                          justification: { type: "string", description: "1-2 sentences explaining the score with specific examples from the call" }
                        },
                        required: ["score", "justification"]
                      },
                      overall_score: { type: "number", description: "Weighted average score 0-100 across all MEDDPICC elements" },
                      summary: { type: "string", description: "2-3 sentence assessment of overall MEDDPICC qualification status" }
                    },
                    required: ["metrics", "economic_buyer", "decision_criteria", "decision_process", "paper_process", "identify_pain", "champion", "competition", "overall_score", "summary"]
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
                required: ["meddpicc", "gap_selling", "active_listening"]
              },
              meddpicc_improvements: { type: "array", items: { type: "string" }, description: "1-2 specific improvements for MEDDPICC qualification" },
              gap_selling_improvements: { type: "array", items: { type: "string" }, description: "1-2 specific improvements for Gap Selling" },
              active_listening_improvements: { type: "array", items: { type: "string" }, description: "1-2 specific improvements for Active Listening" },
              critical_info_missing: { 
                type: "array", 
                items: { 
                  type: "object",
                  properties: {
                    info: { type: "string", description: "The critical piece of information that's missing" },
                    missed_opportunity: { type: "string", description: "When during the call the rep missed an opportunity to ask for this, referencing a specific moment or statement" }
                  },
                  required: ["info", "missed_opportunity"]
                }, 
                description: "3-5 critical missing pieces with examples of when the rep could have asked" 
              },
              recommended_follow_up_questions: { 
                type: "array", 
                items: { 
                  type: "object",
                  properties: {
                    question: { type: "string", description: "The follow-up question to ask" },
                    timing_example: { type: "string", description: "When during the call this question would have been best asked, referencing a specific moment or statement from the prospect" }
                  },
                  required: ["question", "timing_example"]
                }, 
                description: "3-5 recommended follow-up questions with examples of optimal timing" 
              },
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
              "meddpicc_improvements",
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
              competitors_mentioned: { type: "array", items: { type: "string" }, description: "Competitors mentioned during the call" },
              industry: { 
                type: "string", 
                enum: ["education", "local_government", "state_government", "federal_government", "healthcare", "msp", "technology", "finance", "manufacturing", "retail", "nonprofit", "other"],
                description: "The likely industry based on this call transcript"
              },
              user_counts: {
                type: "object",
                description: "Organization size information if explicitly mentioned - DO NOT estimate or guess",
                properties: {
                  it_users: { type: "number", description: "Number of IT/technical staff explicitly mentioned" },
                  end_users: { type: "number", description: "Total employee count or non-technical users explicitly mentioned" },
                  ai_users: { type: "number", description: "Users who would need AI-specific training explicitly mentioned" },
                  source_quote: { type: "string", description: "The exact quote where this information was mentioned" }
                }
              }
            }
          },
          stakeholders_intel: {
            type: "array",
            description: "Detailed intelligence about each stakeholder mentioned in the call",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Full name of the stakeholder" },
                job_title: { type: "string", description: "Job title or role if mentioned" },
                influence_level: { type: "string", enum: ["light_influencer", "heavy_influencer", "secondary_dm", "final_dm"], description: "Level of influence in the decision" },
                champion_score: { type: "number", description: "1-10 rating of how bought-in they are" },
                champion_score_reasoning: { type: "string", description: "Explanation for the champion score" },
                was_present: { type: "boolean", description: "Whether they were on the call" },
                ai_notes: { type: "string", description: "Additional observations about this person" }
              },
              required: ["name", "influence_level"]
            }
          }
        },
        required: [
          "call_summary",
          "confidence",
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
      max_tokens: 16384, // Ensure sufficient output for complete structured analysis
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
  const callNotesValidation = validateCallNotes(callNotes);
  if (!callNotesValidation.valid) {
    console.error('[analyze-call] call_notes validation failed:', callNotesValidation.issues);
    // Log warning but don't throw - allow partial notes to be saved with warning
    console.warn('[analyze-call] WARNING: Call notes may be truncated or incomplete');
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
  
  // Extract stakeholders_intel (optional)
  const stakeholdersIntel = analysisData.stakeholders_intel as StakeholderIntel[] | undefined;

  // Build the result object
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
    recap_email_draft: String(recapEmail),
    coach_output: coachOutput,
    raw_json: analysisData,
    prospect_intel: prospectIntel,
    stakeholders_intel: stakeholdersIntel
  };

  console.log('[analyze-call] Analysis parsed successfully with call_notes, recap_email_draft, and coach_output');
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

    // Step 3: Generate analysis using real AI
    console.log('[analyze-call] Using real AI analysis');
    const analysis = await generateRealAnalysis(transcript as TranscriptRow);
    analysis.prompt_version = 'v2-real-2025-11-27';

    console.log('[analyze-call] Analysis generated');

    // Step 5: Insert into ai_call_analysis using service role client
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
        // Get the prospect_id and current industry from the call transcript
        const { data: callData } = await supabaseAdmin
          .from('call_transcripts')
          .select('prospect_id')
          .eq('id', callId)
          .single();

        if (callData?.prospect_id) {
          // Fetch current prospect to check if industry is already set
          const { data: currentProspect } = await supabaseAdmin
            .from('prospects')
            .select('industry')
            .eq('id', callData.prospect_id)
            .single();

          const prospectUpdates: Record<string, unknown> = {};
          
          if (analysis.prospect_intel) {
            prospectUpdates.ai_extracted_info = analysis.prospect_intel;
            
            // Auto-populate industry only if not already set
            if (analysis.prospect_intel.industry && !currentProspect?.industry) {
              prospectUpdates.industry = analysis.prospect_intel.industry;
              console.log(`[analyze-call] Auto-populating industry: ${analysis.prospect_intel.industry}`);
            }
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

          // Auto-populate opportunity_details if user counts were extracted
          if (analysis.prospect_intel?.user_counts && (analysis.prospect_intel.user_counts.it_users || analysis.prospect_intel.user_counts.end_users || analysis.prospect_intel.user_counts.ai_users)) {
            console.log('[analyze-call] Auto-populating opportunity details with user counts');
            
            // Fetch current opportunity_details to merge
            const { data: currentProspectDetails } = await supabaseAdmin
              .from('prospects')
              .select('opportunity_details')
              .eq('id', callData.prospect_id)
              .single();
            
            const currentDetails = (currentProspectDetails?.opportunity_details as any) || {};
            
            // Update prospect with extracted user counts
            const { error: updateOpportunityError } = await supabaseAdmin
              .from('prospects')
              .update({
                opportunity_details: {
                  ...currentDetails,
                  it_users_count: analysis.prospect_intel.user_counts.it_users || currentDetails.it_users_count,
                  end_users_count: analysis.prospect_intel.user_counts.end_users || currentDetails.end_users_count,
                  ai_users_count: analysis.prospect_intel.user_counts.ai_users || currentDetails.ai_users_count,
                  auto_populated_from: {
                    source: 'transcript' as const,
                    source_id: callId,
                    extracted_at: new Date().toISOString(),
                  },
                },
              })
              .eq('id', callData.prospect_id);
            
            if (updateOpportunityError) {
              console.error('[analyze-call] Failed to update opportunity details:', updateOpportunityError);
            } else {
              console.log('[analyze-call] Successfully auto-populated opportunity details');
            }
          }
        }
      } catch (prospectErr) {
        console.error('[analyze-call] Failed to update prospect with AI intel:', prospectErr);
        // Don't fail the whole request, analysis was saved
      }
    }

    // Step 8: Process stakeholders_intel - create/update stakeholders
    if (analysis.stakeholders_intel && analysis.stakeholders_intel.length > 0) {
      try {
        // Get the prospect_id and rep_id from the call transcript
        const { data: callData } = await supabaseAdmin
          .from('call_transcripts')
          .select('prospect_id, rep_id')
          .eq('id', callId)
          .single();

        if (callData?.prospect_id && callData?.rep_id) {
          console.log(`[analyze-call] Processing ${analysis.stakeholders_intel.length} stakeholders`);
          
          for (const stakeholderIntel of analysis.stakeholders_intel) {
            if (!stakeholderIntel.name) continue;
            
            // Check if stakeholder already exists (case-insensitive match)
            const { data: existingStakeholder } = await supabaseAdmin
              .from('stakeholders')
              .select('id')
              .eq('prospect_id', callData.prospect_id)
              .ilike('name', stakeholderIntel.name)
              .maybeSingle();

            if (existingStakeholder) {
              // Update existing stakeholder with new intel
              const updates: Record<string, unknown> = {
                last_interaction_date: new Date().toISOString().split('T')[0],
              };
              
              if (stakeholderIntel.job_title) {
                updates.job_title = stakeholderIntel.job_title;
              }
              if (stakeholderIntel.influence_level) {
                updates.influence_level = stakeholderIntel.influence_level;
              }
              if (stakeholderIntel.champion_score) {
                updates.champion_score = stakeholderIntel.champion_score;
              }
              if (stakeholderIntel.champion_score_reasoning) {
                updates.champion_score_reasoning = stakeholderIntel.champion_score_reasoning;
              }
              if (stakeholderIntel.ai_notes) {
                updates.ai_extracted_info = { notes: stakeholderIntel.ai_notes };
              }

              await supabaseAdmin
                .from('stakeholders')
                .update(updates)
                .eq('id', existingStakeholder.id);
              
              console.log(`[analyze-call] Updated stakeholder: ${stakeholderIntel.name}`);

              // Create call mention if stakeholder was present
              if (stakeholderIntel.was_present !== false) {
                await supabaseAdmin
                  .from('call_stakeholder_mentions')
                  .upsert({
                    call_id: callId,
                    stakeholder_id: existingStakeholder.id,
                    was_present: stakeholderIntel.was_present ?? true,
                    context_notes: stakeholderIntel.ai_notes || null,
                  }, { onConflict: 'call_id,stakeholder_id' });
              }
            } else {
              // Create new stakeholder
              const { data: newStakeholder, error: createError } = await supabaseAdmin
                .from('stakeholders')
                .insert({
                  prospect_id: callData.prospect_id,
                  rep_id: callData.rep_id,
                  name: stakeholderIntel.name,
                  job_title: stakeholderIntel.job_title || null,
                  influence_level: stakeholderIntel.influence_level || 'light_influencer',
                  champion_score: stakeholderIntel.champion_score || null,
                  champion_score_reasoning: stakeholderIntel.champion_score_reasoning || null,
                  ai_extracted_info: stakeholderIntel.ai_notes ? { notes: stakeholderIntel.ai_notes } : null,
                  is_primary_contact: false,
                  last_interaction_date: new Date().toISOString().split('T')[0],
                })
                .select('id')
                .single();

              if (createError) {
                console.error(`[analyze-call] Failed to create stakeholder ${stakeholderIntel.name}:`, createError);
                continue;
              }

              console.log(`[analyze-call] Created new stakeholder: ${stakeholderIntel.name}`);

              // Create call mention if stakeholder was present
              if (newStakeholder && stakeholderIntel.was_present !== false) {
                await supabaseAdmin
                  .from('call_stakeholder_mentions')
                  .insert({
                    call_id: callId,
                    stakeholder_id: newStakeholder.id,
                    was_present: stakeholderIntel.was_present ?? true,
                    context_notes: stakeholderIntel.ai_notes || null,
                  });
              }
            }
          }
          
          console.log(`[analyze-call] Finished processing stakeholders`);
        }
      } catch (stakeholderErr) {
        console.error('[analyze-call] Failed to process stakeholders:', stakeholderErr);
        // Don't fail the whole request, analysis was saved
      }
    }

    console.log(`[analyze-call] Analysis completed successfully for call_id: ${callId}`);

    // Step 9: Trigger follow-up generation in background if prospect exists
    try {
      const { data: callData } = await supabaseAdmin
        .from('call_transcripts')
        .select('prospect_id')
        .eq('id', callId)
        .single();

      if (callData?.prospect_id) {
        console.log(`[analyze-call] Triggering follow-up generation for prospect: ${callData.prospect_id}`);
        
        // Fire and forget - don't await, let it run in background
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        
        EdgeRuntime.waitUntil(
          fetch(`${supabaseUrl}/functions/v1/generate-account-follow-ups`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prospect_id: callData.prospect_id })
          }).then(res => {
            if (!res.ok) {
              console.error('[analyze-call] Follow-up generation failed:', res.status);
            } else {
              console.log('[analyze-call] Follow-up generation triggered successfully');
            }
          }).catch(err => {
            console.error('[analyze-call] Follow-up generation error:', err);
          })
        );
      }
    } catch (followUpErr) {
      console.error('[analyze-call] Error triggering follow-up generation:', followUpErr);
      // Don't fail the request
    }

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
