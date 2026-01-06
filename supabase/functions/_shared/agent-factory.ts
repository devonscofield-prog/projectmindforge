/**
 * Agent Factory - Generic Agent Execution
 * 
 * Handles AI calling, validation, logging, and error handling for any agent.
 */

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AgentConfig } from './agent-registry.ts';
import { createToolFromSchema } from './zod-to-json-schema.ts';

// AI Gateway configuration
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const AI_GATEWAY_TIMEOUT_MS = 90000; // 90s - extended for fire-and-forget background processing

// Per-agent timeouts based on model - extended for background processing
// analyze-call now returns 202 immediately and processes in background
const AGENT_TIMEOUT_MS = {
  'google/gemini-2.5-flash': 60000,
  'google/gemini-2.5-pro': 90000,
  'google/gemini-3-pro-preview': 90000,
  'openai/gpt-5.2': 90000,
} as const;

type ModelType = keyof typeof AGENT_TIMEOUT_MS;

// Agent-specific timeout overrides - tuned per agent complexity
// Since analyze-call runs in background, we can afford longer timeouts for quality
const AGENT_TIMEOUT_OVERRIDES: Record<string, number> = {
  'speaker_labeler': 60000,   // Simple labeling task
  'sentinel': 45000,          // Fast classification
  'census': 60000,            // Entity extraction
  'historian': 60000,         // Summary generation
  'spy': 75000,               // Competitive intel extraction
  'profiler': 60000,          // Psychology profiling
  'strategist': 90000,        // Complex multi-phase analysis
  'referee': 75000,           // Behavioral scoring with nuance
  'interrogator': 75000,      // Question/answer analysis
  'skeptic': 75000,           // Complex gap reasoning
  'negotiator': 75000,        // LAER framework analysis
  'auditor': 60000,           // Simple pricing analysis
  'coach': 120000,            // Synthesis of all agents - needs most time
} as const;

// Non-critical agents that can fail gracefully without blocking analysis
const NON_CRITICAL_AGENTS = new Set([
  'profiler', 'spy', 'auditor', 'interrogator', 'negotiator',
  'referee', 'strategist', 'skeptic'
]);

export function getAgentTimeout(model: ModelType, agentId?: string): number {
  // Check for agent-specific override first
  if (agentId && AGENT_TIMEOUT_OVERRIDES[agentId]) {
    return AGENT_TIMEOUT_OVERRIDES[agentId];
  }
  return AGENT_TIMEOUT_MS[model] || 15000;
}

function isOpenAIModel(model: string): boolean {
  return model.startsWith('openai/');
}

export function isNonCriticalAgent(agentId: string): boolean {
  return NON_CRITICAL_AGENTS.has(agentId);
}

// ============= TYPES =============

export interface AgentResult<T> {
  success: boolean;
  data: T;
  durationMs: number;
  error?: string;
}

// ============= PERFORMANCE LOGGING =============

async function logPerformance(
  supabase: SupabaseClient,
  metricName: string,
  durationMs: number,
  status: 'success' | 'error',
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await supabase.from('performance_metrics').insert({
      metric_type: 'edge_function',
      metric_name: metricName,
      duration_ms: Math.round(durationMs),
      status,
      metadata,
    });
  } catch (err) {
    console.warn(`[agent-factory] Failed to log performance metric ${metricName}:`, err);
  }
}

// ============= RETRY CONFIGURATION =============

const MAX_RETRIES = 2;
const BASE_RETRY_DELAY_MS = 500;

function isRetryableError(status: number): boolean {
  return status === 429 || status >= 500;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============= SCHEMA COERCION HELPERS =============

/**
 * Attempt to fix common schema validation issues before failing
 * This helps recover from minor AI response formatting issues
 */
function coerceStrategistOutput(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  
  const obj = data as Record<string, unknown>;
  
  // Fix strategic_threading.missed_opportunities - coerce strings to objects
  if (obj.strategic_threading && typeof obj.strategic_threading === 'object') {
    const st = obj.strategic_threading as Record<string, unknown>;
    
    // Coerce string array to object array for missed_opportunities
    if (Array.isArray(st.missed_opportunities)) {
      st.missed_opportunities = st.missed_opportunities
        .slice(0, 3) // Limit to 3 as per optimized prompt
        .map((item: unknown) => {
          if (typeof item === 'string') {
            // Convert string to object format
            return {
              pain: item,
              severity: 'Medium' as const,
              suggested_pitch: 'See above pain description',
              talk_track: `When you mentioned "${item}", that's exactly where we can help...`,
            };
          }
          return item;
        });
    }
    
    // Ensure score_breakdown exists with defaults
    if (!st.score_breakdown || typeof st.score_breakdown !== 'object') {
      st.score_breakdown = {
        high_pains_addressed: 0,
        high_pains_total: 0,
        medium_pains_addressed: 0,
        medium_pains_total: 0,
        spray_and_pray_count: 0,
      };
    }
  }
  
  return obj;
}

/**
 * Attempt to fix common Referee schema issues
 */
function coerceRefereeOutput(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  
  const obj = data as Record<string, unknown>;
  
  if (obj.metrics && typeof obj.metrics === 'object') {
    const metrics = obj.metrics as Record<string, unknown>;
    
    // Fix interactivity.score exceeding max of 20
    if (metrics.interactivity && typeof metrics.interactivity === 'object') {
      const interactivity = metrics.interactivity as Record<string, unknown>;
      if (typeof interactivity.score === 'number' && interactivity.score > 20) {
        console.log(`[agent-factory] Coercing interactivity.score from ${interactivity.score} to 20`);
        interactivity.score = 20;
      }
    }
  }
  
  return obj;
}

/**
 * Apply agent-specific coercion based on agent ID
 */
function applySchemaCoercion(agentId: string, data: unknown): unknown {
  switch (agentId) {
    case 'strategist':
      return coerceStrategistOutput(data);
    case 'referee':
      return coerceRefereeOutput(data);
    default:
      return data;
  }
}

// ============= AI CALLING =============

/**
 * Call OpenAI API directly for openai/* models
 */
async function callOpenAIAPI<T extends z.ZodTypeAny>(
  config: AgentConfig<T>,
  userPrompt: string,
  tool: unknown,
  agentTimeoutMs: number
): Promise<z.infer<T>> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  // Extract model name without prefix (e.g., "openai/gpt-5.2-pro" -> "gpt-5.2-pro")
  const modelName = config.options.model.replace('openai/', '');

  // GPT-5.x models use max_completion_tokens and don't support temperature
  const requestBody: Record<string, unknown> = {
    model: modelName,
    messages: [
      { role: 'system', content: config.systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    tools: [tool],
    tool_choice: { type: 'function', function: { name: config.toolName } },
    max_completion_tokens: config.options.maxTokens || 4096,
  };
  // Note: GPT-5.x models don't support temperature parameter

  console.log(`[agent-factory] Calling OpenAI API with model: ${modelName}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), agentTimeoutMs);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[agent-factory] OpenAI API error ${response.status} for ${config.id}:`, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Extract tool call arguments
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== config.toolName) {
      console.error(`[agent-factory] Unexpected OpenAI response for ${config.id}:`, JSON.stringify(data).substring(0, 500));
      throw new Error('Invalid OpenAI response structure');
    }

    let parsedResult: unknown;
    try {
      parsedResult = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error(`[agent-factory] Failed to parse OpenAI tool arguments for ${config.id}:`, toolCall.function.arguments.substring(0, 500));
      throw new Error('Failed to parse OpenAI response');
    }

    // Apply agent-specific coercion before validation
    const coercedResult = applySchemaCoercion(config.id, parsedResult);

    // Validate against schema
    let validationResult = config.schema.safeParse(coercedResult);
    
    // If validation still fails after coercion, log and throw
    if (!validationResult.success) {
      console.error(`[agent-factory] Schema validation failed for ${config.id}:`, validationResult.error.message);
      throw new Error(`Schema validation failed: ${validationResult.error.message}`);
    }

    return validationResult.data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`OpenAI API timeout after ${agentTimeoutMs / 1000}s`);
    }
    throw err;
  }
}

async function callLovableAI<T extends z.ZodTypeAny>(
  config: AgentConfig<T>,
  userPrompt: string
): Promise<z.infer<T>> {
  // Generate tool from Zod schema
  const tool = createToolFromSchema(config.toolName, config.toolDescription, config.schema);
  
  // Use per-agent timeout with optional agent-specific override
  const agentTimeoutMs = getAgentTimeout(config.options.model as ModelType, config.id);

  // Route to OpenAI if model starts with "openai/"
  if (isOpenAIModel(config.options.model)) {
    return callOpenAIAPI(config, userPrompt, tool, agentTimeoutMs);
  }

  // Otherwise use Lovable AI Gateway
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }

  const requestBody: Record<string, unknown> = {
    model: config.options.model,
    messages: [
      { role: 'system', content: config.systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    tools: [tool],
    tool_choice: { type: 'function', function: { name: config.toolName } },
    max_tokens: config.options.maxTokens || 4096,
  };

  if (config.options.temperature !== undefined) {
    requestBody.temperature = config.options.temperature;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`[agent-factory] Retry ${attempt}/${MAX_RETRIES} for ${config.id} after ${delayMs}ms...`);
      await delay(delayMs);
    }

    // Create AbortController with per-agent timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), agentTimeoutMs);

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
        const isNonCritical = isNonCriticalAgent(config.id);
        lastError = new Error(`Agent ${config.id} ${isNonCritical ? 'early terminated' : 'timeout'} after ${agentTimeoutMs / 1000}s`);
        console.warn(`[agent-factory] ${config.id} ${isNonCritical ? 'EARLY TERMINATED' : 'timed out'} after ${agentTimeoutMs}ms (non-critical: ${isNonCritical})`);
        if (isNonCritical) {
          // Don't retry non-critical agents - fail fast with defaults
          throw lastError;
        }
        continue; // Only retry critical agents on timeout
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[agent-factory] AI Gateway error ${response.status} for ${config.id}:`, errorText);
      
      if (response.status === 402) {
        throw new Error('AI credits exhausted. Please add funds to continue.');
      }
      
      if (isRetryableError(response.status)) {
        lastError = new Error(`AI Gateway error: ${response.status}`);
        continue; // Retry on 429 or 5xx
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();

    // Check for Gemini reasoning model truncation (content empty but reasoning exists)
    const message = data.choices?.[0]?.message;
    const finishReason = data.choices?.[0]?.finish_reason;
    if (finishReason === 'length' || (message?.reasoning && (!message?.content || message.content === '') && !message?.tool_calls?.[0])) {
      console.warn(`[agent-factory] Gemini reasoning truncation detected for ${config.id} - reasoning used all tokens, no output generated`);
      console.warn(`[agent-factory] finish_reason: ${finishReason}, has_reasoning: ${!!message?.reasoning}, content_length: ${message?.content?.length || 0}`);
      lastError = new Error(`Agent ${config.id} output truncated - reasoning exhausted token budget`);
      continue; // Retry - may succeed on second attempt with different reasoning path
    }

    // Extract tool call arguments
    const toolCall = message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== config.toolName) {
      console.error(`[agent-factory] Unexpected response structure for ${config.id}:`, JSON.stringify(data).substring(0, 500));
      throw new Error('Invalid AI response structure');
    }

    let parsedResult: unknown;
    try {
      parsedResult = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error(`[agent-factory] Failed to parse tool arguments for ${config.id}:`, toolCall.function.arguments.substring(0, 500));
      throw new Error('Failed to parse AI response');
    }

    // Apply agent-specific coercion before validation
    const coercedResult = applySchemaCoercion(config.id, parsedResult);

    // Validate against schema
    const validationResult = config.schema.safeParse(coercedResult);
    
    // If validation fails, handle gracefully for non-critical agents
    if (!validationResult.success) {
      console.warn(`[agent-factory] Validation failed for ${config.id}: ${validationResult.error.message}`);
      console.warn(`[agent-factory] Validation errors: ${JSON.stringify(validationResult.error.issues.slice(0, 3))}`);
      
      // For non-critical agents, return defaults rather than throwing
      if (isNonCriticalAgent(config.id)) {
        console.warn(`[agent-factory] Non-critical agent ${config.id} - returning default values`);
        return config.default as z.infer<T>;
      }
      
      throw new Error(`Schema validation failed: ${validationResult.error.message}`);
    }

    return validationResult.data;
  }

  // All retries exhausted
  throw lastError || new Error(`Failed after ${MAX_RETRIES + 1} attempts`);
}

// ============= CONSENSUS CONFIGURATION =============

const CONSENSUS_MODELS = ['openai/gpt-5.2', 'google/gemini-3-pro-preview'] as const;

// Grade ranking for averaging
const GRADE_ORDER = ['F', 'D', 'C', 'B', 'A', 'A+'] as const;
type GradeType = typeof GRADE_ORDER[number];

function gradeToNumber(grade: GradeType): number {
  return GRADE_ORDER.indexOf(grade);
}

function numberToGrade(num: number): GradeType {
  const rounded = Math.round(Math.max(0, Math.min(5, num)));
  return GRADE_ORDER[rounded];
}

// ============= CONSENSUS HELPER FUNCTIONS =============

function deduplicateStrings(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter(s => {
    const normalized = s.toLowerCase().trim();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

// ============= CONSENSUS EXECUTION =============

/**
 * Execute an agent with a specific model override
 */
async function executeAgentWithModel<T extends z.ZodTypeAny>(
  config: AgentConfig<T>,
  userPrompt: string,
  modelOverride: typeof CONSENSUS_MODELS[number],
  supabase: SupabaseClient,
  callId: string
): Promise<AgentResult<z.infer<T>>> {
  const start = performance.now();
  const metricName = `agent_${config.id}_${modelOverride.replace('/', '_')}`;

  console.log(`[${config.name}] Starting with model override: ${modelOverride}...`);

  // Create a cloned config with the model override
  const overriddenConfig: AgentConfig<T> = {
    ...config,
    options: { ...config.options, model: modelOverride as AgentConfig<T>['options']['model'] },
  };

  try {
    const result = await callLovableAI(overriddenConfig, userPrompt);
    const duration = performance.now() - start;

    await logPerformance(supabase, metricName, duration, 'success', {
      call_id: callId,
      agent_id: config.id,
      model: modelOverride,
      consensus_run: true,
    });

    console.log(`[${config.name}] (${modelOverride}) Complete in ${Math.round(duration)}ms`);
    return { success: true, data: result, durationMs: duration };
  } catch (err) {
    const duration = performance.now() - start;
    const error = err instanceof Error ? err.message : String(err);

    await logPerformance(supabase, metricName, duration, 'error', {
      call_id: callId,
      agent_id: config.id,
      model: modelOverride,
      error,
      consensus_run: true,
    });

    console.warn(`[${config.name}] (${modelOverride}) Failed after ${Math.round(duration)}ms: ${error}`);
    return { success: false, data: config.default, durationMs: duration, error };
  }
}

/**
 * Reconcile two Coach outputs when models disagree
 * Uses intelligent merging or a third AI call for reconciliation
 */
async function reconcileCoachOutputs(
  gptCoach: z.infer<typeof import('./agent-schemas.ts').CoachSchema>,
  geminiCoach: z.infer<typeof import('./agent-schemas.ts').CoachSchema>,
  supabase: SupabaseClient,
  callId: string
): Promise<z.infer<typeof import('./agent-schemas.ts').CoachSchema>> {
  console.log(`[Coach Reconciler] GPT grade: ${gptCoach.overall_grade}, focus: ${gptCoach.primary_focus_area}`);
  console.log(`[Coach Reconciler] Gemini grade: ${geminiCoach.overall_grade}, focus: ${geminiCoach.primary_focus_area}`);

  // If grades match and primary focus matches, merge arrays and combine reasoning
  if (gptCoach.overall_grade === geminiCoach.overall_grade && 
      gptCoach.primary_focus_area === geminiCoach.primary_focus_area) {
    console.log('[Coach Reconciler] Full agreement - merging outputs');
    return {
      overall_grade: gptCoach.overall_grade,
      executive_summary: gptCoach.executive_summary.length > geminiCoach.executive_summary.length 
        ? gptCoach.executive_summary 
        : geminiCoach.executive_summary,
      top_3_strengths: deduplicateStrings([...gptCoach.top_3_strengths, ...geminiCoach.top_3_strengths]).slice(0, 3),
      top_3_areas_for_improvement: deduplicateStrings([...gptCoach.top_3_areas_for_improvement, ...geminiCoach.top_3_areas_for_improvement]).slice(0, 3),
      primary_focus_area: gptCoach.primary_focus_area,
      coaching_prescription: gptCoach.coaching_prescription.length > geminiCoach.coaching_prescription.length
        ? gptCoach.coaching_prescription
        : geminiCoach.coaching_prescription,
      coaching_drill: (gptCoach.coaching_drill?.length || 0) > (geminiCoach.coaching_drill?.length || 0)
        ? gptCoach.coaching_drill
        : geminiCoach.coaching_drill,
      immediate_action: gptCoach.immediate_action || geminiCoach.immediate_action,
      grade_reasoning: `${gptCoach.grade_reasoning}\n\n[Corroborated by second model]: ${geminiCoach.grade_reasoning}`,
      deal_progression: gptCoach.deal_progression || geminiCoach.deal_progression,
    };
  }

  // Grades are close (within 1 level) but focus areas differ - use GPT's grade, merge insights
  const gptGradeNum = gradeToNumber(gptCoach.overall_grade as GradeType);
  const geminiGradeNum = gradeToNumber(geminiCoach.overall_grade as GradeType);
  const gradeDiff = Math.abs(gptGradeNum - geminiGradeNum);

  if (gradeDiff <= 1) {
    console.log(`[Coach Reconciler] Close grades (diff=${gradeDiff}) - averaging and using GPT focus`);
    // Average the grades
    const avgGrade = numberToGrade((gptGradeNum * 0.55 + geminiGradeNum * 0.45));
    
    return {
      overall_grade: avgGrade,
      executive_summary: gptCoach.executive_summary,
      top_3_strengths: deduplicateStrings([...gptCoach.top_3_strengths, ...geminiCoach.top_3_strengths]).slice(0, 3),
      top_3_areas_for_improvement: deduplicateStrings([...gptCoach.top_3_areas_for_improvement, ...geminiCoach.top_3_areas_for_improvement]).slice(0, 3),
      // GPT wins tiebreaker on focus area
      primary_focus_area: gptCoach.primary_focus_area,
      coaching_prescription: gptCoach.coaching_prescription,
      coaching_drill: gptCoach.coaching_drill || geminiCoach.coaching_drill,
      immediate_action: gptCoach.immediate_action || geminiCoach.immediate_action,
      grade_reasoning: `[Multi-model consensus - GPT: ${gptCoach.overall_grade}, Gemini: ${geminiCoach.overall_grade}]\n\nGPT reasoning: ${gptCoach.grade_reasoning}\n\nGemini perspective: ${geminiCoach.grade_reasoning}`,
      deal_progression: gptCoach.deal_progression || geminiCoach.deal_progression,
    };
  }

  // Significant disagreement (>1 grade difference) - use reconciler AI call
  console.log(`[Coach Reconciler] Significant disagreement (diff=${gradeDiff}) - calling reconciler AI`);
  
  const reconcilerPrompt = `Two expert sales coaches analyzed the same call and produced significantly different assessments.

**Coach A (GPT-5):**
- Grade: ${gptCoach.overall_grade}
- Focus Area: ${gptCoach.primary_focus_area}
- Prescription: ${gptCoach.coaching_prescription}
- Reasoning: ${gptCoach.grade_reasoning}
- Strengths: ${gptCoach.top_3_strengths.join(', ')}
- Improvements: ${gptCoach.top_3_areas_for_improvement.join(', ')}

**Coach B (Gemini):**
- Grade: ${geminiCoach.overall_grade}
- Focus Area: ${geminiCoach.primary_focus_area}
- Prescription: ${geminiCoach.coaching_prescription}
- Reasoning: ${geminiCoach.grade_reasoning}
- Strengths: ${geminiCoach.top_3_strengths.join(', ')}
- Improvements: ${geminiCoach.top_3_areas_for_improvement.join(', ')}

Your task: Synthesize these into ONE final coaching assessment. Consider:
1. If grades differ significantly, determine which reasoning is more evidence-based
2. Choose the focus area with stronger supporting evidence
3. Combine the best insights from both prescriptions
4. Select the most actionable drill

Output your reconciled assessment using the same schema.`;

  try {
    const { CoachSchema } = await import('./agent-schemas.ts');
    const { createToolFromSchema } = await import('./zod-to-json-schema.ts');
    
    const tool = createToolFromSchema('reconcile_coaching', 'Synthesize two coaching assessments into one', CoachSchema);
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!apiKey) {
      console.warn('[Coach Reconciler] No API key - falling back to GPT result');
      return gptCoach;
    }

    const response = await fetch(LOVABLE_AI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash', // Fast model for reconciliation
        messages: [
          { role: 'system', content: 'You are a senior sales coach reconciling two assessments. Be decisive and evidence-based.' },
          { role: 'user', content: reconcilerPrompt },
        ],
        tools: [tool],
        tool_choice: { type: 'function', function: { name: 'reconcile_coaching' } },
        max_tokens: 8192,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.warn('[Coach Reconciler] Reconciler API failed - falling back to GPT result');
      return gptCoach;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      console.warn('[Coach Reconciler] No tool call in response - falling back to GPT result');
      return gptCoach;
    }

    const reconciled = JSON.parse(toolCall.function.arguments);
    const validationResult = CoachSchema.safeParse(reconciled);
    
    if (!validationResult.success) {
      console.warn('[Coach Reconciler] Validation failed - falling back to GPT result');
      return gptCoach;
    }

    console.log(`[Coach Reconciler] Reconciled grade: ${validationResult.data.overall_grade}, focus: ${validationResult.data.primary_focus_area}`);
    
    // Add reconciliation metadata to reasoning
    return {
      ...validationResult.data,
      grade_reasoning: `[Reconciled from GPT: ${gptCoach.overall_grade} and Gemini: ${geminiCoach.overall_grade}]\n\n${validationResult.data.grade_reasoning}`,
    };
  } catch (err) {
    console.error('[Coach Reconciler] Error during reconciliation:', err);
    return gptCoach; // Fallback to GPT result
  }
}

export interface CoachConsensusOptions {
  skipConsensus?: boolean;  // If true, use single model (GPT-5.2) for speed
}

/**
 * Execute Coach agent with multi-model consensus
 * Runs on both GPT-5.2 and Gemini 3 Pro in parallel, then reconciles
 * Set skipConsensus=true for faster single-model execution when speed is preferred over maximum accuracy
 */
export async function executeCoachWithConsensus(
  config: AgentConfig<z.ZodTypeAny>,
  userPrompt: string,
  supabase: SupabaseClient,
  callId: string,
  options?: CoachConsensusOptions
): Promise<AgentResult<z.infer<typeof import('./agent-schemas.ts').CoachSchema>>> {
  const start = performance.now();
  
  // Fast path: skip consensus and use single model
  if (options?.skipConsensus) {
    console.log('[Coach] Running in fast mode (single model, no consensus)...');
    return executeAgentWithModel(config, userPrompt, 'openai/gpt-5.2', supabase, callId);
  }
  
  console.log('[Coach Consensus] Starting multi-model execution...');

  // Run both models in parallel
  const [gptResult, geminiResult] = await Promise.allSettled([
    executeAgentWithModel(config, userPrompt, 'openai/gpt-5.2', supabase, callId),
    executeAgentWithModel(config, userPrompt, 'google/gemini-3-pro-preview', supabase, callId),
  ]);

  // Extract results with fallback handling
  const gptData = gptResult.status === 'fulfilled' && gptResult.value.success ? gptResult.value.data : null;
  const geminiData = geminiResult.status === 'fulfilled' && geminiResult.value.success ? geminiResult.value.data : null;

  const duration = performance.now() - start;

  // If both models fail, return default
  if (!gptData && !geminiData) {
    console.error('[Coach Consensus] Both models failed');
    await logPerformance(supabase, 'agent_coach_consensus', duration, 'error', {
      call_id: callId,
      gpt_failed: true,
      gemini_failed: true,
    });
    return { success: false, data: config.default, durationMs: duration, error: 'Both consensus models failed' };
  }

  // If one model fails, use the other
  if (!gptData) {
    console.warn('[Coach Consensus] GPT failed, using Gemini result');
    await logPerformance(supabase, 'agent_coach_consensus', duration, 'success', {
      call_id: callId,
      gpt_failed: true,
      gemini_only: true,
    });
    return { success: true, data: geminiData!, durationMs: duration };
  }
  if (!geminiData) {
    console.warn('[Coach Consensus] Gemini failed, using GPT result');
    await logPerformance(supabase, 'agent_coach_consensus', duration, 'success', {
      call_id: callId,
      gemini_failed: true,
      gpt_only: true,
    });
    return { success: true, data: gptData!, durationMs: duration };
  }

  // Both succeeded - reconcile outputs
  console.log('[Coach Consensus] Both models succeeded, reconciling...');
  const reconciled = await reconcileCoachOutputs(gptData, geminiData, supabase, callId);
  
  const totalDuration = performance.now() - start;
  await logPerformance(supabase, 'agent_coach_consensus', totalDuration, 'success', {
    call_id: callId,
    gpt_grade: gptData.overall_grade,
    gemini_grade: geminiData.overall_grade,
    final_grade: reconciled.overall_grade,
    reconciliation_needed: gptData.overall_grade !== geminiData.overall_grade || gptData.primary_focus_area !== geminiData.primary_focus_area,
  });

  console.log(`[Coach Consensus] Complete in ${Math.round(totalDuration)}ms - Final grade: ${reconciled.overall_grade}`);
  return { success: true, data: reconciled, durationMs: totalDuration };
}

// ============= AGENT EXECUTION =============

/**
 * Execute a single agent with full error handling, logging, and fallback
 */
export async function executeAgent<T extends z.ZodTypeAny>(
  config: AgentConfig<T>,
  transcript: string,
  supabase: SupabaseClient,
  callId: string
): Promise<AgentResult<z.infer<T>>> {
  const start = performance.now();
  const metricName = `agent_${config.id}`;

  console.log(`[${config.name}] Starting ${config.description}...`);

  try {
    const userPrompt = config.userPromptTemplate(transcript);
    const result = await callLovableAI(config, userPrompt);
    const duration = performance.now() - start;

    // Log success
    await logPerformance(supabase, metricName, duration, 'success', {
      call_id: callId,
      agent_id: config.id,
    });

    console.log(`[${config.name}] Complete in ${Math.round(duration)}ms`);

    return { success: true, data: result, durationMs: duration };
  } catch (err) {
    const duration = performance.now() - start;
    const error = err instanceof Error ? err.message : String(err);

    // Log error
    await logPerformance(supabase, metricName, duration, 'error', {
      call_id: callId,
      agent_id: config.id,
      error,
    });

    console.warn(`[${config.name}] Failed after ${Math.round(duration)}ms: ${error}`);

    return { success: false, data: config.default, durationMs: duration, error };
  }
}

/**
 * Execute a single agent with a CUSTOM user prompt (for context-aware execution)
 * This allows injecting context from previous batches into the prompt.
 */
export async function executeAgentWithPrompt<T extends z.ZodTypeAny>(
  config: AgentConfig<T>,
  customUserPrompt: string,
  supabase: SupabaseClient,
  callId: string
): Promise<AgentResult<z.infer<T>>> {
  const start = performance.now();
  const metricName = `agent_${config.id}`;

  console.log(`[${config.name}] Starting ${config.description} (context-aware)...`);

  try {
    const result = await callLovableAI(config, customUserPrompt);
    const duration = performance.now() - start;

    // Log success
    await logPerformance(supabase, metricName, duration, 'success', {
      call_id: callId,
      agent_id: config.id,
      context_aware: true,
    });

    console.log(`[${config.name}] Complete in ${Math.round(duration)}ms`);

    return { success: true, data: result, durationMs: duration };
  } catch (err) {
    const duration = performance.now() - start;
    const error = err instanceof Error ? err.message : String(err);

    // Log error
    await logPerformance(supabase, metricName, duration, 'error', {
      call_id: callId,
      agent_id: config.id,
      error,
      context_aware: true,
    });

    console.warn(`[${config.name}] Failed after ${Math.round(duration)}ms: ${error}`);

    return { success: false, data: config.default, durationMs: duration, error };
  }
}

/**
 * Execute multiple agents in parallel with graceful error handling
 */
export async function executeAgentsInParallel<T extends z.ZodTypeAny>(
  configs: AgentConfig<T>[],
  transcript: string,
  supabase: SupabaseClient,
  callId: string
): Promise<Map<string, AgentResult<z.infer<T>>>> {
  const results = await Promise.allSettled(
    configs.map(config => executeAgent(config, transcript, supabase, callId))
  );

  const resultMap = new Map<string, AgentResult<z.infer<T>>>();
  
  results.forEach((result, index) => {
    const config = configs[index];
    if (result.status === 'fulfilled') {
      resultMap.set(config.id, result.value);
    } else {
      // Promise rejection (shouldn't happen due to internal try-catch, but safety net)
      console.error(`[agent-factory] Promise rejected for ${config.id}:`, result.reason);
      resultMap.set(config.id, {
        success: false,
        data: config.default,
        durationMs: 0,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  });

  return resultMap;
}
