import { z } from "zod";
import { validateSignedRequest } from "../_shared/hmac.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5; // Aligned with generate-coaching-trends

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  
  if (!entry || now >= entry.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  entry.count++;
  return { allowed: true };
}

// Zod validation schemas
const frameworkScoresSchema = z.object({
  meddpicc: z.object({ overall_score: z.number().min(0).max(100), summary: z.string() }).optional(), // New
  bant: z.object({ score: z.number().min(0).max(100), summary: z.string() }).optional(), // Legacy
  gap_selling: z.object({ score: z.number().min(0).max(100), summary: z.string() }),
  active_listening: z.object({ score: z.number().min(0).max(100), summary: z.string() })
}).nullable();

// Analysis 2.0 behavior schema
const analysisBehaviorSchema = z.object({
  metrics: z.object({
    patience: z.object({ score: z.number() }).optional(),
    strategic_threading: z.object({ score: z.number() }).optional(),
    monologue: z.object({ violation_count: z.number() }).optional(),
  }).optional(),
}).nullable().optional();

// Analysis 2.0 strategy schema  
const analysisStrategySchema = z.object({
  strategic_threading: z.object({ score: z.number() }).optional(),
}).nullable().optional();

const callDataSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  framework_scores: frameworkScoresSchema,
  meddpicc_improvements: z.array(z.string()).optional(), // New
  bant_improvements: z.array(z.string()).optional(), // Legacy
  gap_selling_improvements: z.array(z.string()),
  active_listening_improvements: z.array(z.string()),
  critical_info_missing: z.array(z.union([z.string(), z.object({ info: z.string(), missed_opportunity: z.string() })])),
  follow_up_questions: z.array(z.union([z.string(), z.object({ question: z.string(), timing_example: z.string() })])),
  heat_score: z.number().min(0).max(100).nullable(),
  // Analysis 2.0 fields
  analysis_behavior: analysisBehaviorSchema,
  analysis_strategy: analysisStrategySchema,
});

const chunkSummaryRequestSchema = z.object({
  calls: z.array(callDataSchema).min(1, "At least one call required").max(100, "Too many calls in chunk"),
  chunkIndex: z.number().int().nonnegative(),
  dateRange: z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  })
});

const CHUNK_SUMMARY_SYSTEM_PROMPT = `You are an expert sales coaching analyst. Your task is to analyze a small batch of call analyses and produce a CONDENSED SUMMARY that captures the essential patterns and trends.

This summary will be combined with other chunk summaries to form a comprehensive analysis, so focus on:
1. Key numerical averages and trends
2. Most frequent issues/patterns
3. Notable observations that should inform the final analysis

Be concise and data-driven. This is an intermediate step, not the final output.`;

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Read body once for both HMAC validation and processing
  const bodyText = await req.text();
  
  // Validate HMAC signature if present (service-to-service call)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceRoleKey && req.headers.has('X-Request-Signature')) {
    const validation = await validateSignedRequest(req.headers, bodyText, serviceRoleKey);
    if (!validation.valid) {
      console.warn('[generate-coaching-chunk-summary] Invalid HMAC signature:', validation.error);
      return new Response(
        JSON.stringify({ error: 'Invalid request signature', details: validation.error }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Parse body and extract correlation ID if present
  let body: unknown;
  let correlationId = 'unknown';
  try {
    body = JSON.parse(bodyText);
    if (typeof body === 'object' && body !== null && 'correlationId' in body) {
      correlationId = (body as { correlationId?: string }).correlationId || correlationId;
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Extract user ID from JWT for rate limiting
  const authHeader = req.headers.get('Authorization');
  let userId = 'anonymous';
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub || 'anonymous';
    } catch {
      // Use anonymous if token parsing fails
    }
  }

  // Check rate limit
  const rateLimitResult = checkRateLimit(userId);
  if (!rateLimitResult.allowed) {
    console.warn(`[generate-coaching-chunk-summary] [${correlationId}] Rate limit exceeded for user ${userId}`);
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimitResult.retryAfter || 60)
        } 
      }
    );
  }

  try {
    // body already parsed above with HMAC validation
    const validation = chunkSummaryRequestSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }));
      console.warn('[generate-coaching-chunk-summary] Validation failed:', errors);
      return new Response(
        JSON.stringify({ error: 'Validation failed', issues: errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { calls, chunkIndex, dateRange } = validation.data;

    console.log(`[generate-coaching-chunk-summary] Analyzing chunk ${chunkIndex} with ${calls.length} calls`);

    const LOVABLE_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Calculate quick stats for the prompt - MEDDPICC first, fall back to BANT
    const meddpiccScores = calls.filter(c => c.framework_scores?.meddpicc?.overall_score != null).map(c => c.framework_scores!.meddpicc!.overall_score);
    const bantScores = calls.filter(c => c.framework_scores?.bant?.score != null).map(c => c.framework_scores!.bant!.score);
    const gapScores = calls.filter(c => c.framework_scores?.gap_selling?.score != null).map(c => c.framework_scores!.gap_selling.score);
    const activeScores = calls.filter(c => c.framework_scores?.active_listening?.score != null).map(c => c.framework_scores!.active_listening.score);
    const heatScores = calls.filter(c => c.heat_score != null).map(c => c.heat_score!);

    // === Analysis 2.0 metrics extraction ===
    const patienceScores = calls
      .filter(c => c.analysis_behavior?.metrics?.patience?.score != null)
      .map(c => c.analysis_behavior!.metrics!.patience!.score);
    const strategicThreadingScores = calls
      .filter(c => c.analysis_behavior?.metrics?.strategic_threading?.score != null || c.analysis_strategy?.strategic_threading?.score != null)
      .map(c => c.analysis_behavior?.metrics?.strategic_threading?.score ?? c.analysis_strategy?.strategic_threading?.score ?? 0);
    const monologueViolations = calls
      .filter(c => c.analysis_behavior?.metrics?.monologue?.violation_count != null)
      .map(c => c.analysis_behavior!.metrics!.monologue!.violation_count);

    // Use MEDDPICC if available, otherwise fall back to BANT
    const primaryScores = meddpiccScores.length > 0 ? meddpiccScores : bantScores;
    const primaryLabel = meddpiccScores.length > 0 ? 'MEDDPICC' : 'BANT';
    const avgPrimary = primaryScores.length > 0 ? primaryScores.reduce((a, b) => a + b, 0) / primaryScores.length : null;
    const avgGap = gapScores.length > 0 ? gapScores.reduce((a, b) => a + b, 0) / gapScores.length : null;
    const avgActive = activeScores.length > 0 ? activeScores.reduce((a, b) => a + b, 0) / activeScores.length : null;
    const avgHeat = heatScores.length > 0 ? heatScores.reduce((a, b) => a + b, 0) / heatScores.length : null;
    
    // Analysis 2.0 averages
    const avgPatience = patienceScores.length > 0 ? patienceScores.reduce((a, b) => a + b, 0) / patienceScores.length : null;
    const avgStrategicThreading = strategicThreadingScores.length > 0 ? strategicThreadingScores.reduce((a, b) => a + b, 0) / strategicThreadingScores.length : null;
    const totalMonologueViolations = monologueViolations.length > 0 ? monologueViolations.reduce((a, b) => a + b, 0) : null;

    // Collect all improvement areas and missing info - MEDDPICC first, fall back to BANT
    const allMeddpiccImprovements = calls.flatMap(c => c.meddpicc_improvements || []);
    const allBantImprovements = calls.flatMap(c => c.bant_improvements || []);
    const allPrimaryImprovements = allMeddpiccImprovements.length > 0 ? allMeddpiccImprovements : allBantImprovements;
    const allGapImprovements = calls.flatMap(c => c.gap_selling_improvements);
    const allActiveImprovements = calls.flatMap(c => c.active_listening_improvements);
    const allMissingInfo = calls.flatMap(c => 
      c.critical_info_missing.map(item => typeof item === 'object' ? item.info : item)
    );

    const userPrompt = `Analyze this batch of ${calls.length} calls from ${dateRange.from} to ${dateRange.to}:

Quick Stats:
- Average ${primaryLabel} Score: ${avgPrimary?.toFixed(1) ?? 'N/A'}
- Average Gap Selling Score: ${avgGap?.toFixed(1) ?? 'N/A'}
- Average Active Listening Score: ${avgActive?.toFixed(1) ?? 'N/A'}
- Average Heat Score: ${avgHeat?.toFixed(1) ?? 'N/A'}
- Average Patience Score: ${avgPatience?.toFixed(1) ?? 'N/A'}
- Average Strategic Threading Score: ${avgStrategicThreading?.toFixed(1) ?? 'N/A'}
- Total Monologue Violations: ${totalMonologueViolations ?? 'N/A'}

${primaryLabel} Improvements Mentioned: ${allPrimaryImprovements.join('; ') || 'None'}
Gap Selling Improvements Mentioned: ${allGapImprovements.join('; ') || 'None'}
Active Listening Improvements Mentioned: ${allActiveImprovements.join('; ') || 'None'}
Critical Info Missing: ${allMissingInfo.join('; ') || 'None'}

Provide a condensed summary of this chunk's patterns and trends.`;

    // Timeout controller for AI request (55 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);
    
    let aiResponse: Response;
    try {
      aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          temperature: 0.3, // Lower temperature for consistency
          max_tokens: 4096, // Explicit token limit
          messages: [
            { role: 'system', content: CHUNK_SUMMARY_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'provide_chunk_summary',
                description: 'Provide condensed summary of this chunk of calls',
                parameters: {
                  type: 'object',
                  properties: {
                    avgScores: {
                      type: 'object',
                      properties: {
                        meddpicc: { type: 'number', nullable: true },
                        gapSelling: { type: 'number', nullable: true },
                        activeListening: { type: 'number', nullable: true },
                        heat: { type: 'number', nullable: true },
                        // Analysis 2.0 metrics
                        patienceAvg: { type: 'number', nullable: true },
                        strategicThreadingAvg: { type: 'number', nullable: true },
                        monologueViolationsTotal: { type: 'number', nullable: true }
                      },
                      required: ['meddpicc', 'gapSelling', 'activeListening', 'heat', 'patienceAvg', 'strategicThreadingAvg', 'monologueViolationsTotal']
                    },
                    dominantTrends: {
                      type: 'object',
                      properties: {
                        meddpicc: { type: 'string', enum: ['improving', 'stable', 'declining'] },
                        gapSelling: { type: 'string', enum: ['improving', 'stable', 'declining'] },
                        activeListening: { type: 'string', enum: ['improving', 'stable', 'declining'] },
                        // Analysis 2.0 trends
                        patience: { type: 'string', enum: ['improving', 'stable', 'declining'] },
                        strategicThreading: { type: 'string', enum: ['improving', 'stable', 'declining'] },
                        monologue: { type: 'string', enum: ['improving', 'stable', 'declining'] }
                      },
                      required: ['meddpicc', 'gapSelling', 'activeListening', 'patience', 'strategicThreading', 'monologue']
                    },
                    topMissingInfo: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Top 3-5 most frequently missing pieces of information'
                    },
                    topImprovementAreas: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Top 3-5 areas that need improvement across all frameworks'
                    },
                    keyObservations: {
                      type: 'array',
                      items: { type: 'string' },
                      description: '2-3 key observations about this period that should inform the overall analysis'
                    }
                  },
                  required: ['avgScores', 'dominantTrends', 'topMissingInfo', 'topImprovementAreas', 'keyObservations']
                }
              }
            }
          ],
          tool_choice: { type: 'function', function: { name: 'provide_chunk_summary' } }
        }),
        signal: controller.signal
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('[generate-coaching-chunk-summary] AI request timed out after 55 seconds');
        throw new Error('AI analysis timed out. Try with fewer calls.');
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again in a moment' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Usage limit reached, please add credits' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('[generate-coaching-chunk-summary] AI Gateway error:', aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function.name !== 'provide_chunk_summary') {
      console.error('[generate-coaching-chunk-summary] Unexpected AI response:', JSON.stringify(aiData));
      throw new Error('AI did not return expected structured output');
    }

    const chunkSummary = JSON.parse(toolCall.function.arguments);
    
    // Add metadata to the summary
    const result = {
      chunkIndex,
      dateRange,
      callCount: calls.length,
      ...chunkSummary
    };

    console.log(`[generate-coaching-chunk-summary] Chunk ${chunkIndex} analyzed successfully`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const requestId = crypto.randomUUID().slice(0, 8);
    console.error(`[generate-coaching-chunk-summary] Error ${requestId}:`, error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.', requestId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});