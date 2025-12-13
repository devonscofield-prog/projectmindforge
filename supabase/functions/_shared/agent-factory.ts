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
const AI_GATEWAY_TIMEOUT_MS = 55000; // 55s to leave buffer before 60s edge function timeout

// Per-agent timeouts based on model (P1 optimization)
const AGENT_TIMEOUT_MS = {
  'google/gemini-2.5-flash': 15000,  // 15s for flash models
  'google/gemini-2.5-pro': 30000,    // 30s for pro models (reduced from 45s)
  'google/gemini-3-pro-preview': 35000, // 35s for Gemini 3 Pro
  'openai/gpt-5.2': 35000,           // 35s for OpenAI GPT-5.2
} as const;

type ModelType = keyof typeof AGENT_TIMEOUT_MS;

// Agent-specific timeout overrides (tuned based on P95 data)
const AGENT_TIMEOUT_OVERRIDES: Record<string, number> = {
  'speaker_labeler': 15000,  // 15s - reduced from 20s, now uses 30k char limit + smart skip
  'skeptic': 15000,          // 15s - complex gap analysis
  'negotiator': 12000,       // 12s - reduced from 15s, avg 4.5s
  'coach': 35000,            // 35s - Gemini 3 Pro synthesis
  'auditor': 8000,           // 8s - reduced from 12s, P95 is 13s so fail fast on outliers
  'profiler': 10000,         // 10s - reduced from 12s
  'interrogator': 25000,     // 25s - Gemini 3 Pro question analysis
  'strategist': 12000,       // 12s - P95 is 8s
  'referee': 10000,          // 10s - behavioral scoring is bounded
} as const;

// Non-critical agents that can fail gracefully without blocking analysis
const NON_CRITICAL_AGENTS = new Set([
  'profiler', 'spy', 'auditor', 'interrogator', 'negotiator'
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

    // Validate against schema
    const validationResult = config.schema.safeParse(parsedResult);
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

    // Extract tool call arguments
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
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

    // Validate against schema
    const validationResult = config.schema.safeParse(parsedResult);
    if (!validationResult.success) {
      console.error(`[agent-factory] Schema validation failed for ${config.id}:`, validationResult.error.message);
      console.error('[agent-factory] Invalid data received:', JSON.stringify(parsedResult).substring(0, 500));
      throw new Error(`Schema validation failed: ${validationResult.error.message}`);
    }

    return validationResult.data;
  }

  // All retries exhausted
  throw lastError || new Error(`Failed after ${MAX_RETRIES + 1} attempts`);
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
