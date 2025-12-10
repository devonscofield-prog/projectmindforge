import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { signRequest } from "../_shared/hmac.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_TTL_MINUTES = 15;
const AI_TIMEOUT_MS = 55000; // 55 second timeout for AI calls

// Zod schema for validating generate-coaching-trends response
const CoachingTrendAnalysisSchema = z.object({
  executiveSummary: z.string().optional(),
  frameworkTrends: z.object({
    meddpicc: z.object({ trend: z.string(), insight: z.string() }).optional(),
    gapSelling: z.object({ trend: z.string(), insight: z.string() }).optional(),
    activeListening: z.object({ trend: z.string(), insight: z.string() }).optional(),
  }).optional(),
  patienceTrend: z.object({
    trend: z.enum(['improving', 'declining', 'stable']),
    currentAvg: z.number().nullable().optional(),
    previousAvg: z.number().nullable().optional(),
    insight: z.string().optional(),
  }).optional(),
  strategicThreadingTrend: z.object({
    trend: z.enum(['improving', 'declining', 'stable']),
    currentAvg: z.number().nullable().optional(),
    previousAvg: z.number().nullable().optional(),
    insight: z.string().optional(),
  }).optional(),
  monologueTrend: z.object({
    trend: z.enum(['improving', 'declining', 'stable']),
    currentAvg: z.number().nullable().optional(),
    previousAvg: z.number().nullable().optional(),
    insight: z.string().optional(),
  }).optional(),
  criticalInfoPatterns: z.array(z.object({
    pattern: z.string(),
    frequency: z.string(),
    impact: z.string(),
  })).optional(),
  prioritizedActions: z.array(z.object({
    priority: z.number(),
    action: z.string(),
    rationale: z.string(),
    framework: z.string().optional(),
  })).optional(),
}).passthrough();

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 5;

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  
  // Clean up old entries (passive cleanup)
  for (const [key, val] of rateLimitMap.entries()) {
    if (now >= val.resetTime + RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(key);
    }
  }
  
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

// Structured logging helper
function log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, message, ...data };
  console[level](`[generate-aggregate-coaching-trends] ${JSON.stringify(logEntry)}`);
}

interface AggregateParams {
  scope: 'organization' | 'team' | 'rep';
  teamId?: string;
  repId?: string;
  dateRange: { from: string; to: string };
  forceRefresh?: boolean;
}

Deno.serve(async (req) => {
  const correlationId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      console.warn(`[generate-aggregate-coaching-trends] Rate limit exceeded for user ${userId}`);
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json() as AggregateParams;
    const { scope, teamId, repId, dateRange, forceRefresh } = body;

    if (!scope || !dateRange?.from || !dateRange?.to) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: scope, dateRange.from, dateRange.to' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fromDate = dateRange.from;
    const toDate = dateRange.to;
    const cacheKey = `aggregate_coaching_${scope}_${teamId || 'all'}_${fromDate}_${toDate}`;

    log('info', 'Processing request', { correlationId, scope, teamId, fromDate, toDate });

    // 1. Check cache first (unless force refresh) - 15 minute TTL
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('dashboard_cache')
        .select('cache_data, computed_at')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      
      if (cached?.cache_data) {
        console.log('[generate-aggregate-coaching-trends] Returning cached result');
        // Add cache metadata to response
        const cachedResponse = {
          ...(cached.cache_data as object),
          _cached: true,
          _cachedAt: cached.computed_at,
        };
        return new Response(JSON.stringify(cachedResponse), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log('[generate-aggregate-coaching-trends] Cache miss, generating fresh analysis...');

    // 2. Fetch rep profiles based on scope
    let repProfilesQuery;
    if (scope === 'team' && teamId) {
      repProfilesQuery = supabase
        .from('profiles')
        .select('id, name, team_id')
        .eq('team_id', teamId);
    } else {
      repProfilesQuery = supabase
        .from('user_with_role')
        .select('id, name, team_id')
        .eq('role', 'rep')
        .eq('is_active', true);
    }

    // Parallelize: fetch reps and teams
    const teamsPromise = scope === 'organization'
      ? supabase.from('teams').select('id, name')
      : Promise.resolve({ data: null, error: null });

    const [repProfilesResult, teamsResult] = await Promise.all([
      repProfilesQuery,
      teamsPromise,
    ]);

    if (repProfilesResult.error) {
      console.error('[generate-aggregate-coaching-trends] Error fetching reps:', repProfilesResult.error);
      throw new Error(`Failed to fetch reps: ${repProfilesResult.error.message}`);
    }

    const repProfiles = (repProfilesResult.data || []).map(r => ({ 
      id: r.id!, 
      name: r.name || 'Unknown', 
      team_id: r.team_id 
    }));

    const repIds = repProfiles.map(r => r.id);

    if (repIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No reps found for the selected scope' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const teamMap = new Map<string, string>();
    if (teamsResult.data) {
      teamsResult.data.forEach((t: { id: string; name: string }) => teamMap.set(t.id, t.name));
    }

    console.log(`[generate-aggregate-coaching-trends] Analyzing ${repIds.length} reps`);

    // 3. Fetch call analyses
    const fromDateTime = `${fromDate}T00:00:00.000Z`;
    const toDateTime = `${toDate}T23:59:59.999Z`;

    const { data: analysesData, error: analysesError, count } = await supabase
      .from('ai_call_analysis')
      .select('*', { count: 'exact' })
      .in('rep_id', repIds)
      .gte('created_at', fromDateTime)
      .lte('created_at', toDateTime)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (analysesError) {
      console.error('[generate-aggregate-coaching-trends] Error fetching analyses:', analysesError);
      throw new Error(`Failed to fetch call analyses: ${analysesError.message}`);
    }

    const analyses = analysesData || [];
    const callCount = count || analyses.length;

    if (analyses.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No analyzed calls found for the selected scope and period' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Calculate rep contributions
    const repContributions = calculateRepContributions(analyses, repProfiles, teamMap, callCount);

    // 5. Determine analysis tier
    const DIRECT_ANALYSIS_MAX = 30;
    const SAMPLING_MAX = 100;
    
    const tier = callCount <= DIRECT_ANALYSIS_MAX ? 'direct' 
      : callCount <= SAMPLING_MAX ? 'sampled' 
      : 'hierarchical';

    console.log(`[generate-aggregate-coaching-trends] Analysis tier: ${tier}, callCount: ${callCount}`);

    // 6. Format calls for AI - include Analysis 2.0 fields and legacy fallbacks
    const formattedCalls = analyses.map((a: Record<string, unknown>) => {
      const coachOutput = a.coach_output as Record<string, unknown> | null;
      const frameworkScores = coachOutput?.framework_scores as Record<string, unknown> | null;
      const heatSignature = coachOutput?.heat_signature as Record<string, unknown> | null;
      const dealHeat = a.deal_heat_analysis as Record<string, unknown> | null;
      
      return {
        date: (a.created_at as string).split('T')[0],
        // Analysis 2.0 fields (primary)
        analysis_behavior: a.analysis_behavior ?? null,
        analysis_strategy: a.analysis_strategy ?? null,
        // Legacy fields (fallback for backward compatibility)
        framework_scores: frameworkScores ?? null,
        meddpicc_improvements: (coachOutput?.meddpicc_improvements as string[]) ?? [],
        gap_selling_improvements: (coachOutput?.gap_selling_improvements as string[]) ?? [],
        active_listening_improvements: (coachOutput?.active_listening_improvements as string[]) ?? [],
        bant_improvements: (coachOutput?.bant_improvements as string[]) ?? [],
        critical_info_missing: (coachOutput?.critical_info_missing as unknown[]) ?? [],
        follow_up_questions: (coachOutput?.recommended_follow_up_questions as unknown[]) ?? [],
        heat_score: (dealHeat?.heat_score as number) ?? (heatSignature?.score as number) ?? null,
      };
    });

    // 7. Call generate-coaching-trends edge function for AI analysis
    let callsToAnalyze = formattedCalls;
    let samplingInfo;

    if (tier === 'sampled') {
      const { sampled, originalCount } = stratifiedSample(formattedCalls, DIRECT_ANALYSIS_MAX);
      callsToAnalyze = sampled;
      samplingInfo = {
        method: 'stratified',
        originalCount,
        sampledCount: sampled.length,
      };
      console.log(`[generate-aggregate-coaching-trends] Sampled ${sampled.length} from ${originalCount} calls`);
    }

    // For hierarchical, we still use direct analysis with sampling for now
    // (Full hierarchical would require chunk-summary calls which adds complexity)
    if (tier === 'hierarchical') {
      const { sampled, originalCount } = stratifiedSample(formattedCalls, DIRECT_ANALYSIS_MAX);
      callsToAnalyze = sampled;
      samplingInfo = {
        method: 'stratified',
        originalCount,
        sampledCount: sampled.length,
      };
      console.log(`[generate-aggregate-coaching-trends] Hierarchical downsampled to ${sampled.length} calls`);
    }

    // Call the AI edge function with timeout protection and HMAC signing
    log('info', 'Invoking generate-coaching-trends', { correlationId, callCount: callsToAnalyze.length });
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    
    let trendData;
    let trendError;
    
    try {
      // Prepare request body with correlation ID for log tracing
      const requestBody = { 
        calls: callsToAnalyze, 
        dateRange: { from: fromDate, to: toDate },
        correlationId // Pass correlation ID for observability
      };
      const bodyString = JSON.stringify(requestBody);
      
      // Sign the request with HMAC for security
      const hmacHeaders = await signRequest(bodyString, supabaseKey);
      
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-coaching-trends`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          ...hmacHeaders,
        },
        body: bodyString,
        signal: controller.signal,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        trendError = { message: `HTTP ${response.status}: ${errorText}` };
      } else {
        trendData = await response.json();
      }
    } catch (invokeErr) {
      clearTimeout(timeoutId);
      if (invokeErr instanceof Error && invokeErr.name === 'AbortError') {
        log('error', 'AI analysis timeout after 55s', { correlationId });
        throw new Error('AI trend analysis timed out. Please try with a smaller date range.');
      }
      throw invokeErr;
    } finally {
      clearTimeout(timeoutId);
    }

    if (trendError) {
      log('error', 'AI analysis error', { correlationId, error: trendError.message });
      throw new Error(`AI trend analysis failed: ${trendError.message}`);
    }

    if (!trendData || trendData.error) {
      throw new Error(trendData?.error || 'Unknown error from AI');
    }
    
    // Validate response with Zod
    const validationResult = CoachingTrendAnalysisSchema.safeParse(trendData);
    if (!validationResult.success) {
      log('warn', 'AI response schema validation failed', { 
        correlationId, 
        errors: validationResult.error.issues.slice(0, 3) 
      });
      // Continue with data but log the mismatch - don't fail the request
    } else {
      log('info', 'AI response validated successfully', { correlationId });
    }

    // 8. Build result with metadata
    const metadata = {
      tier,
      totalCalls: callCount,
      analyzedCalls: callsToAnalyze.length,
      ...(samplingInfo && { samplingInfo }),
      scope,
      teamId,
      repsIncluded: repIds.length,
      repContributions,
    };

    const result = { analysis: trendData, metadata };

    // 9. Cache the result with service role (bypasses RLS)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_MINUTES * 60 * 1000);
    
    const { error: cacheError } = await supabase.from('dashboard_cache').upsert({
      cache_key: cacheKey,
      cache_data: result,
      computed_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      metadata: { 
        source: 'generate-aggregate-coaching-trends',
        scope,
        team_id: teamId,
        reps_count: repIds.length,
        calls_count: callCount,
      }
    }, { onConflict: 'cache_key' });

    if (cacheError) {
      console.warn('[generate-aggregate-coaching-trends] Cache write failed:', cacheError);
    } else {
      console.log('[generate-aggregate-coaching-trends] Result cached successfully');
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[generate-aggregate-coaching-trends] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper: Calculate rep contributions with Analysis 2.0 metrics
function calculateRepContributions(
  analyses: Record<string, unknown>[],
  repProfiles: { id: string; name: string; team_id: string | null }[],
  teamMap: Map<string, string>,
  totalCalls: number
) {
  const repAnalyses = new Map<string, Record<string, unknown>[]>();
  analyses.forEach(a => {
    const repId = a.rep_id as string;
    const existing = repAnalyses.get(repId) || [];
    existing.push(a);
    repAnalyses.set(repId, existing);
  });

  const contributions: Array<{
    repId: string;
    repName: string;
    teamName?: string;
    callCount: number;
    percentageOfTotal: number;
    averageHeatScore: number | null;
    frameworkScores: {
      meddpicc: number | null;
      gapSelling: number | null;
      activeListening: number | null;
      bant?: number | null;
    };
    // Analysis 2.0 metrics
    analysis2_0_metrics?: {
      patienceAvg: number | null;
      strategicThreadingAvg: number | null;
      monologueViolationsAvg: number | null;
    };
  }> = [];

  repProfiles.forEach(rep => {
    const repCalls = repAnalyses.get(rep.id) || [];
    if (repCalls.length === 0) return;

    // Get heat scores - prefer deal_heat_analysis, fallback to legacy
    const heatScores = repCalls
      .map(a => {
        const dealHeat = a.deal_heat_analysis as Record<string, unknown> | null;
        if (dealHeat?.heat_score !== undefined) return dealHeat.heat_score as number;
        const coachOutput = a.coach_output as Record<string, unknown> | null;
        const heatSignature = coachOutput?.heat_signature as Record<string, unknown> | null;
        return heatSignature?.score as number | undefined;
      })
      .filter((s): s is number => s !== null && s !== undefined);
    
    const avgHeat = heatScores.length > 0 
      ? heatScores.reduce((sum, s) => sum + s, 0) / heatScores.length 
      : null;

    // Legacy framework scores
    const meddpiccScores: number[] = [];
    const bantScores: number[] = [];
    const gapScores: number[] = [];
    const listenScores: number[] = [];

    // Analysis 2.0 metrics
    const patienceScores: number[] = [];
    const strategicThreadingScores: number[] = [];
    const monologueViolationCounts: number[] = [];

    repCalls.forEach(a => {
      // Extract Analysis 2.0 metrics
      const behavior = a.analysis_behavior as Record<string, unknown> | null;
      const strategy = a.analysis_strategy as Record<string, unknown> | null;
      
      if (behavior) {
        const metrics = behavior.metrics as Record<string, unknown> | null;
        if (metrics) {
          const patience = metrics.patience as Record<string, unknown> | null;
          if (patience?.score !== undefined) patienceScores.push(patience.score as number);
          
          const monologue = metrics.monologue as Record<string, unknown> | null;
          if (monologue?.violation_count !== undefined) {
            monologueViolationCounts.push(monologue.violation_count as number);
          }
        }
      }
      
      if (strategy) {
        const threading = strategy.strategic_threading as Record<string, unknown> | null;
        if (threading?.score !== undefined) strategicThreadingScores.push(threading.score as number);
        
        // Also get MEDDPICC from Strategy analysis
        const meddpicc = strategy.meddpicc as Record<string, unknown> | null;
        if (meddpicc?.overall_score !== undefined) meddpiccScores.push(meddpicc.overall_score as number);
      }
      
      // Legacy fallback for framework scores
      const coachOutput = a.coach_output as Record<string, unknown> | null;
      const fs = coachOutput?.framework_scores as Record<string, unknown> | null;
      
      // Only use legacy MEDDPICC if no Analysis 2.0 data
      if (!strategy) {
        const legacyMeddpicc = fs?.meddpicc as Record<string, unknown> | null;
        if (legacyMeddpicc?.overall_score !== undefined) meddpiccScores.push(legacyMeddpicc.overall_score as number);
      }
      
      const bant = fs?.bant as Record<string, unknown> | null;
      const gapSelling = fs?.gap_selling as Record<string, unknown> | null;
      const activeListening = fs?.active_listening as Record<string, unknown> | null;
      
      if (bant?.score !== undefined) bantScores.push(bant.score as number);
      if (gapSelling?.score !== undefined) gapScores.push(gapSelling.score as number);
      if (activeListening?.score !== undefined) listenScores.push(activeListening.score as number);
    });

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;

    contributions.push({
      repId: rep.id,
      repName: rep.name,
      teamName: rep.team_id ? teamMap.get(rep.team_id) : undefined,
      callCount: repCalls.length,
      percentageOfTotal: (repCalls.length / totalCalls) * 100,
      averageHeatScore: avgHeat,
      frameworkScores: {
        meddpicc: avg(meddpiccScores),
        gapSelling: avg(gapScores),
        activeListening: avg(listenScores),
        bant: avg(bantScores),
      },
      // Include Analysis 2.0 metrics if available
      analysis2_0_metrics: patienceScores.length > 0 || strategicThreadingScores.length > 0 ? {
        patienceAvg: avg(patienceScores),
        strategicThreadingAvg: avg(strategicThreadingScores),
        monologueViolationsAvg: avg(monologueViolationCounts),
      } : undefined,
    });
  });

  return contributions.sort((a, b) => b.callCount - a.callCount);
}

// Helper: Stratified sampling
function stratifiedSample<T extends { date: string }>(
  calls: T[],
  targetSize: number
): { sampled: T[]; originalCount: number } {
  if (calls.length <= targetSize) {
    return { sampled: calls, originalCount: calls.length };
  }

  const weekGroups = new Map<string, T[]>();
  calls.forEach(call => {
    const date = new Date(call.date);
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    if (!weekGroups.has(weekKey)) {
      weekGroups.set(weekKey, []);
    }
    weekGroups.get(weekKey)!.push(call);
  });

  const totalCalls = calls.length;
  const sampled: T[] = [];
  
  const sortedWeeks = Array.from(weekGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  
  for (const [, weekCalls] of sortedWeeks) {
    const proportion = weekCalls.length / totalCalls;
    let sampleSize = Math.round(proportion * targetSize);
    sampleSize = Math.max(1, Math.min(sampleSize, weekCalls.length));
    
    const sorted = weekCalls.sort((a, b) => a.date.localeCompare(b.date));
    if (sampleSize >= sorted.length) {
      sampled.push(...sorted);
    } else {
      const step = sorted.length / sampleSize;
      for (let i = 0; i < sampleSize; i++) {
        sampled.push(sorted[Math.floor(i * step)]);
      }
    }
  }

  if (sampled.length > targetSize) {
    const sorted = sampled.sort((a, b) => a.date.localeCompare(b.date));
    const keepStart = Math.floor(targetSize * 0.3);
    const keepEnd = Math.floor(targetSize * 0.4);
    const result = [
      ...sorted.slice(0, keepStart),
      ...sorted.slice(sorted.length - keepEnd)
    ];
    const middle = sorted.slice(keepStart, sorted.length - keepEnd);
    const remaining = targetSize - result.length;
    const middleStep = middle.length / remaining;
    for (let i = 0; i < remaining && i * middleStep < middle.length; i++) {
      result.splice(keepStart + i, 0, middle[Math.floor(i * middleStep)]);
    }
    return { sampled: result.slice(0, targetSize), originalCount: calls.length };
  }

  return { sampled, originalCount: calls.length };
}
