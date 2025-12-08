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
const AI_GATEWAY_TIMEOUT_MS = 55000; // 55s to leave buffer before 60s edge function timeout

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

// ============= AI CALLING =============

async function callLovableAI<T extends z.ZodTypeAny>(
  config: AgentConfig<T>,
  userPrompt: string
): Promise<z.infer<T>> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }

  // Generate tool from Zod schema
  const tool = createToolFromSchema(config.toolName, config.toolDescription, config.schema);

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

  // Create AbortController with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_GATEWAY_TIMEOUT_MS);

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
    console.error(`[agent-factory] AI Gateway error ${response.status}:`, errorText);
    
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
