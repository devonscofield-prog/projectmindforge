// Constants for analyze-call edge function

// Rate limiting config
export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const RATE_LIMIT_MAX_REQUESTS = 5;

// AI Gateway timeout (55s to leave buffer before edge function 60s timeout)
export const AI_GATEWAY_TIMEOUT_MS = 55000;

// UUID validation regex
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Required links that must appear in recap_email_draft
export const REQUIRED_RECAP_LINKS = [
  '[StormWind Website](https://info.stormwind.com/)',
  '[View Sample Courses](https://info.stormwind.com/training-samples)'
];

// Required section headers in call_notes
export const REQUIRED_CALL_NOTES_SECTIONS = [
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
export const MIN_CALL_NOTES_LENGTH = 1500;

// Adaptive token limits based on transcript length
export const TOKEN_LIMITS = {
  SHORT: 16384,      // Transcripts < 15,000 chars
  MEDIUM: 24576,     // Transcripts 15,000-25,000 chars
  LONG: 32768,       // Transcripts > 25,000 chars or retry
  MAX_RETRY: 40960   // Maximum for second retry
};

// Transcript length thresholds (characters)
export const TRANSCRIPT_LENGTH_THRESHOLDS = {
  MEDIUM: 15000,
  LONG: 25000
};

// Compressed system prompt - optimized for token efficiency
export const ANALYSIS_SYSTEM_PROMPT = `You are an AI Sales Call Analyst for StormWind. Analyze call transcripts and generate:
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
export const ANALYSIS_TOOL_SCHEMA = {
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
