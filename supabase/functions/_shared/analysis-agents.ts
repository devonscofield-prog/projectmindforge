/**
 * Analysis Agents for Call Analysis 2.0
 * 
 * Agent 1: The Clerk - Metadata & Facts extraction
 * Agent 2: The Referee - Behavioral scoring
 * Agent 3: The Auditor - Strategy & pain-to-pitch alignment
 * Agent 4: The Interrogator - Question leverage analysis
 * Agent 5: The Skeptic - Deal gaps analysis
 * Agent 6: The Negotiator - Objection handling analysis
 * Agent 7: The Profiler - Prospect psychology profiling
 */

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Timeout for AI Gateway calls (55s to leave buffer before 60s edge function timeout)
const AI_GATEWAY_TIMEOUT_MS = 55000;

// Tool schemas for structured output extraction
const CALL_METADATA_TOOL = {
  type: "function",
  function: {
    name: "extract_call_metadata",
    description: "Extract metadata, participants, topics, and user counts from a sales call transcript",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "A concise 2-3 sentence executive summary of the call" },
        topics: { 
          type: "array", 
          items: { type: "string" },
          description: "List of high-level topics discussed (e.g., 'Pricing', 'SSO', 'Phishing')"
        },
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
      required: ["summary", "topics", "logistics", "participants", "user_counts"]
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
                  feature_pitched: { type: "string", description: "The feature the rep pitched in response" },
                  is_relevant: { type: "boolean", description: "Whether the feature maps to the pain" },
                  reasoning: { type: "string", description: "Why this was a strategic match or mismatch" }
                },
                required: ["pain_identified", "feature_pitched", "is_relevant", "reasoning"]
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
          enum: ["D - Dominance", "I - Influence", "S - Steadiness", "C - Compliance"],
          description: "Estimated DISC profile based on speech patterns"
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

const CLERK_SYSTEM_PROMPT = `You are 'The Clerk', a strictly factual executive assistant. Your job is to extract participants, logistics, and data from a sales call transcript.

Rules:
- Do not infer sentiment unless explicitly stated or clearly demonstrated through language.
- Extract exact quotes for 'user_counts' if found.
- Identify 'decision_makers' based on job titles or authority demonstrated.
- Summary should be factual, not coaching-oriented.
- If duration is not mentioned, estimate based on transcript length (~150 words per minute).
- If video status is unclear, default to false.
- For participants, include all named individuals with their roles.`;

// The Interrogator - dedicated question analysis agent
const INTERROGATOR_SYSTEM_PROMPT = `You are 'The Interrogator', a linguistic analyst. Your ONLY job is to analyze Question/Answer pairs.

**1. EXTRACTION & FILTERING**
- Scan the transcript for every "?" symbol spoken by the Rep.
- **DISCARD** any question that is purely logistical:
  - "Can you see my screen?"
  - "Is that better?"
  - "Can you hear me?"
  - "Does that make sense?"
  - "Any questions so far?"
  - "Is 2pm okay?"
- **DISCARD** rhetorical questions where the Rep keeps talking immediately without waiting for an answer.

**2. LEVERAGE CALCULATION**
- For each valid Sales Question, measure:
  - Q = word count of the Rep's question
  - A = word count of the Prospect's immediate answer (before someone else speaks)
- **Yield Ratio** = A / Q

**3. CLASSIFICATION**
- **High Leverage:** Answer word count > Question word count (Rep engaged them effectively)
- **Low Leverage:** Question word count > Answer word count (Rep lectured or got minimal response)

**4. EXAMPLE SELECTION (CRITICAL)**
- **High Leverage Examples:** Find the 2 questions with the HIGHEST Yield Ratio (Short Question → Long Answer). Return the EXACT quote of the Rep's question.
- **Low Leverage Examples:** Find the 2 questions with the LOWEST Yield Ratio (Long Question → One-word Answer). Return the EXACT quote of the Rep's question.

**5. SCORING (0-20 pts)**
Based on calculated Yield Ratio:
- Ratio >= 3.0: 20 pts (excellent - prospect talking 3x as much)
- Ratio >= 2.5: 17 pts
- Ratio >= 2.0: 14 pts (solid - prospect talking 2x as much)
- Ratio >= 1.5: 11 pts
- Ratio >= 1.0: 8 pts (baseline - equal talking)
- Ratio >= 0.5: 5 pts
- Ratio < 0.5: 2 pts (poor - rep questions longer than answers)

**EDGE CASE: NO SALES QUESTIONS**
If NO sales questions remain after filtering (only logistical questions found):
- Return score: 0
- Return average_question_length: 0
- Return average_answer_length: 0
- Return high_leverage_count: 0
- Return low_leverage_count: 0
- Return high_leverage_examples: []
- Return low_leverage_examples: []
- Return total_sales_questions: 0
- Return yield_ratio: 0
- Return explanation: "No qualifying sales questions detected."`;

const REFEREE_SYSTEM_PROMPT = `You are 'The Referee', a behavioral data analyst. Analyze the transcript for conversational dynamics.

**NOTE:** Question Quality analysis is handled by a separate agent. Focus ONLY on the metrics below.

Rules:
- **Patience (0-30 pts):** Flag interruptions where a speaker starts before another finishes.
  - Deduct 5 points per Minor interruption, 10 per Moderate, 15 per Severe
  - IMPORTANT: Extract each interruption into the 'interruptions' array with:
    - interrupted_speaker: who was cut off
    - interrupter: who interrupted  
    - context: brief description of what was happening when interruption occurred
    - severity: Minor (brief overlap), Moderate (cut off mid-thought), Severe (aggressive/repeated pattern)

- **Monologue (0-20 pts):** Flag any single turn exceeding ~250 words. Deduct points for each violation.

- **Talk Ratio (0-15 pts):** Score STRICTLY based on rep talk percentage:
  - 40-50%: 15 pts (ideal balance - prospect is talking more)
  - 51-55%: 12 pts
  - 56-60%: 9 pts
  - 61-65%: 6 pts
  - 66-70%: 3 pts
  - 71%+: 0 pts (talking way too much to be effective)
  - <40%: Deduct proportionally (rep may not be engaging enough)

- **Next Steps Commitment (0-15 pts):** Award points based on the specificity of the next step secured:
  - 15 pts: Specific DATE + TIME + AGENDA (e.g., "Let's meet Tuesday at 2pm to review the proposal with your IT team")
  - 12 pts: Specific DATE + TIME, but no clear agenda (e.g., "We're set for Thursday at 10am")
  - 10 pts: Specific DATE, no time (e.g., "I'll send the proposal by Friday")
  - 8 pts: Vague timeframe with action (e.g., "I'll send something next week", "Let's reconnect early next month")
  - 5 pts: Vague commitment only (e.g., "I'll follow up", "We'll be in touch")
  - 0 pts: No next steps secured, or only "Let me know if you have questions"
  - IMPORTANT: If a specific calendar invite was scheduled on the call, award 15 pts regardless of whether the agenda was explicitly stated.

Scoring:
- Calculate overall_score as sum of: patience + monologue + talk_listen_ratio + next_steps (max 80 pts)
- Grade is "Pass" if overall_score >= 48 (60% of 80), otherwise "Fail".
- Note: Final score will include question_quality (20 pts) added by a separate agent.`;

// The Strategist - ONLY focuses on pain-to-pitch alignment (no gaps)
const AUDITOR_SYSTEM_PROMPT = `You are 'The Strategist', a Senior Sales Auditor. Your job is STRICTLY to map 'Prospect Pains' to 'Rep Pitches' and score the relevance.

**YOUR TASK: STRATEGIC THREADING (The Relevance Map)**

1. **Extract Pains/Goals:** Find every specific need, problem, or goal the Prospect explicitly stated.
   - Look for phrases like "we struggle with...", "our challenge is...", "we need...", "we're looking for..."

2. **Extract Pitches:** Find every feature, solution, or capability the Rep presented.
   - Look for phrases like "our platform does...", "we can help with...", "the solution includes..."

3. **Build the Relevance Map:** Connect each Pain to each Pitch.
   - **Relevant:** Rep pitched a feature that directly addresses the stated pain.
   - **Irrelevant (Spray and Pray):** Rep pitched a feature with NO connection to any stated pain.

4. **Score (0-100):**
   - 100%: Every pitch addressed a specific pain, no wasted features.
   - 80%+: Most pitches were relevant, minor spray-and-pray.
   - 60%+: Pass - majority of pitches had some connection.
   - <60%: Fail - too much generic pitching, not enough pain mapping.

5. **Missed Opportunities:** List pains the Prospect mentioned that the Rep NEVER addressed.

**DO NOT:**
- Critique the rep's conversational style.
- Identify "gaps" or "missing information" - that's another agent's job.
- Score anything related to qualification (Budget, Authority, Timeline, etc).

**DO:**
- Focus ONLY on the Pain → Pitch connection.
- Be specific with quotes from the transcript.`;

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

// Objection handling (from The Negotiator)
export interface ObjectionHandling {
  objection_handling: {
    score: number;
    grade: 'Pass' | 'Fail';
    objections_detected: Array<{
      objection: string;
      category: 'Price' | 'Competitor' | 'Authority' | 'Need' | 'Timing' | 'Feature';
      rep_response: string;
      handling_rating: 'Great' | 'Okay' | 'Bad';
      coaching_tip: string;
    }>;
  };
}

// Psychology profile (from The Profiler)
export interface PsychologyProfile {
  prospect_persona: string;
  disc_profile: 'D - Dominance' | 'I - Influence' | 'S - Steadiness' | 'C - Compliance';
  communication_style: {
    tone: string;
    preference: string;
  };
  dos_and_donts: {
    do: string[];
    dont: string[];
  };
}

// Combined interface for backward compatibility
export interface StrategyAudit extends StrategicThreading, DealGaps, ObjectionHandling {}

interface CallLovableAIOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
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

  try {
    return JSON.parse(toolCall.function.arguments);
  } catch (e) {
    console.error('[analysis-agents] Failed to parse tool arguments:', toolCall.function.arguments);
    throw new Error('Failed to parse AI response');
  }
}

/**
 * Agent 1: The Clerk - Extract metadata and facts from transcript
 */
export async function analyzeCallMetadata(transcript: string): Promise<CallMetadata> {
  console.log('[analyzeCallMetadata] Starting metadata extraction...');
  
  const userPrompt = `Analyze this sales call transcript and extract all relevant metadata:\n\n${transcript}`;
  
  const result = await callLovableAI(
    CLERK_SYSTEM_PROMPT,
    userPrompt,
    CALL_METADATA_TOOL,
    'extract_call_metadata'
  );
  
  console.log('[analyzeCallMetadata] Extraction complete');
  return result as CallMetadata;
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
    'score_call_behavior'
  );
  
  console.log('[analyzeCallBehavior] Analysis complete, score:', result.overall_score);
  return result as BehaviorScore;
}

/**
 * Agent 3: The Strategist - Analyze strategic alignment (pain-to-pitch mapping ONLY)
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
    }
  );
  
  console.log('[analyzeDealGaps] Analysis complete, found', result.critical_gaps?.length || 0, 'gaps');
  return result as DealGaps;
}

/**
 * Agent 4: The Interrogator - Analyze question leverage and effectiveness
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
      temperature: 0.2, // Low temperature for precise linguistic analysis
    }
  );
  
  console.log('[analyzeQuestionLeverage] Analysis complete, score:', result.score, ', yield_ratio:', result.yield_ratio);
  return result as QuestionLeverage;
}

/**
 * Agent 6: The Negotiator - Analyze objection handling
 * Uses gemini-2.5-pro for reasoning-heavy judgment of response quality
 */
export async function analyzeObjections(transcript: string): Promise<ObjectionHandling> {
  console.log('[analyzeObjections] Starting objection handling analysis with Pro model...');
  
  const userPrompt = `Analyze this sales call transcript for objections and pushback. Identify how the rep handled each moment of friction:\n\n${transcript}`;
  
  const result = await callLovableAI(
    NEGOTIATOR_SYSTEM_PROMPT,
    userPrompt,
    OBJECTION_HANDLING_TOOL,
    'analyze_objection_handling',
    {
      model: 'google/gemini-2.5-pro',
      temperature: 0.1, // Low temperature for consistent judgment
      maxTokens: 4096,
    }
  );
  
  console.log('[analyzeObjections] Analysis complete, score:', result.score, ', objections found:', result.objections_detected?.length || 0);
  return { objection_handling: result } as ObjectionHandling;
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
      temperature: 0.3, // Slightly higher for persona creativity
      maxTokens: 2048,
    }
  );
  
  console.log('[analyzePsychology] Profiling complete, persona:', result.prospect_persona, ', DISC:', result.disc_profile);
  return result as PsychologyProfile;
}
