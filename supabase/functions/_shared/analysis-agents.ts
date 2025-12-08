/**
 * Analysis Agents for Call Analysis 2.0
 * 
 * Agent 1: The Clerk - Metadata & Facts extraction
 * Agent 2: The Referee - Behavioral scoring
 * Agent 3: The Auditor - Strategy & MEDDPICC analysis
 */

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

const STRATEGY_AUDIT_TOOL = {
  type: "function",
  function: {
    name: "audit_call_strategy",
    description: "Audit the strategic alignment and identify critical gaps in a sales call",
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
        },
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
      required: ["strategic_threading", "critical_gaps"]
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

const AUDITOR_SYSTEM_PROMPT = `You are a Senior Sales Auditor. Your goal is to measure Deal Health and Strategic Alignment objectively.

**PHASE 1: STRATEGIC THREADING (The Relevance Map)**
1. Extract specific 'Pains/Goals' the Prospect explicitly stated.
2. Extract specific 'Features/Solutions' the Rep pitched.
3. Create a 'Relevance Map' connecting Pains to Features.
   - If a Rep pitches a feature that maps to a pain -> Relevant.
   - If a Rep pitches a feature with NO connection to a stated pain -> Irrelevant (Spray and Pray).
4. Score (0-100) based on the ratio of Relevant vs. Irrelevant pitches.
5. Grade is "Pass" if score >= 60, otherwise "Fail".

**PHASE 2: CRITICAL GAP SCANNER**
Instead of grading a framework, identify the 3-5 most dangerous 'Unknowns' in this deal based on the transcript.

Rules for identifying gaps:
- **Missing Logic**: If they discussed a '2027 contract expiry', a Critical Gap is 'Did not ask about early cancellation terms.'
- **Missing Stakeholders**: If they mentioned a 'Boss' or manager, did we get the Boss's name? Their role in the decision?
- **Missing Budget Info**: If price was discussed, do we know the actual budget range or approval process?
- **Missing Timeline Details**: If a deadline was mentioned, do we know WHY that deadline matters?
- **Missing Competition Intel**: If they're evaluating alternatives, do we know which ones and what they like about them?
- **Missing Technical Requirements**: If they mentioned integrations or requirements, do we have specifics?

Categories: Budget, Authority, Need, Timeline, Competition, Technical
Impact levels: High (deal-blocking), Medium (creates friction), Low (nice to know)

For each gap, provide a specific 'suggested_question' - the exact question the rep should ask to close the gap.`;

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

export interface BehaviorScore {
  overall_score: number;
  grade: 'Pass' | 'Fail';
  metrics: {
    patience: {
      score: number;
      interruption_count: number;
      status: 'Excellent' | 'Good' | 'Fair' | 'Poor';
    };
    question_quality: {
      score: number;
      explanation: string;
      average_question_length: number;
      average_answer_length: number;
      high_leverage_count: number;
      low_leverage_count: number;
      high_leverage_examples: string[];
      low_leverage_examples: string[];
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

export interface StrategyAudit {
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
  critical_gaps: Array<{
    category: 'Budget' | 'Authority' | 'Need' | 'Timeline' | 'Competition' | 'Technical';
    description: string;
    impact: 'High' | 'Medium' | 'Low';
    suggested_question: string;
  }>;
}

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

  const response = await fetch(LOVABLE_AI_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

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
 * Agent 3: The Auditor - Analyze strategic alignment and MEDDPICC
 * Uses gemini-2.5-pro for complex reasoning with low temperature for strict logic
 */
export async function analyzeCallStrategy(transcript: string): Promise<StrategyAudit> {
  console.log('[analyzeCallStrategy] Starting strategy audit with Pro model...');
  
  const userPrompt = `Perform a comprehensive strategic audit of this sales call transcript. Analyze the rep's strategic alignment (pain-to-feature mapping) and MEDDPICC qualification rigor:\n\n${transcript}`;
  
  const result = await callLovableAI(
    AUDITOR_SYSTEM_PROMPT,
    userPrompt,
    STRATEGY_AUDIT_TOOL,
    'audit_call_strategy',
    {
      model: 'google/gemini-2.5-pro',
      temperature: 0.1,
      maxTokens: 8192, // More tokens for complex analysis
    }
  );
  
  console.log('[analyzeCallStrategy] Audit complete, threading score:', result.strategic_threading?.score);
  return result as StrategyAudit;
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
