/**
 * Analysis Agents for Call Analysis 2.0
 * 
 * Agent 1a: The Census - Structured data extraction (participants, logistics, user counts)
 * Agent 1b: The Historian - Executive summary & key topics
 * Agent 2: The Referee - Behavioral scoring
 * Agent 3: The Interrogator - Question leverage analysis
 * Agent 4: The Strategist - Strategy & pain-to-pitch alignment
 * Agent 5: The Skeptic - Deal gaps analysis
 * Agent 6: The Negotiator - Objection handling analysis
 * Agent 7: The Profiler - Prospect psychology profiling
 * Agent 8: The Spy - Competitive intelligence analysis
 */

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Timeout for AI Gateway calls (55s to leave buffer before 60s edge function timeout)
const AI_GATEWAY_TIMEOUT_MS = 55000;

// ============= ZOD VALIDATION SCHEMAS =============
// These are used to validate AI responses at runtime

// The Census - structured data only (no summary/topics)
const CallCensusValidation = z.object({
  logistics: z.object({
    platform: z.string().optional(),
    duration_minutes: z.number(),
    video_on: z.boolean(),
  }),
  participants: z.array(z.object({
    name: z.string(),
    role: z.string(),
    is_decision_maker: z.boolean(),
    sentiment: z.enum(['Positive', 'Neutral', 'Negative', 'Skeptical']),
  })),
  user_counts: z.object({
    it_users: z.number().nullable(),
    end_users: z.number().nullable(),
    source_quote: z.string().nullable(),
  }),
});

// The Historian - summary and topics
const CallHistoryValidation = z.object({
  summary: z.string(),
  key_topics: z.array(z.string()),
});

// Combined CallMetadata (for backward compatibility with merged output)
const CallMetadataValidation = z.object({
  summary: z.string(),
  topics: z.array(z.string()),
  logistics: z.object({
    platform: z.string().optional(),
    duration_minutes: z.number(),
    video_on: z.boolean(),
  }),
  participants: z.array(z.object({
    name: z.string(),
    role: z.string(),
    is_decision_maker: z.boolean(),
    sentiment: z.enum(['Positive', 'Neutral', 'Negative', 'Skeptical']),
  })),
  user_counts: z.object({
    it_users: z.number().nullable(),
    end_users: z.number().nullable(),
    source_quote: z.string().nullable(),
  }),
});

const BehaviorScoreValidation = z.object({
  overall_score: z.number(),
  grade: z.enum(['Pass', 'Fail']),
  metrics: z.object({
    patience: z.object({
      score: z.number(),
      interruption_count: z.number(),
      status: z.enum(['Excellent', 'Good', 'Fair', 'Poor']),
      interruptions: z.array(z.object({
        interrupted_speaker: z.string(),
        interrupter: z.string(),
        context: z.string(),
        severity: z.enum(['Minor', 'Moderate', 'Severe']),
      })).optional(),
    }),
    monologue: z.object({
      score: z.number(),
      longest_turn_word_count: z.number(),
      violation_count: z.number(),
    }),
    talk_listen_ratio: z.object({
      score: z.number(),
      rep_talk_percentage: z.number(),
    }),
    next_steps: z.object({
      score: z.number(),
      secured: z.boolean(),
      details: z.string(),
    }),
  }),
});

const QuestionLeverageValidation = z.object({
  score: z.number(),
  explanation: z.string(),
  average_question_length: z.number(),
  average_answer_length: z.number(),
  high_leverage_count: z.number(),
  low_leverage_count: z.number(),
  high_leverage_examples: z.array(z.string()),
  low_leverage_examples: z.array(z.string()),
  total_sales_questions: z.number(),
  yield_ratio: z.number(),
});

const StrategicThreadingValidation = z.object({
  strategic_threading: z.object({
    score: z.number(),
    grade: z.enum(['Pass', 'Fail']),
    relevance_map: z.array(z.object({
      pain_identified: z.string(),
      feature_pitched: z.string(),
      is_relevant: z.boolean(),
      reasoning: z.string(),
    })),
    missed_opportunities: z.array(z.string()),
  }),
});

const DealGapsValidation = z.object({
  critical_gaps: z.array(z.object({
    category: z.enum(['Budget', 'Authority', 'Need', 'Timeline', 'Competition', 'Technical']),
    description: z.string(),
    impact: z.enum(['High', 'Medium', 'Low']),
    suggested_question: z.string(),
  })),
});

const CompetitiveIntelValidation = z.object({
  competitive_intel: z.array(z.object({
    competitor_name: z.string(),
    usage_status: z.enum(['Current Vendor', 'Past Vendor', 'Evaluating', 'Mentioned']),
    strengths_mentioned: z.array(z.string()),
    weaknesses_mentioned: z.array(z.string()),
    threat_level: z.enum(['High', 'Medium', 'Low']),
    churn_risk: z.enum(['High', 'Medium', 'Low']),
    silver_bullet_question: z.string(),
  })),
});

const ObjectionHandlingValidation = z.object({
  score: z.number(),
  grade: z.enum(['Pass', 'Fail']),
  objections_detected: z.array(z.object({
    objection: z.string(),
    category: z.enum(['Price', 'Competitor', 'Authority', 'Need', 'Timing', 'Feature']),
    rep_response: z.string(),
    handling_rating: z.enum(['Great', 'Okay', 'Bad']),
    coaching_tip: z.string(),
  })),
});

const PsychologyProfileValidation = z.object({
  prospect_persona: z.string(),
  disc_profile: z.enum(['D - Dominance', 'I - Influence', 'S - Steadiness', 'C - Compliance', 'Unknown']),
  communication_style: z.object({
    tone: z.string(),
    preference: z.string(),
  }),
  dos_and_donts: z.object({
    do: z.array(z.string()),
    dont: z.array(z.string()),
  }),
});

// Tool schemas for structured output extraction
// Tool for The Census - structured data extraction only
const CALL_CENSUS_TOOL = {
  type: "function",
  function: {
    name: "extract_call_census",
    description: "Extract structured data entities from a sales call: participants, logistics, and user counts",
    parameters: {
      type: "object",
      properties: {
        logistics: {
          type: "object",
          properties: {
            platform: { type: "string", description: "Meeting platform if mentioned" },
            duration_minutes: { type: "number", description: "Call duration in minutes" },
            video_on: { type: "boolean", description: "Whether video was on" }
          },
          required: ["duration_minutes", "video_on"]
        },
        participants: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              role: { type: "string", description: "Job title or inferred role" },
              is_decision_maker: { type: "boolean" },
              sentiment: { type: "string", enum: ["Positive", "Neutral", "Negative", "Skeptical"] }
            },
            required: ["name", "role", "is_decision_maker", "sentiment"]
          }
        },
        user_counts: {
          type: "object",
          properties: {
            it_users: { type: "number", description: "Number of IT staff mentioned, null if not mentioned" },
            end_users: { type: "number", description: "Number of general employees mentioned, null if not mentioned" },
            source_quote: { type: "string", description: "The exact quote where these numbers were mentioned, null if none" }
          }
        }
      },
      required: ["logistics", "participants", "user_counts"]
    }
  }
};

// Tool for The Historian - executive summary and topics
const CALL_HISTORY_TOOL = {
  type: "function",
  function: {
    name: "write_call_history",
    description: "Write a high-quality executive summary of a sales call",
    parameters: {
      type: "object",
      properties: {
        summary: { 
          type: "string", 
          description: "A 3-4 paragraph executive summary covering Context, Problem, Solution Discussed, and Outcome" 
        },
        key_topics: { 
          type: "array", 
          items: { type: "string" },
          description: "Top 5 distinct topics discussed in the call (e.g., 'Security Training', 'Pricing', 'SSO Integration')"
        }
      },
      required: ["summary", "key_topics"]
    }
  }
};

// Tool for The Interrogator - dedicated question analysis
const QUESTION_LEVERAGE_TOOL = {
  type: "function",
  function: {
    name: "analyze_question_leverage",
    description: "Analyze question/answer dynamics from a sales call transcript",
    parameters: {
      type: "object",
      properties: {
        score: { type: "number", minimum: 0, maximum: 20, description: "Score 0-20 based on question leverage effectiveness" },
        explanation: { type: "string", description: "Brief note on question leverage effectiveness" },
        average_question_length: { type: "number", description: "Average word count of Rep's sales questions" },
        average_answer_length: { type: "number", description: "Average word count of Prospect's immediate answers" },
        high_leverage_count: { type: "number", description: "Count of questions where prospect answer was longer than question" },
        low_leverage_count: { type: "number", description: "Count of questions where question was longer than answer" },
        high_leverage_examples: { 
          type: "array", 
          items: { type: "string" },
          description: "Exact quotes of the 2 best questions that triggered long, detailed answers"
        },
        low_leverage_examples: { 
          type: "array", 
          items: { type: "string" },
          description: "Exact quotes of the 2 worst questions that got minimal responses"
        },
        total_sales_questions: { type: "number", description: "Total number of qualifying sales questions found" },
        yield_ratio: { type: "number", description: "Calculated ratio: average_answer_length / average_question_length" }
      },
      required: ["score", "explanation", "average_question_length", "average_answer_length", "high_leverage_count", "low_leverage_count", "high_leverage_examples", "low_leverage_examples", "total_sales_questions", "yield_ratio"]
    }
  }
};

const BEHAVIOR_SCORE_TOOL = {
  type: "function",
  function: {
    name: "score_call_behavior",
    description: "Analyze and score the behavioral dynamics of a sales call (excluding question analysis)",
    parameters: {
      type: "object",
      properties: {
        overall_score: { type: "number", minimum: 0, maximum: 80, description: "Overall behavioral score 0-80 (question_quality added separately)" },
        grade: { type: "string", enum: ["Pass", "Fail"], description: "Pass if final score >= 60, Fail otherwise" },
        metrics: {
          type: "object",
          properties: {
            patience: {
              type: "object",
              properties: {
                score: { type: "number", minimum: 0, maximum: 30, description: "Score 0-30" },
                interruption_count: { type: "number", description: "Number of interruptions detected" },
                status: { type: "string", enum: ["Excellent", "Good", "Fair", "Poor"] },
                interruptions: {
                  type: "array",
                  description: "List of interruption instances detected",
                  items: {
                    type: "object",
                    properties: {
                      interrupted_speaker: { type: "string", description: "Who was cut off" },
                      interrupter: { type: "string", description: "Who interrupted" },
                      context: { type: "string", description: "Brief description of what was being said" },
                      severity: { type: "string", enum: ["Minor", "Moderate", "Severe"], description: "Minor = brief overlap, Moderate = cut off mid-thought, Severe = repeated pattern" }
                    },
                    required: ["interrupted_speaker", "interrupter", "context", "severity"]
                  }
                }
              },
              required: ["score", "interruption_count", "status"]
            },
            monologue: {
              type: "object",
              properties: {
                score: { type: "number", minimum: 0, maximum: 20, description: "Score 0-20" },
                longest_turn_word_count: { type: "number", description: "Word count of longest turn" },
                violation_count: { type: "number", description: "Number of turns exceeding ~250 words" }
              },
              required: ["score", "longest_turn_word_count", "violation_count"]
            },
            talk_listen_ratio: {
              type: "object",
              properties: {
                score: { type: "number", minimum: 0, maximum: 15, description: "Score 0-15" },
                rep_talk_percentage: { type: "number", description: "Percentage of call the rep spoke" }
              },
              required: ["score", "rep_talk_percentage"]
            },
            next_steps: {
              type: "object",
              properties: {
                score: { type: "number", minimum: 0, maximum: 15, description: "Score 0-15" },
                secured: { type: "boolean", description: "Whether specific next steps were secured" },
                details: { type: "string", description: "The specific next step found, or 'None'" }
              },
              required: ["score", "secured", "details"]
            }
          },
          required: ["patience", "monologue", "talk_listen_ratio", "next_steps"]
        }
      },
      required: ["overall_score", "grade", "metrics"]
    }
  }
};

// Simplified Strategy Tool - ONLY strategic threading (no gaps)
const STRATEGY_AUDIT_TOOL = {
  type: "function",
  function: {
    name: "audit_call_strategy",
    description: "Audit the strategic alignment in a sales call - mapping pains to pitches",
    parameters: {
      type: "object",
      properties: {
        strategic_threading: {
          type: "object",
          properties: {
            score: { type: "number", minimum: 0, maximum: 100, description: "Strategic alignment score 0-100" },
            grade: { type: "string", enum: ["Pass", "Fail"], description: "Pass if score >= 60" },
            relevance_map: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  pain_identified: { type: "string", description: "The specific need/pain quoted from the prospect" },
                  pain_type: { type: "string", enum: ["Explicit", "Implicit"], description: "Whether pain was directly stated or inferred from context" },
                  pain_severity: { type: "string", enum: ["High", "Medium", "Low"], description: "Business impact severity of the pain" },
                  feature_pitched: { type: "string", description: "The feature the rep pitched in response" },
                  is_relevant: { type: "boolean", description: "Whether the feature maps to the pain" },
                  reasoning: { type: "string", description: "Why this was a strategic match or mismatch" }
                },
                required: ["pain_identified", "pain_type", "pain_severity", "feature_pitched", "is_relevant", "reasoning"]
              }
            },
            missed_opportunities: {
              type: "array",
              items: { type: "string" },
              description: "Pains mentioned by prospect that were ignored by the rep"
            }
          },
          required: ["score", "grade", "relevance_map", "missed_opportunities"]
        }
      },
      required: ["strategic_threading"]
    }
  }
};

// Tool for The Skeptic - dedicated deal gaps analysis
const DEAL_GAPS_TOOL = {
  type: "function",
  function: {
    name: "identify_deal_gaps",
    description: "Identify critical information gaps blocking a sales deal",
    parameters: {
      type: "object",
      properties: {
        critical_gaps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { 
                type: "string", 
                enum: ["Budget", "Authority", "Need", "Timeline", "Competition", "Technical"],
                description: "The category of information gap"
              },
              description: { type: "string", description: "Specific description of what is missing in this deal" },
              impact: { 
                type: "string", 
                enum: ["High", "Medium", "Low"],
                description: "How dangerous this gap is to the deal"
              },
              suggested_question: { type: "string", description: "The exact question the rep should ask to close this gap" }
            },
            required: ["category", "description", "impact", "suggested_question"]
          },
          description: "3-5 critical pieces of information blocking the deal"
        }
      },
      required: ["critical_gaps"]
    }
  }
};

// Tool for The Negotiator - objection handling analysis
const OBJECTION_HANDLING_TOOL = {
  type: "function",
  function: {
    name: "analyze_objection_handling",
    description: "Analyze how the rep handled objections and pushback during the sales call",
    parameters: {
      type: "object",
      properties: {
        score: { type: "number", minimum: 0, maximum: 100, description: "Overall objection handling score 0-100" },
        grade: { type: "string", enum: ["Pass", "Fail"], description: "Pass if score >= 60" },
        objections_detected: {
          type: "array",
          items: {
            type: "object",
            properties: {
              objection: { type: "string", description: "The prospect's specific objection (e.g., 'Too expensive')" },
              category: { 
                type: "string", 
                enum: ["Price", "Competitor", "Authority", "Need", "Timing", "Feature"],
                description: "Category of the objection"
              },
              rep_response: { type: "string", description: "Summary of how the rep answered" },
              handling_rating: { 
                type: "string", 
                enum: ["Great", "Okay", "Bad"],
                description: "Quality of the rep's response"
              },
              coaching_tip: { type: "string", description: "Specific feedback on this interaction" }
            },
            required: ["objection", "category", "rep_response", "handling_rating", "coaching_tip"]
          },
          description: "List of objections detected and how they were handled"
        }
      },
      required: ["score", "grade", "objections_detected"]
    }
  }
};

// Tool for The Spy - competitive intelligence analysis
const COMPETITIVE_INTEL_TOOL = {
  type: "function",
  function: {
    name: "analyze_competitors",
    description: "Extract competitive intelligence from a sales call transcript, including Status Quo competitors",
    parameters: {
      type: "object",
      properties: {
        competitive_intel: {
          type: "array",
          items: {
            type: "object",
            properties: {
              competitor_name: { type: "string", description: "Name of the competitor, vendor, or 'Status Quo' for internal solutions" },
              usage_status: { 
                type: "string", 
                enum: ["Current Vendor", "Past Vendor", "Evaluating", "Mentioned"],
                description: "Their relationship with this competitor"
              },
              strengths_mentioned: {
                type: "array",
                items: { type: "string" },
                description: "Positive things said about the competitor (e.g., 'great support', 'easy to use')"
              },
              weaknesses_mentioned: {
                type: "array",
                items: { type: "string" },
                description: "Negative things said about the competitor (e.g., 'too expensive', 'poor reporting')"
              },
              threat_level: {
                type: "string",
                enum: ["High", "Medium", "Low"],
                description: "How much of a threat this competitor is to winning this deal"
              },
              churn_risk: {
                type: "string",
                enum: ["High", "Medium", "Low"],
                description: "Likelihood they will switch away from this competitor - High if dissatisfied, Low if sticky"
              },
              silver_bullet_question: {
                type: "string",
                description: "A specific 'Trap Setting' question to de-position this competitor and highlight our advantage"
              }
            },
            required: ["competitor_name", "usage_status", "strengths_mentioned", "weaknesses_mentioned", "threat_level", "churn_risk", "silver_bullet_question"]
          },
          description: "All competitors, vendors, incumbents, or Status Quo mentioned in the call"
        }
      },
      required: ["competitive_intel"]
    }
  }
}

// Tool for The Profiler - psychological profiling of prospect
const PSYCHOLOGY_PROFILE_TOOL = {
  type: "function",
  function: {
    name: "analyze_prospect_psychology",
    description: "Analyze the prospect's communication style and create a behavioral profile",
    parameters: {
      type: "object",
      properties: {
        prospect_persona: { type: "string", description: "Archetype (e.g., 'The Data-Driven Skeptic', 'The Busy Executive')" },
        disc_profile: { 
          type: "string", 
          enum: ["D - Dominance", "I - Influence", "S - Steadiness", "C - Compliance", "Unknown"],
          description: "Estimated DISC profile based on speech patterns. Use 'Unknown' if insufficient evidence."
        },
        communication_style: {
          type: "object",
          properties: {
            tone: { type: "string", description: "e.g., 'Formal', 'Casual', 'Urgent'" },
            preference: { type: "string", description: "e.g., 'Wants bullet points and ROI', 'Wants rapport and stories'" }
          },
          required: ["tone", "preference"]
        },
        dos_and_donts: {
          type: "object",
          properties: {
            do: { 
              type: "array", 
              items: { type: "string" },
              description: "2-3 specific communication tactics to use"
            },
            dont: { 
              type: "array", 
              items: { type: "string" },
              description: "2-3 specific tactics to avoid (e.g., 'Don't use fluff')"
            }
          },
          required: ["do", "dont"]
        }
      },
      required: ["prospect_persona", "disc_profile", "communication_style", "dos_and_donts"]
    }
  }
};

// The Census - structured data extraction only (no summary)
const CENSUS_SYSTEM_PROMPT = `You are 'The Census'. Extract structured data entities only. Do not summarize.

**1. PARTICIPANT MAPPING**
- **Decision Makers:** Look for titles like Director, VP, C-Level, or phrases like "I sign the checks."
- **Sentiment:** Default to 'Neutral'. Only mark 'Skeptical' if they challenge claims. Mark 'Positive' only if they verbally agree/compliment.

**2. DEAL SIZING (CRITICAL)**
- **IT Users:** Look for count of "Team members," "Staff," "Techs," or "Licenses needed."
- **End Users:** Look for "Total employees," "Company size," or "Seat count."
- **Logic:** If they say "a dozen," output 12. If they say "a few hundred," output 300.
- **Source Quote:** You MUST capture the exact sentence used to derive these numbers.

**3. LOGISTICS**
- **Duration:** If metadata is missing, estimate 150 words/min.
- **Video:** Look for cues like "I'm sharing my screen," "Can you see me?", or "Nice background."`;

// The Historian - high-density blitz summary
const HISTORIAN_SYSTEM_PROMPT = `You are 'The Historian'. Write a **high-density "Blitz Summary"** of this sales call.

**CONSTRAINT:**
- Maximum length: 5-6 sentences.
- Format: Single paragraph. No bullet points. No headers.

**NARRATIVE STRUCTURE:**
1. **The Setup:** Who met with whom and why (e.g., "Jalen met with Carl (IT Director) to discuss...").
2. **The Hook/Pain:** What is broken? (e.g., "Carl revealed that their current Pluralsight adoption is low due to...").
3. **The Pitch:** What did we show? (e.g., "Jalen pivoted to show our Micro-learning features...").
4. **The Reception:** How did they react? (e.g., "The prospect reacted positively to the AI features...").
5. **The Close:** What is the hard next step? (e.g., "They agreed to a follow-up demo on Jan 15th.").

**TOPIC EXTRACTION:**
- Extract the top 5 distinct topics (technical or business).
- Be specific - prefer "Phishing Simulation" over just "Security".`;

// The Interrogator - dedicated question analysis agent
const INTERROGATOR_SYSTEM_PROMPT = `You are 'The Interrogator', a linguistic analyst. Your ONLY job is to analyze Question/Answer pairs.

**1. FILTERING (The Noise Gate)**
Scan the transcript for "?" symbols.
- **Discard Logisticals:** "Can you see my screen?", "Is that better?", "Can you hear me?", "Is 2pm okay?"
- **Discard Lazy Tie-Downs:** "Does that make sense?", "You know?", "Right?" (unless used to check understanding of a complex concept).

**2. DETECT QUESTION STACKING**
- Check if a single Rep turn contains **multiple distinct questions** (e.g., "What is your budget? And who signs off?").
- Treat "Stacked Questions" as **Low Leverage** by default (because they confuse the prospect).

**3. LEVERAGE CALCULATION (The Math)**
- Q = Word count of Rep's question.
- A = Word count of Prospect's immediate answer.
- **Yield Ratio** = A / Q.

**4. CLASSIFICATION & EXAMPLES**
- **High Leverage:** Yield Ratio > 2.0. (Short Question -> Long Answer).
  - *Select Top 2 Examples:* Look for "Who/What/How" questions that triggered stories.
- **Low Leverage:** Yield Ratio < 0.5. (Long Question -> Short Answer).
  - *Select Top 2 Examples:* Look for Stacked Questions, Leading Questions ("Don't you think...?"), or Closed Questions ("Do you...?").

**5. SCORING (0-20 pts)**
- Ratio >= 3.0: 20 pts
- Ratio >= 2.0: 15 pts
- Ratio >= 1.0: 10 pts
- Ratio < 0.5: 0 pts

**EDGE CASE:** If 0 sales questions found, return 0 score and "No qualifying sales questions detected."`;
const REFEREE_SYSTEM_PROMPT = `You are 'The Referee', a behavioral data analyst. Analyze the transcript for conversational dynamics.

**NOTE:** Question Quality is handled elsewhere. Focus ONLY on the metrics below.

**1. PATIENCE (0-30 pts)**
- Flag interruptions where a speaker starts before another finishes.
- **CRITICAL EXCEPTION (Back-Channeling):** Do NOT count it as an interruption if the overlap is short (< 4 words) and supportive (e.g., "Right," "Exactly," "Uh-huh," "Makes sense"). Only flag substantial interruptions.
- **Scoring:** Start at 30. Deduct 5 pts per Minor, 10 per Moderate, 15 per Severe.
- Extract each interruption into the 'interruptions' array with: interrupted_speaker, interrupter, context, severity.

**2. MONOLOGUE (0-20 pts)**
- Flag any single turn exceeding ~250 words.
- **CRITICAL EXCEPTION (The Demo Clause):** Do NOT flag a monologue if the Prospect explicitly asked for a demo/explanation immediately prior (e.g., "Can you show me?", "How does that work?").
- **Scoring:** Deduct 5 pts for each *unsolicited* monologue.

**3. TALK RATIO (0-15 pts)**
- 40-50% Rep Talk: 15 pts (Ideal)
- 51-55%: 12 pts
- 56-60%: 9 pts
- 61-70%: 5 pts
- 71%+: 0 pts

**4. NEXT STEPS (0-15 pts)**
- Look for **"The Lock"**: specific Date/Time/Agenda.
- **Auto-Pass Rule:** If you detect phrases like "I sent the invite," "I see it on my calendar," or "Tuesday at 2pm works," award 15 pts immediately.
- Otherwise, score based on specificity:
  - 15 pts: Date + Time + Agenda
  - 10 pts: Date + Time
  - 5 pts: Vague ("Next week")
  - 0 pts: None

**OUTPUT:**
- Calculate overall_score as sum of: patience + monologue + talk_ratio + next_steps (max 80 pts)
- Grade is "Pass" if overall_score >= 48 (60% of 80), otherwise "Fail".
- Note: Final score will include question_leverage (20 pts) added by a separate agent.`;

// The Strategist - ONLY focuses on pain-to-pitch alignment (no gaps)
const AUDITOR_SYSTEM_PROMPT = `You are 'The Strategist', a Senior Sales Auditor. Your job is STRICTLY to map 'Prospect Pains' to 'Rep Pitches' and score the relevance.

**PHASE 1: EXTRACT PAINS (with Classification)**

1. **Explicit Pains:** Direct statements of problems/needs.
   - "We are losing money on manual processes." → Severity: **HIGH** (revenue impact)
   - "Our team wastes 2 hours a day on this." → Severity: **HIGH** (measurable inefficiency)
   - "Compliance audit is coming up." → Severity: **HIGH** (regulatory risk)

2. **Implicit Pains:** Inferred from context/symptoms.
   - "We are growing fast." → Implied Pain: Scalability concerns → Severity: **MEDIUM**
   - "We just hired 50 new people." → Implied Pain: Onboarding/training → Severity: **MEDIUM**
   - "Our current vendor is up for renewal." → Implied Pain: Dissatisfaction → Severity: **MEDIUM**

3. **Surface Pains:** Cosmetic or low-impact preferences.
   - "I don't like the current UI." → Severity: **LOW**
   - "It would be nice to have..." → Severity: **LOW**
   - "Minor annoyance but not a big deal." → Severity: **LOW**

**PHASE 2: EXTRACT PITCHES**
Find every statement where the Rep presents a feature or capability.
- Look for: "Our product does...", "We offer...", "You could use our...", "This feature allows..."

**PHASE 3: BUILD RELEVANCE MAP (with Severity Weighting)**

For each Pain → Pitch connection:
- **Relevant:** Rep pitched a feature that directly addresses the pain.
- **Irrelevant (Spray and Pray):** Rep pitched a feature with NO connection to any stated pain.
- **Misaligned:** Rep addressed a LOW severity pain while ignoring a HIGH severity pain. Mark as MISALIGNED in reasoning.

**PHASE 4: SCORING (0-100) with Severity Weights**
- HIGH severity pain addressed = **Double credit** (2 pts per match)
- MEDIUM severity pain addressed = **Standard credit** (1 pt per match)
- LOW severity pain addressed = **Half credit** (0.5 pts per match)
- **Spray-and-Pray Penalty:** -5 pts for each feature pitched with NO pain connection.
- **Misalignment Penalty:** -10 pts if Rep addressed LOW severity while ignoring HIGH severity pain.

Scoring thresholds:
- 80%+: Pass - Strong strategic alignment
- 60-79%: Pass - Adequate alignment with room for improvement
- <60%: Fail - Too much generic pitching, not enough pain mapping

**PHASE 5: MISSED OPPORTUNITIES**
List HIGH and MEDIUM severity pains the Prospect mentioned that the Rep NEVER addressed.
(Ignore unaddressed LOW severity pains - they're not critical misses.)

**DO NOT:**
- Critique the rep's conversational style.
- Identify "gaps" or "missing information" - that's another agent's job.
- Score anything related to qualification (Budget, Authority, Timeline, etc).

**DO:**
- Focus ONLY on the Pain → Pitch connection.
- Be specific with quotes from the transcript.
- Always classify pain_type (Explicit/Implicit) and pain_severity (High/Medium/Low).`;

// The Skeptic - dedicated agent for finding deal-blocking gaps
const SKEPTIC_SYSTEM_PROMPT = `You are 'The Skeptic', a Senior Deal Desk Analyst. Your ONLY job is to find what is MISSING from this sales call.

**INPUT:** Sales Call Transcript.

**TASK:** Identify the 3-5 most dangerous **Unknowns** that block this deal.

**RULES:**
- **Don't** critique the rep's style.
- **Don't** summarize what happened.
- **Don't** score anything.
- **DO** hunt for missing logic and unanswered questions.

**WHAT TO LOOK FOR:**

1. **Missing Stakeholders:**
   - Prospect mentioned a "Boss", "Manager", or "Team Lead" → Did Rep get their NAME?
   - Prospect said "I'll need to check with..." → Did Rep ask WHO that person is and their role in the decision?

2. **Missing Budget Intel:**
   - Price or cost was discussed → Do we know their ACTUAL budget range?
   - They asked for a quote → Did Rep ask about their procurement/approval process?

3. **Missing Timeline Clarity:**
   - Prospect mentioned a deadline or renewal date → Did Rep ask WHY that date matters?
   - They said "end of quarter" or "next year" → Did Rep clarify the exact date and what happens if they miss it?

4. **Missing Competition Intel:**
   - Prospect is evaluating alternatives → Do we know WHICH vendors and what they like about them?
   - They mentioned a current solution → Did Rep ask what they dislike about it?

5. **Missing Technical Requirements:**
   - Prospect mentioned integrations, SSO, or specific needs → Do we have the SPECIFICS?
   - They asked technical questions → Did Rep confirm their exact environment/setup?

**OUTPUT:**
Return ONLY the critical_gaps array with 3-5 items.
- Category: Budget, Authority, Need, Timeline, Competition, Technical
- Impact: High (deal-blocking), Medium (creates friction), Low (nice to know)
- suggested_question: The EXACT question the rep should ask to close this gap.`;

// The Negotiator - dedicated agent for objection handling analysis
const NEGOTIATOR_SYSTEM_PROMPT = `You are 'The Negotiator', a Sales Objection Coach. Your ONLY job is to find moments of friction and grade the Rep's response.

**1. DETECTION**
- Scan for "Pushback" signals from the Prospect:
  - Price objections: "Too expensive", "Over our budget", "Can you do better on price?"
  - Competitor objections: "We use [Competitor]", "We're also looking at [Vendor]", "How are you different from...?"
  - Authority objections: "I need to ask my boss", "I can't make this decision alone", "Let me check with the team"
  - Need objections: "We don't really need this", "Not sure this is a priority", "We're fine with our current solution"
  - Timing objections: "Not right now", "Maybe next quarter", "We're in a budget freeze"
  - Feature objections: "Does it have...?", "We need X capability", "That's a dealbreaker"

- **If NO objections are found:** Return score 100 (Perfect call with no friction) and empty objections_detected array.

**2. GRADING (The LAER Framework)**
For each objection detected, evaluate if the Rep:
- **L**isten: Did they let the prospect finish and acknowledge they heard?
- **A**cknowledge: Did they validate the concern ("That's a fair point", "I understand")
- **E**xplore: Did they ask clarifying questions to understand the root cause?
- **R**espond: Did they address the concern with relevant value or evidence?

**RATING CRITERIA:**
- **Great:** Rep demonstrated 3-4 of LAER elements. Validated the concern AND pivoted to value. Made the prospect feel heard.
- **Okay:** Rep demonstrated 1-2 of LAER elements. Addressed the concern but missed opportunities to explore or validate.
- **Bad:** Rep argued, interrupted, ignored the objection, or gave a defensive/dismissive response.

**3. SCORING**
- Start at 100
- For each objection with "Bad" handling: -20 points
- For each objection with "Okay" handling: -10 points
- For each objection with "Great" handling: -0 points
- Minimum score: 0

**4. COACHING TIPS**
For each objection, provide ONE specific, actionable tip:
- What exactly should the rep have said differently?
- What question should they have asked?
- How could they have reframed the objection?

**OUTPUT:**
Return the score, grade (Pass if >= 60), and the objections_detected array.`;

// The Spy - competitive intelligence system prompt
const SPY_SYSTEM_PROMPT = `You are 'The Spy'. Build a Battlecard for this specific deal by detecting ALL competitive threats.

**1. DETECTION TARGETS:**

**External Vendors:**
- Explicit: "We use KnowBe4", "Looking at Udemy", "Our Pluralsight license"
- Implied: "Our current solution", "What we have now", "We're evaluating options"

**Internal/Status Quo (CRITICAL):**
Treat these as a competitor named **"Status Quo"**:
- "We build it in-house"
- "We use Excel/SharePoint/Google Docs for this"
- "We'll just stick with what we have"
- "Our team handles this manually"
- "We're not looking to change right now"

**2. SENTIMENT & MOVEMENT (Churn Risk):**

**Low Churn Risk (Sticky):**
- "We are happy with them"
- "Just renewed our contract"
- "It's deeply integrated"
- "The team loves it"

**High Churn Risk (Wobbly):**
- "It's expensive"
- "Support is terrible"
- "Renewal is coming up in X months"
- "We've had issues with..."
- "Looking for alternatives"

**Medium Churn Risk:** Mixed signals or neutral sentiment.

**3. THREAT LEVEL:**
- **High:** Current Vendor they're satisfied with, OR strong Status Quo inertia
- **Medium:** Evaluating competitor, OR Status Quo with some pain
- **Low:** Past vendor, mentioned in passing, OR dissatisfied Status Quo

**4. BATTLECARD OUTPUT:**

For each competitor, generate:
- **Strengths:** What they like about it (even if implied)
- **Weaknesses:** What they dislike or complain about
- **Silver Bullet Question:** ONE specific "Trap Setting Question" to de-position this competitor by highlighting its weakness:
  - For a vendor: "Ask: 'How do you handle [their known weakness]?'"
  - For Status Quo: "Ask: 'How much time does your team spend on [manual process]?'"
  - For Excel: "Ask: 'What happens when [scale problem] occurs?'"

**OUTPUT RULES:**
- Always include "Status Quo" if they express ANY resistance to change
- Empty array ONLY if no competitors AND no Status Quo signals
- Silver bullet must be SPECIFIC to their mentioned weakness, not generic`;

// Output from The Census
export interface CallCensus {
  logistics: {
    platform?: string;
    duration_minutes: number;
    video_on: boolean;
  };
  participants: Array<{
    name: string;
    role: string;
    is_decision_maker: boolean;
    sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Skeptical';
  }>;
  user_counts: {
    it_users: number | null;
    end_users: number | null;
    source_quote: string | null;
  };
}

// Output from The Historian
export interface CallHistory {
  summary: string;
  key_topics: string[];
}

// Merged output for backward compatibility
export interface CallMetadata {
  summary: string;
  topics: string[];
  logistics: {
    platform?: string;
    duration_minutes: number;
    video_on: boolean;
  };
  participants: Array<{
    name: string;
    role: string;
    is_decision_maker: boolean;
    sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Skeptical';
  }>;
  user_counts: {
    it_users: number | null;
    end_users: number | null;
    source_quote: string | null;
  };
}

// Base BehaviorScore from The Referee (without question_quality - added separately)
export interface BehaviorScore {
  overall_score: number;
  grade: 'Pass' | 'Fail';
  metrics: {
    patience: {
      score: number;
      interruption_count: number;
      status: 'Excellent' | 'Good' | 'Fair' | 'Poor';
      interruptions?: Array<{
        interrupted_speaker: string;
        interrupter: string;
        context: string;
        severity: 'Minor' | 'Moderate' | 'Severe';
      }>;
    };
    monologue: {
      score: number;
      longest_turn_word_count: number;
      violation_count: number;
    };
    talk_listen_ratio: {
      score: number;
      rep_talk_percentage: number;
    };
    next_steps: {
      score: number;
      secured: boolean;
      details: string;
    };
  };
}

// Merged interface that includes question_quality from The Interrogator
export interface MergedBehaviorScore extends Omit<BehaviorScore, 'metrics'> {
  metrics: BehaviorScore['metrics'] & {
    question_quality: QuestionLeverage;
  };
}

export interface QuestionLeverage {
  score: number;
  explanation: string;
  average_question_length: number;
  average_answer_length: number;
  high_leverage_count: number;
  low_leverage_count: number;
  high_leverage_examples: string[];
  low_leverage_examples: string[];
  total_sales_questions: number;
  yield_ratio: number;
}

// Strategic threading only (from The Strategist)
export interface StrategicThreading {
  strategic_threading: {
    score: number;
    grade: 'Pass' | 'Fail';
    relevance_map: Array<{
      pain_identified: string;
      feature_pitched: string;
      is_relevant: boolean;
      reasoning: string;
    }>;
    missed_opportunities: string[];
  };
}

// Critical gaps only (from The Skeptic)
export interface DealGaps {
  critical_gaps: Array<{
    category: 'Budget' | 'Authority' | 'Need' | 'Timeline' | 'Competition' | 'Technical';
    description: string;
    impact: 'High' | 'Medium' | 'Low';
    suggested_question: string;
  }>;
}

// Objection handling data (flat structure returned by The Negotiator)
export interface ObjectionHandlingData {
  score: number;
  grade: 'Pass' | 'Fail';
  objections_detected: Array<{
    objection: string;
    category: 'Price' | 'Competitor' | 'Authority' | 'Need' | 'Timing' | 'Feature';
    rep_response: string;
    handling_rating: 'Great' | 'Okay' | 'Bad';
    coaching_tip: string;
  }>;
}

// Objection handling wrapped (for StrategyAudit compatibility)
export interface ObjectionHandling {
  objection_handling: ObjectionHandlingData;
}

// Psychology profile (from The Profiler)
export interface PsychologyProfile {
  prospect_persona: string;
  disc_profile: 'D - Dominance' | 'I - Influence' | 'S - Steadiness' | 'C - Compliance' | 'Unknown';
  communication_style: {
    tone: string;
    preference: string;
  };
  dos_and_donts: {
    do: string[];
    dont: string[];
  };
}

// Competitive intel (from The Spy)
export interface CompetitiveIntel {
  competitive_intel: Array<{
    competitor_name: string;
    usage_status: 'Current Vendor' | 'Past Vendor' | 'Evaluating' | 'Mentioned';
    strengths_mentioned: string[];
    weaknesses_mentioned: string[];
    threat_level: 'High' | 'Medium' | 'Low';
    churn_risk: 'High' | 'Medium' | 'Low';
    silver_bullet_question: string;
  }>;
}

// Combined interface for backward compatibility
export interface StrategyAudit extends StrategicThreading, DealGaps, ObjectionHandling, CompetitiveIntel {}

interface CallLovableAIOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  validationSchema?: { safeParse: (data: unknown) => { success: boolean; error?: { message: string } } };
}

async function callLovableAI(
  systemPrompt: string,
  userPrompt: string,
  tool: object,
  toolName: string,
  options: CallLovableAIOptions = {}
): Promise<any> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }

  const {
    model = 'google/gemini-2.5-flash',
    temperature,
    maxTokens = 4096,
    validationSchema,
  } = options;

  const requestBody: any = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    tools: [tool],
    tool_choice: { type: 'function', function: { name: toolName } },
    max_tokens: maxTokens,
  };

  // Only add temperature if specified (some models don't support it)
  if (temperature !== undefined) {
    requestBody.temperature = temperature;
  }

  // Create AbortController with timeout protection
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, AI_GATEWAY_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(LOVABLE_AI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (fetchError) {
    clearTimeout(timeoutId);
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      throw new Error(`AI Gateway timeout after ${AI_GATEWAY_TIMEOUT_MS / 1000}s`);
    }
    throw fetchError;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[analysis-agents] AI Gateway error ${response.status}:`, errorText);
    
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (response.status === 402) {
      throw new Error('AI credits exhausted. Please add funds to continue.');
    }
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const data = await response.json();
  
  // Extract tool call arguments
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.function.name !== toolName) {
    console.error('[analysis-agents] Unexpected response structure:', JSON.stringify(data));
    throw new Error('Invalid AI response structure');
  }

  let parsedResult: any;
  try {
    parsedResult = JSON.parse(toolCall.function.arguments);
  } catch (e) {
    console.error('[analysis-agents] Failed to parse tool arguments:', toolCall.function.arguments);
    throw new Error('Failed to parse AI response');
  }

  // Run schema validation if provided
  if (validationSchema) {
    const validationResult = validationSchema.safeParse(parsedResult);
    if (!validationResult.success) {
      console.error(`[analysis-agents] AI Schema Mismatch for ${toolName}:`, validationResult.error?.message);
      console.error('[analysis-agents] Invalid data received:', JSON.stringify(parsedResult).substring(0, 500));
      throw new Error(`AI Schema Mismatch: ${validationResult.error?.message || 'Unknown validation error'}`);
    }
  }

  return parsedResult;
}

/**
 * Agent 1a: The Census - Extract structured data entities only
 */
export async function analyzeCallCensus(transcript: string): Promise<CallCensus> {
  console.log('[analyzeCallCensus] Starting structured data extraction...');
  
  const userPrompt = `Extract structured data entities from this sales call transcript:\n\n${transcript}`;
  
  const result = await callLovableAI(
    CENSUS_SYSTEM_PROMPT,
    userPrompt,
    CALL_CENSUS_TOOL,
    'extract_call_census',
    { validationSchema: CallCensusValidation }
  );
  
  console.log('[analyzeCallCensus] Extraction complete');
  return result as CallCensus;
}

/**
 * Agent 1b: The Historian - Write executive summary and extract topics
 */
export async function analyzeCallHistory(transcript: string): Promise<CallHistory> {
  console.log('[analyzeCallHistory] Starting summary generation...');
  
  const userPrompt = `Write a high-quality executive summary of this sales call:\n\n${transcript}`;
  
  const result = await callLovableAI(
    HISTORIAN_SYSTEM_PROMPT,
    userPrompt,
    CALL_HISTORY_TOOL,
    'write_call_history',
    { 
      temperature: 0.4, // Better writing flow for summaries
      validationSchema: CallHistoryValidation 
    }
  );
  
  console.log('[analyzeCallHistory] Summary generation complete');
  return result as CallHistory;
}

/**
 * Merge Census and History outputs into CallMetadata for backward compatibility
 */
export function mergeCallMetadata(census: CallCensus, history: CallHistory): CallMetadata {
  return {
    summary: history.summary,
    topics: history.key_topics,
    logistics: census.logistics,
    participants: census.participants,
    user_counts: census.user_counts,
  };
}

/**
 * Agent 2: The Referee - Score behavioral dynamics
 */
export async function analyzeCallBehavior(transcript: string): Promise<BehaviorScore> {
  console.log('[analyzeCallBehavior] Starting behavioral analysis...');
  
  const userPrompt = `Analyze this sales call transcript for behavioral dynamics and score the rep's performance:\n\n${transcript}`;
  
  const result = await callLovableAI(
    REFEREE_SYSTEM_PROMPT,
    userPrompt,
    BEHAVIOR_SCORE_TOOL,
    'score_call_behavior',
    { validationSchema: BehaviorScoreValidation }
  );
  
  console.log('[analyzeCallBehavior] Analysis complete, score:', result.overall_score);
  return result as BehaviorScore;
}

/**
 * Agent 4: The Strategist - Analyze strategic alignment (pain-to-pitch mapping ONLY)
 * Uses gemini-2.5-flash for efficient relevance mapping
 */
export async function analyzeCallStrategy(transcript: string): Promise<StrategicThreading> {
  console.log('[analyzeCallStrategy] Starting strategic threading analysis...');
  
  const userPrompt = `Analyze this sales call transcript for strategic alignment. Map every prospect pain to every rep pitch and score the relevance:\n\n${transcript}`;
  
  const result = await callLovableAI(
    AUDITOR_SYSTEM_PROMPT,
    userPrompt,
    STRATEGY_AUDIT_TOOL,
    'audit_call_strategy',
    {
      model: 'google/gemini-2.5-flash',
      temperature: 0.2,
      maxTokens: 4096,
      validationSchema: StrategicThreadingValidation,
    }
  );
  
  console.log('[analyzeCallStrategy] Threading complete, score:', result.strategic_threading?.score);
  return result as StrategicThreading;
}

/**
 * Agent 5: The Skeptic - Identify critical deal gaps and missing information
 * Uses gemini-2.5-pro for complex reasoning with low temperature for strict logic
 */
export async function analyzeDealGaps(transcript: string): Promise<DealGaps> {
  console.log('[analyzeDealGaps] Starting deal gaps analysis with Pro model...');
  
  const userPrompt = `Analyze this sales call transcript. Find the 3-5 most dangerous UNKNOWNS or MISSING INFORMATION that could block this deal:\n\n${transcript}`;
  
  const result = await callLovableAI(
    SKEPTIC_SYSTEM_PROMPT,
    userPrompt,
    DEAL_GAPS_TOOL,
    'identify_deal_gaps',
    {
      model: 'google/gemini-2.5-pro',
      temperature: 0.1,
      maxTokens: 4096,
      validationSchema: DealGapsValidation,
    }
  );
  
  console.log('[analyzeDealGaps] Analysis complete, found', result.critical_gaps?.length || 0, 'gaps');
  return result as DealGaps;
}

/**
 * Agent 3: The Interrogator - Analyze question leverage and effectiveness
 * Uses gemini-2.5-flash with low temperature for precise linguistic analysis
 */
export async function analyzeQuestionLeverage(transcript: string): Promise<QuestionLeverage> {
  console.log('[analyzeQuestionLeverage] Starting question leverage analysis...');
  
  const userPrompt = `Analyze this sales call transcript for Question/Answer dynamics. Identify the Rep's questions, filter out logistical questions, and calculate the leverage (Yield Ratio) of each valid sales question:\n\n${transcript}`;
  
  const result = await callLovableAI(
    INTERROGATOR_SYSTEM_PROMPT,
    userPrompt,
    QUESTION_LEVERAGE_TOOL,
    'analyze_question_leverage',
    {
      temperature: 0.2,
      validationSchema: QuestionLeverageValidation,
    }
  );
  
  console.log('[analyzeQuestionLeverage] Analysis complete, score:', result.score, ', yield_ratio:', result.yield_ratio);
  return result as QuestionLeverage;
}

/**
 * Agent 6: The Negotiator - Analyze objection handling
 * Uses gemini-2.5-pro for reasoning-heavy judgment of response quality
 * Returns FLAT ObjectionHandlingData - wrapping happens in analyze-call/index.ts
 */
export async function analyzeObjections(transcript: string): Promise<ObjectionHandlingData> {
  console.log('[analyzeObjections] Starting objection handling analysis with Pro model...');
  
  const userPrompt = `Analyze this sales call transcript for objections and pushback. Identify how the rep handled each moment of friction:\n\n${transcript}`;
  
  const result = await callLovableAI(
    NEGOTIATOR_SYSTEM_PROMPT,
    userPrompt,
    OBJECTION_HANDLING_TOOL,
    'analyze_objection_handling',
    {
      model: 'google/gemini-2.5-pro',
      temperature: 0.1,
      maxTokens: 4096,
      validationSchema: ObjectionHandlingValidation,
    }
  );
  
  console.log('[analyzeObjections] Analysis complete, score:', result.score, ', objections found:', result.objections_detected?.length || 0);
  return result as ObjectionHandlingData;
}

// The Profiler system prompt
const PROFILER_SYSTEM_PROMPT = `You are 'The Profiler', a Behavioral Psychologist. Your job is to analyze the PROSPECT'S speech patterns to create a Buying Persona.

**1. ANALYZE SPEECH CUES**
- **Short, curt answers?** -> Likely "High D" (Dominance). Wants brevity.
- **Chatty, enthusiastic, uses emojis/slang?** -> Likely "High I" (Influence). Wants energy.
- **Slow, hesitant, asks about process?** -> Likely "High S" (Steadiness). Wants safety.
- **Detailed questions, focuses on accuracy/data?** -> Likely "High C" (Compliance). Wants proof.

**2. PERSONA ARCHETYPES**
Create a memorable archetype name that captures their essence:
- "The Data-Driven Skeptic" (High C who needs evidence)
- "The Busy Executive" (High D who values time)
- "The Relationship Builder" (High I who wants connection)
- "The Risk-Averse Evaluator" (High S who fears change)

**3. OUTPUT**
- Determine the DISC profile based on language patterns.
- Prescribe strict "Dos and Donts" for the sales rep's next email/call.
- Be specific and actionable - not generic advice.`;

/**
 * Agent 7: The Profiler - Analyze prospect psychology and communication style
 * Uses gemini-2.5-flash for fast sentiment/tone analysis
 */
export async function analyzePsychology(transcript: string): Promise<PsychologyProfile> {
  console.log('[analyzePsychology] Starting psychological profiling...');
  
  const userPrompt = `Analyze this sales call transcript to profile the PROSPECT's communication style and create a behavioral persona. Focus on how THEY speak, respond, and what they seem to value:\n\n${transcript}`;
  
  const result = await callLovableAI(
    PROFILER_SYSTEM_PROMPT,
    userPrompt,
    PSYCHOLOGY_PROFILE_TOOL,
    'analyze_prospect_psychology',
    {
      model: 'google/gemini-2.5-flash',
      temperature: 0.3,
      maxTokens: 2048,
      validationSchema: PsychologyProfileValidation,
    }
  );
  
  console.log('[analyzePsychology] Profiling complete, persona:', result.prospect_persona, ', DISC:', result.disc_profile);
  return result as PsychologyProfile;
}

/**
 * Agent 8: The Spy - Analyze competitive intelligence
 * Uses gemini-2.5-pro for reasoning-heavy detection of implied strengths/weaknesses
 */
export async function analyzeCompetitors(transcript: string): Promise<CompetitiveIntel> {
  console.log('[analyzeCompetitors] Starting competitive intelligence analysis with Pro model...');
  
  const userPrompt = `Analyze this sales call transcript for competitive intelligence. Find ALL mentions of other vendors, tools, or incumbents and build a battlecard:\n\n${transcript}`;
  
  const result = await callLovableAI(
    SPY_SYSTEM_PROMPT,
    userPrompt,
    COMPETITIVE_INTEL_TOOL,
    'analyze_competitors',
    {
      model: 'google/gemini-2.5-pro',
      temperature: 0.2,
      maxTokens: 4096,
      validationSchema: CompetitiveIntelValidation,
    }
  );
  
  console.log('[analyzeCompetitors] Analysis complete, found', result.competitive_intel?.length || 0, 'competitors');
  return result as CompetitiveIntel;
}

// ============= AGENT 9: THE COACH =============

// Type definitions for coaching synthesis
export interface CoachingSynthesis {
  overall_grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  executive_summary: string;
  top_3_strengths: string[];
  top_3_areas_for_improvement: string[];
  primary_focus_area: 'Discovery Depth' | 'Behavioral Polish' | 'Closing/Next Steps' | 'Objection Handling' | 'Strategic Alignment';
  coaching_prescription: string;
  grade_reasoning: string;
}

// Input type for The Coach - aggregated outputs from all agents
export interface CoachingInputs {
  metadata: CallMetadata | null;
  behavior: BehaviorScore | null;
  questions: QuestionLeverage | null;
  strategy: StrategicThreading | null;
  gaps: DealGaps | null;
  objections: ObjectionHandling | null;
  psychology: PsychologyProfile | null;
  competitors: CompetitiveIntel | null;
}

const CoachingSynthesisValidation = z.object({
  overall_grade: z.enum(['A+', 'A', 'B', 'C', 'D', 'F']),
  executive_summary: z.string(),
  top_3_strengths: z.array(z.string()),
  top_3_areas_for_improvement: z.array(z.string()),
  primary_focus_area: z.enum(['Discovery Depth', 'Behavioral Polish', 'Closing/Next Steps', 'Objection Handling', 'Strategic Alignment']),
  coaching_prescription: z.string(),
  grade_reasoning: z.string(),
});

const COACHING_SYNTHESIS_TOOL = {
  type: "function",
  function: {
    name: "synthesize_coaching",
    description: "Synthesize all analysis into a prioritized coaching plan",
    parameters: {
      type: "object",
      properties: {
        overall_grade: { 
          type: "string", 
          enum: ["A+", "A", "B", "C", "D", "F"],
          description: "Letter grade for overall call performance"
        },
        executive_summary: { 
          type: "string", 
          description: "A 2-sentence Manager's summary of the rep's performance"
        },
        top_3_strengths: { 
          type: "array", 
          items: { type: "string" },
          description: "The 3 things the rep did best on this call"
        },
        top_3_areas_for_improvement: { 
          type: "array", 
          items: { type: "string" },
          description: "The 3 things the rep needs to work on most"
        },
        primary_focus_area: { 
          type: "string", 
          enum: ["Discovery Depth", "Behavioral Polish", "Closing/Next Steps", "Objection Handling", "Strategic Alignment"],
          description: "The ONE category that needs the most work"
        },
        coaching_prescription: { 
          type: "string", 
          description: "Specific actionable advice to fix the primary focus area"
        },
        grade_reasoning: { 
          type: "string", 
          description: "The why behind the grade - what drove this assessment"
        }
      },
      required: ["overall_grade", "executive_summary", "top_3_strengths", "top_3_areas_for_improvement", "primary_focus_area", "coaching_prescription", "grade_reasoning"]
    }
  }
};

const COACH_SYSTEM_PROMPT = `You are 'The Coach', a VP of Sales. You have received detailed reports from 9 specialized analysts about a specific call.

**YOUR GOAL:**
Cut through the noise. Don't just repeat the data points. Identify the **Root Cause** of success or failure.

**LOGIC TREE (Priority Order):**
1. **Check Strategy First:** Did they pitch the wrong thing? (Relevance Map shows misalignment). Did they miss Budget or Authority? (Critical Gaps). If Strategy is 'Fail', nothing else matters. The primary focus is "Strategic Alignment."
2. **Check Discovery Second:** If Strategy is fine, were questions superficial? (Low yield ratio < 1.5, few high-leverage questions). Focus on "Discovery Depth."
3. **Check Objections Third:** If Discovery was good, did they fumble objections? (Objection handling score < 60 or multiple "Bad" ratings). Focus on "Objection Handling."
4. **Check Mechanics Fourth:** If all above are good, but they interrupted 5+ times or monologued excessively? Focus on "Behavioral Polish."
5. **Check Closing Last:** If everything else was solid but no next steps secured? Focus on "Closing/Next Steps."

**GRADING RUBRIC:**
- A+ (95-100): Exceptional - textbook call, would use for training
- A (85-94): Excellent - minor polish points only
- B (70-84): Good - solid fundamentals, 1-2 clear improvement areas
- C (55-69): Average - multiple gaps, needs coaching
- D (40-54): Below expectations - significant issues
- F (<40): Poor - fundamental problems, needs immediate intervention

**OUTPUT RULES:**
- Strengths and improvements must be SPECIFIC (not "good discovery" but "asked 3 questions that uncovered the security budget")
- Coaching prescription must be ACTIONABLE (not "improve objection handling" but "When they said price was too high, you deflected. Next time, use 'Compared to what?' to anchor value.")
- Executive summary is for a busy manager - 2 sentences max, get to the point`;

/**
 * Agent 9: The Coach - Synthesize all insights into prioritized coaching plan
 * Uses gemini-2.5-pro for high-level reasoning and synthesis
 * MUST run AFTER all other agents complete (sequential, not parallel)
 */
export async function synthesizeCoaching(inputs: CoachingInputs): Promise<CoachingSynthesis> {
  console.log('[synthesizeCoaching] Starting coaching synthesis with Pro model...');
  
  // Format all agent outputs into a structured report for The Coach
  const analysisReport = `
## AGENT REPORTS FOR THIS CALL

### 1. CALL METADATA (The Census & Historian)
${inputs.metadata ? `
- Summary: ${inputs.metadata.summary}
- Key Topics: ${inputs.metadata.topics?.join(', ') || 'None identified'}
- Participants: ${inputs.metadata.participants?.map(p => `${p.name} (${p.role}, ${p.sentiment}${p.is_decision_maker ? ', Decision Maker' : ''})`).join('; ') || 'Unknown'}
- Duration: ${inputs.metadata.logistics?.duration_minutes || 'Unknown'} minutes
` : 'No metadata available.'}

### 2. BEHAVIORAL SCORE (The Referee)
${inputs.behavior ? `
- Overall Score: ${inputs.behavior.overall_score}/100 (${inputs.behavior.grade})
- Patience: ${inputs.behavior.metrics.patience.score}/30 (${inputs.behavior.metrics.patience.interruption_count} interruptions, ${inputs.behavior.metrics.patience.status})
- Monologue: ${inputs.behavior.metrics.monologue.score}/20 (${inputs.behavior.metrics.monologue.violation_count} violations, longest turn ${inputs.behavior.metrics.monologue.longest_turn_word_count} words)
- Talk/Listen Ratio: ${inputs.behavior.metrics.talk_listen_ratio.score}/15 (Rep talked ${inputs.behavior.metrics.talk_listen_ratio.rep_talk_percentage}%)
- Next Steps: ${inputs.behavior.metrics.next_steps.score}/15 (${inputs.behavior.metrics.next_steps.secured ? 'SECURED' : 'NOT SECURED'}: ${inputs.behavior.metrics.next_steps.details})
` : 'No behavioral data available.'}

### 3. QUESTION LEVERAGE (The Interrogator)
${inputs.questions ? `
- Score: ${inputs.questions.score}/20
- Yield Ratio: ${inputs.questions.yield_ratio}x (Avg Question: ${inputs.questions.average_question_length} words, Avg Answer: ${inputs.questions.average_answer_length} words)
- High Leverage Questions: ${inputs.questions.high_leverage_count} | Low Leverage: ${inputs.questions.low_leverage_count}
- Best Questions: ${inputs.questions.high_leverage_examples?.slice(0, 2).map(q => `"${q}"`).join(', ') || 'None'}
- Worst Questions: ${inputs.questions.low_leverage_examples?.slice(0, 2).map(q => `"${q}"`).join(', ') || 'None'}
` : 'No question analysis available.'}

### 4. STRATEGIC THREADING (The Strategist)
${inputs.strategy ? `
- Score: ${inputs.strategy.strategic_threading.score}/100 (${inputs.strategy.strategic_threading.grade})
- Relevance Map:
${inputs.strategy.strategic_threading.relevance_map?.map(r => `  - Pain: "${r.pain_identified}" → Feature: "${r.feature_pitched}" | ${r.is_relevant ? '✓ RELEVANT' : '✗ MISMATCH'}: ${r.reasoning}`).join('\n') || '  No mappings found.'}
- Missed Opportunities: ${inputs.strategy.strategic_threading.missed_opportunities?.join(', ') || 'None'}
` : 'No strategy data available.'}

### 5. CRITICAL GAPS (The Skeptic)
${inputs.gaps && inputs.gaps.critical_gaps?.length > 0 ? `
${inputs.gaps.critical_gaps.map(g => `- [${g.impact}] ${g.category}: ${g.description} → Ask: "${g.suggested_question}"`).join('\n')}
` : 'No critical gaps identified.'}

### 6. OBJECTION HANDLING (The Negotiator)
${inputs.objections?.objection_handling ? `
- Score: ${inputs.objections.objection_handling.score}/100 (${inputs.objections.objection_handling.grade})
${inputs.objections.objection_handling.objections_detected?.length > 0 ? inputs.objections.objection_handling.objections_detected.map((o: { handling_rating: string; objection: string; category: string; rep_response: string; coaching_tip: string }) => `- [${o.handling_rating}] "${o.objection}" (${o.category}): ${o.rep_response} | Tip: ${o.coaching_tip}`).join('\n') : '- No objections detected in this call.'}
` : 'No objection data available.'}

### 7. PROSPECT PSYCHOLOGY (The Profiler)
${inputs.psychology ? `
- Persona: ${inputs.psychology.prospect_persona}
- DISC Profile: ${inputs.psychology.disc_profile}
- Communication Style: ${inputs.psychology.communication_style.tone}, ${inputs.psychology.communication_style.preference}
- Do: ${inputs.psychology.dos_and_donts.do?.join(', ') || 'N/A'}
- Don't: ${inputs.psychology.dos_and_donts.dont?.join(', ') || 'N/A'}
` : 'No psychology profile available.'}

### 8. COMPETITIVE INTEL (The Spy)
${inputs.competitors && inputs.competitors.competitive_intel?.length > 0 ? `
${inputs.competitors.competitive_intel.map(c => `- ${c.competitor_name} (${c.usage_status}, Threat: ${c.threat_level}): Strengths: ${c.strengths_mentioned?.join(', ') || 'None'}; Weaknesses: ${c.weaknesses_mentioned?.join(', ') || 'None'}`).join('\n')}
` : 'No competitors mentioned.'}
`;

  const userPrompt = `Based on the following analysis reports from 9 specialized agents, synthesize a coaching plan for the sales rep:\n\n${analysisReport}`;
  
  const result = await callLovableAI(
    COACH_SYSTEM_PROMPT,
    userPrompt,
    COACHING_SYNTHESIS_TOOL,
    'synthesize_coaching',
    {
      model: 'google/gemini-2.5-pro',
      temperature: 0.3,
      maxTokens: 4096,
      validationSchema: CoachingSynthesisValidation,
    }
  );
  
  console.log('[synthesizeCoaching] Synthesis complete, grade:', result.overall_grade, ', focus:', result.primary_focus_area);
  return result as CoachingSynthesis;
}
