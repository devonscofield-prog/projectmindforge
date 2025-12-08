/**
/**
 * analyze-call Edge Function - Analysis 2.0 Pipeline
 * 
 * Multi-agent analysis system with graceful error recovery:
 * - Agent 1: The Clerk (metadata extraction) - gemini-2.5-flash [CRITICAL]
 * - Agent 2: The Referee (behavioral scoring) - gemini-2.5-flash
 * - Agent 3: The Interrogator (question leverage) - gemini-2.5-flash
 * - Agent 4: The Strategist (pain-to-pitch mapping) - gemini-2.5-flash
 * - Agent 5: The Skeptic (deal gaps analysis) - gemini-2.5-pro
 * - Agent 6: The Negotiator (objection handling) - gemini-2.5-pro
 * - Agent 7: The Profiler (psychological profiling) - gemini-2.5-flash
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { UUID_REGEX } from './lib/constants.ts';
import { getCorsHeaders, checkRateLimit } from './lib/cors.ts';
import { 
  analyzeCallCensus,
  analyzeCallHistory,
  mergeCallMetadata,
  analyzeCallBehavior, 
  analyzeCallStrategy,
  analyzeQuestionLeverage,
  analyzeDealGaps,
  analyzeObjections,
  analyzePsychology,
  analyzeCompetitors,
  synthesizeCoaching,
  type CallCensus,
  type CallHistory,
  type CallMetadata,
  type BehaviorScore,
  type QuestionLeverage,
  type StrategicThreading,
  type DealGaps,
  type ObjectionHandlingData,
  type CompetitiveIntel,
  type StrategyAudit,
  type MergedBehaviorScore,
  type PsychologyProfile,
  type CoachingSynthesis,
  type ObjectionHandling,
} from '../_shared/analysis-agents.ts';

// Minimum transcript length for meaningful analysis
const MIN_TRANSCRIPT_LENGTH = 500;

// Default fallback objects for failed agents
const DEFAULT_BEHAVIOR: BehaviorScore = {
  overall_score: 0,
  grade: 'Fail',
  metrics: {
    patience: { score: 0, interruption_count: 0, status: 'Poor' },
    monologue: { score: 0, longest_turn_word_count: 0, violation_count: 0 },
    talk_listen_ratio: { score: 0, rep_talk_percentage: 0 },
    next_steps: { score: 0, secured: false, details: 'Analysis failed' },
  },
};

const DEFAULT_QUESTION_LEVERAGE: QuestionLeverage = {
  score: 0,
  explanation: 'Question analysis failed',
  average_question_length: 0,
  average_answer_length: 0,
  high_leverage_count: 0,
  low_leverage_count: 0,
  high_leverage_examples: [],
  low_leverage_examples: [],
  total_sales_questions: 0,
  yield_ratio: 0,
};

const DEFAULT_STRATEGY: StrategicThreading = {
  strategic_threading: {
    score: 0,
    grade: 'Fail',
    relevance_map: [],
    missed_opportunities: [],
  },
};

const DEFAULT_GAPS: DealGaps = {
  critical_gaps: [],
};

// Flat default for objection handling (wrapping happens during merge)
const DEFAULT_OBJECTIONS: ObjectionHandlingData = {
  score: 100,
  grade: 'Pass',
  objections_detected: [],
};

const DEFAULT_PSYCHOLOGY: PsychologyProfile = {
  prospect_persona: 'Unknown',
  disc_profile: 'Unknown' as any, // Explicitly unknown when analysis fails
  communication_style: {
    tone: 'Unknown',
    preference: 'Unknown',
  },
  dos_and_donts: {
    do: [],
    dont: [],
  },
};

const DEFAULT_COMPETITORS: CompetitiveIntel = {
  competitive_intel: [],
};

const DEFAULT_COACHING: CoachingSynthesis = {
  overall_grade: 'C',
  executive_summary: 'Coaching synthesis was not completed due to an analysis error.',
  top_3_strengths: [],
  top_3_areas_for_improvement: [],
  primary_focus_area: 'Discovery Depth',
  coaching_prescription: 'Unable to generate coaching prescription.',
  grade_reasoning: 'Analysis incomplete',
};

/**
 * Log performance metrics to the database
 */
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
    console.warn(`[analyze-call] Failed to log performance metric ${metricName}:`, err);
  }
}

/**
 * Trigger background chunking for RAG indexing
 */
async function triggerBackgroundChunking(callId: string, supabaseUrl: string, serviceKey: string): Promise<void> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/chunk-transcripts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ call_ids: [callId] }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[analyze-call] Background chunking failed for ${callId}:`, response.status, errorText);
    } else {
      console.log(`[analyze-call] Background chunking triggered for ${callId}`);
    }
  } catch (err) {
    console.warn(`[analyze-call] Failed to trigger background chunking for ${callId}:`, err);
  }
}

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Get the JWT from Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid Authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create service role client for bypassing RLS
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Check if this is an internal call using service role key
  const token = authHeader.replace('Bearer ', '');
  const isInternalCall = token === supabaseServiceKey;
  
  let userId: string;
  
  if (isInternalCall) {
    // Internal call from another edge function (e.g., reanalyze-call)
    // Skip user validation but use a system identifier for logging
    userId = 'system-internal';
    console.log('[analyze-call] Internal service call detected, bypassing user auth');
  } else {
    // External user call - verify JWT
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    userId = user.id;

    // Enforce rate limiting only for external user calls
    const rateLimitResult = checkRateLimit(userId);
    if (!rateLimitResult.allowed) {
      console.log(`[analyze-call] Rate limit exceeded for user ${userId}, retry after ${rateLimitResult.retryAfter}s`);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimitResult.retryAfter || 60),
          } 
        }
      );
    }
  }

  // Store call_id early for error handling (declared outside try block)
  let targetCallId: string | null = null;

  try {
    // Recover any stuck transcripts from previous crashes (run once per function invocation)
    try {
      const { data: recovered, error: recoverError } = await supabaseAdmin.rpc('recover_stuck_processing_transcripts');
      if (recoverError) {
        console.warn('[analyze-call] Failed to recover stuck transcripts:', recoverError.message);
      } else if (recovered && recovered.length > 0) {
        console.log(`[analyze-call] Recovered ${recovered.length} stuck transcript(s):`, recovered.map((r: any) => r.transcript_id));
      }
    } catch (recoverErr) {
      // Non-critical, log and continue
      console.warn('[analyze-call] Error recovering stuck transcripts:', recoverErr);
    }

    // Parse and validate input
    const body = await req.json();
    targetCallId = body.call_id; // Assign early for error handling

    if (!targetCallId || typeof targetCallId !== 'string' || !UUID_REGEX.test(targetCallId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid call_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[analyze-call] Starting Analysis 2.0 for call_id: ${targetCallId}, user: ${userId}`);

    // Fetch the transcript
    const { data: transcript, error: fetchError } = await supabaseAdmin
      .from('call_transcripts')
      .select('id, raw_text, rep_id, account_name, analysis_status')
      .eq('id', targetCallId)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchError) {
      console.error('[analyze-call] Failed to fetch transcript:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch transcript' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!transcript) {
      return new Response(
        JSON.stringify({ error: 'Transcript not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Input validation: Check transcript length
    if (!transcript.raw_text || transcript.raw_text.trim().length < MIN_TRANSCRIPT_LENGTH) {
      console.warn(`[analyze-call] Transcript too short: ${transcript.raw_text?.length || 0} chars (min: ${MIN_TRANSCRIPT_LENGTH})`);
      return new Response(
        JSON.stringify({ error: `Transcript too short for analysis. Minimum ${MIN_TRANSCRIPT_LENGTH} characters required.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already being processed (idempotency) - skip for forced re-analysis
    const { force_reanalyze } = body;
    if (transcript.analysis_status === 'processing' && !force_reanalyze) {
      console.log('[analyze-call] Already processing, skipping');
      return new Response(
        JSON.stringify({ error: 'Analysis already in progress', call_id: targetCallId }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to processing
    const { error: statusUpdateError } = await supabaseAdmin
      .from('call_transcripts')
      .update({ analysis_status: 'processing', analysis_error: null })
      .eq('id', targetCallId);

    if (statusUpdateError) {
      console.error('[analyze-call] Failed to update status to processing:', statusUpdateError);
    }

    const pipelineStartTime = performance.now();
    const analysisWarnings: string[] = [];
    const transcriptLength = transcript.raw_text.length;

    // Run ALL NINE agents in PARALLEL with graceful error recovery and performance tracking
    console.log('[analyze-call] Running all 9 agents in parallel: Census, Historian, Referee, Interrogator, Strategist, Skeptic, Negotiator, Profiler, Spy...');

    // Wrap each agent with timing
    const timedCensus = async () => {
      const start = performance.now();
      try {
        const result = await analyzeCallCensus(transcript.raw_text);
        await logPerformance(supabaseAdmin, 'agent_census_data', performance.now() - start, 'success', { 
          call_id: targetCallId, 
          transcript_length: transcriptLength,
          participants_count: result.participants.length,
        });
        return result;
      } catch (err) {
        await logPerformance(supabaseAdmin, 'agent_census_data', performance.now() - start, 'error', { 
          call_id: targetCallId, 
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    };

    const timedHistory = async () => {
      const start = performance.now();
      try {
        const result = await analyzeCallHistory(transcript.raw_text);
        await logPerformance(supabaseAdmin, 'agent_historian_summary', performance.now() - start, 'success', { 
          call_id: targetCallId, 
          summary_length: result.summary.length,
          topics_count: result.key_topics.length,
        });
        return result;
      } catch (err) {
        await logPerformance(supabaseAdmin, 'agent_historian_summary', performance.now() - start, 'error', { 
          call_id: targetCallId, 
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    };

    const timedBehavior = async () => {
      const start = performance.now();
      try {
        const result = await analyzeCallBehavior(transcript.raw_text);
        await logPerformance(supabaseAdmin, 'agent_referee_behavior', performance.now() - start, 'success', { 
          call_id: targetCallId,
          score: result.overall_score,
        });
        return result;
      } catch (err) {
        await logPerformance(supabaseAdmin, 'agent_referee_behavior', performance.now() - start, 'error', { 
          call_id: targetCallId, 
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    };

    const timedQuestions = async () => {
      const start = performance.now();
      try {
        const result = await analyzeQuestionLeverage(transcript.raw_text);
        await logPerformance(supabaseAdmin, 'agent_interrogator_questions', performance.now() - start, 'success', { 
          call_id: targetCallId,
          score: result.score,
          yield_ratio: result.yield_ratio,
        });
        return result;
      } catch (err) {
        await logPerformance(supabaseAdmin, 'agent_interrogator_questions', performance.now() - start, 'error', { 
          call_id: targetCallId, 
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    };

    const timedStrategy = async () => {
      const start = performance.now();
      try {
        const result = await analyzeCallStrategy(transcript.raw_text);
        await logPerformance(supabaseAdmin, 'agent_strategist_threading', performance.now() - start, 'success', { 
          call_id: targetCallId,
          threading_score: result.strategic_threading.score,
        });
        return result;
      } catch (err) {
        await logPerformance(supabaseAdmin, 'agent_strategist_threading', performance.now() - start, 'error', { 
          call_id: targetCallId, 
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    };

    const timedGaps = async () => {
      const start = performance.now();
      try {
        const result = await analyzeDealGaps(transcript.raw_text);
        await logPerformance(supabaseAdmin, 'agent_skeptic_gaps', performance.now() - start, 'success', { 
          call_id: targetCallId,
          gaps_count: result.critical_gaps.length,
        });
        return result;
      } catch (err) {
        await logPerformance(supabaseAdmin, 'agent_skeptic_gaps', performance.now() - start, 'error', { 
          call_id: targetCallId, 
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    };

    const timedObjections = async () => {
      const start = performance.now();
      try {
        const result = await analyzeObjections(transcript.raw_text);
        await logPerformance(supabaseAdmin, 'agent_negotiator_objections', performance.now() - start, 'success', { 
          call_id: targetCallId,
          objections_count: result.objections_detected.length,
          score: result.score,
        });
        return result;
      } catch (err) {
        await logPerformance(supabaseAdmin, 'agent_negotiator_objections', performance.now() - start, 'error', { 
          call_id: targetCallId, 
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    };

    const timedPsychology = async () => {
      const start = performance.now();
      try {
        const result = await analyzePsychology(transcript.raw_text);
        await logPerformance(supabaseAdmin, 'agent_profiler_psychology', performance.now() - start, 'success', { 
          call_id: targetCallId,
          disc_profile: result.disc_profile,
        });
        return result;
      } catch (err) {
        await logPerformance(supabaseAdmin, 'agent_profiler_psychology', performance.now() - start, 'error', { 
          call_id: targetCallId, 
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    };

    const timedCompetitors = async () => {
      const start = performance.now();
      try {
        const result = await analyzeCompetitors(transcript.raw_text);
        await logPerformance(supabaseAdmin, 'agent_spy_competitors', performance.now() - start, 'success', { 
          call_id: targetCallId,
          competitors_found: result.competitive_intel.length,
        });
        return result;
      } catch (err) {
        await logPerformance(supabaseAdmin, 'agent_spy_competitors', performance.now() - start, 'error', { 
          call_id: targetCallId, 
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    };
    
    const [censusSettled, historySettled, behaviorSettled, questionSettled, strategySettled, gapsSettled, objectionsSettled, psychologySettled, competitorsSettled] = await Promise.allSettled([
      timedCensus(),
      timedHistory(),
      timedBehavior(),
      timedQuestions(),
      timedStrategy(),
      timedGaps(),
      timedObjections(),
      timedPsychology(),
      timedCompetitors(),
    ]);

    // Census is CRITICAL - if it fails, the whole analysis fails (need structured data)
    if (censusSettled.status === 'rejected') {
      const error = censusSettled.reason instanceof Error ? censusSettled.reason.message : String(censusSettled.reason);
      console.error('[analyze-call] CRITICAL: Census agent failed:', error);
      throw new Error(`Structured data extraction failed: ${error}`);
    }
    const censusResult: CallCensus = censusSettled.value;

    // History is CRITICAL - if it fails, the whole analysis fails (need summary)
    if (historySettled.status === 'rejected') {
      const error = historySettled.reason instanceof Error ? historySettled.reason.message : String(historySettled.reason);
      console.error('[analyze-call] CRITICAL: Historian agent failed:', error);
      throw new Error(`Summary generation failed: ${error}`);
    }
    const historyResult: CallHistory = historySettled.value;

    // Merge Census + History into CallMetadata for backward compatibility
    const metadataResult: CallMetadata = mergeCallMetadata(censusResult, historyResult);

    // Behavior agent - use fallback on failure
    let behaviorBase: BehaviorScore;
    if (behaviorSettled.status === 'rejected') {
      const error = behaviorSettled.reason instanceof Error ? behaviorSettled.reason.message : String(behaviorSettled.reason);
      console.warn('[analyze-call] Behavior agent failed, using defaults:', error);
      analysisWarnings.push(`Behavior analysis failed: ${error}`);
      behaviorBase = DEFAULT_BEHAVIOR;
    } else {
      behaviorBase = behaviorSettled.value;
    }

    // Question leverage agent - use fallback on failure
    let questionQuality: QuestionLeverage;
    if (questionSettled.status === 'rejected') {
      const error = questionSettled.reason instanceof Error ? questionSettled.reason.message : String(questionSettled.reason);
      console.warn('[analyze-call] Question leverage agent failed, using defaults:', error);
      analysisWarnings.push(`Question analysis failed: ${error}`);
      questionQuality = DEFAULT_QUESTION_LEVERAGE;
    } else {
      questionQuality = questionSettled.value;
    }

    // Strategy agent (threading only) - use fallback on failure
    let strategyThreading: StrategicThreading;
    if (strategySettled.status === 'rejected') {
      const error = strategySettled.reason instanceof Error ? strategySettled.reason.message : String(strategySettled.reason);
      console.warn('[analyze-call] Strategy agent failed, using defaults:', error);
      analysisWarnings.push(`Strategy analysis failed: ${error}`);
      strategyThreading = DEFAULT_STRATEGY;
    } else {
      strategyThreading = strategySettled.value;
    }

    // Gaps agent (The Skeptic) - use fallback on failure
    let gapsResult: DealGaps;
    if (gapsSettled.status === 'rejected') {
      const error = gapsSettled.reason instanceof Error ? gapsSettled.reason.message : String(gapsSettled.reason);
      console.warn('[analyze-call] Gaps agent failed, using defaults:', error);
      analysisWarnings.push(`Deal gaps analysis failed: ${error}`);
      gapsResult = DEFAULT_GAPS;
    } else {
      gapsResult = gapsSettled.value;
    }

    // Objections agent (The Negotiator) - use fallback on failure
    // Returns flat ObjectionHandlingData, wrapped during merge
    let objectionsResult: ObjectionHandlingData;
    if (objectionsSettled.status === 'rejected') {
      const error = objectionsSettled.reason instanceof Error ? objectionsSettled.reason.message : String(objectionsSettled.reason);
      console.warn('[analyze-call] Objections agent failed, using defaults:', error);
      analysisWarnings.push(`Objection handling analysis failed: ${error}`);
      objectionsResult = DEFAULT_OBJECTIONS;
    } else {
      objectionsResult = objectionsSettled.value;
    }

    // Psychology agent (The Profiler) - use fallback on failure
    let psychologyResult: PsychologyProfile;
    if (psychologySettled.status === 'rejected') {
      const error = psychologySettled.reason instanceof Error ? psychologySettled.reason.message : String(psychologySettled.reason);
      console.warn('[analyze-call] Psychology agent failed, using defaults:', error);
      analysisWarnings.push(`Psychology profiling failed: ${error}`);
      psychologyResult = DEFAULT_PSYCHOLOGY;
    } else {
      psychologyResult = psychologySettled.value;
    }

    // Competitors agent (The Spy) - use fallback on failure
    let competitorsResult: CompetitiveIntel;
    if (competitorsSettled.status === 'rejected') {
      const error = competitorsSettled.reason instanceof Error ? competitorsSettled.reason.message : String(competitorsSettled.reason);
      console.warn('[analyze-call] Competitors agent failed, using defaults:', error);
      analysisWarnings.push(`Competitive intelligence failed: ${error}`);
      competitorsResult = DEFAULT_COMPETITORS;
    } else {
      competitorsResult = competitorsSettled.value;
    }

    // Combine strategy threading, gaps, objections, and competitors into full StrategyAudit for storage
    // Wrap flat objectionsResult in objection_handling key here
    const strategyResult: StrategyAudit = {
      ...strategyThreading,
      ...gapsResult,
      ...competitorsResult,
      objection_handling: objectionsResult,
    };

    const phase1Duration = performance.now() - pipelineStartTime;
    console.log(`[analyze-call] Phase 1 (9 parallel agents) completed in ${Math.round(phase1Duration)}ms (${analysisWarnings.length} warnings)`);
    
    // Merge question quality into behavior result to create MergedBehaviorScore
    const behaviorResult: MergedBehaviorScore = {
      ...behaviorBase,
      overall_score: behaviorBase.overall_score + questionQuality.score, // Add question score (max 20) to base (max 80)
      grade: (behaviorBase.overall_score + questionQuality.score) >= 60 ? 'Pass' : 'Fail',
      metrics: {
        ...behaviorBase.metrics,
        question_quality: questionQuality, // Inject dedicated agent's analysis
      },
    };
    
    console.log(`[analyze-call] Scores - Behavior: ${behaviorResult.overall_score} (base: ${behaviorBase.overall_score}, questions: ${questionQuality.score}), Threading: ${strategyResult.strategic_threading.score}, Critical Gaps: ${strategyResult.critical_gaps.length}`);

    // ============= PHASE 2: THE COACH (Sequential Synthesis) =============
    console.log('[analyze-call] Phase 2: Running The Coach (synthesis agent)...');
    const phase2Start = performance.now();
    
    let coachingResult: CoachingSynthesis;
    try {
      // Wrap objectionsResult for The Coach input
      const wrappedObjections: ObjectionHandling = { objection_handling: objectionsResult };
      
      coachingResult = await synthesizeCoaching({
        metadata: metadataResult,
        behavior: behaviorResult,
        questions: questionQuality,
        strategy: strategyThreading,
        gaps: gapsResult,
        objections: wrappedObjections,
        psychology: psychologyResult,
        competitors: competitorsResult,
      });
      
      const phase2Duration = performance.now() - phase2Start;
      await logPerformance(supabaseAdmin, 'agent_coach_synthesis', phase2Duration, 'success', { 
        call_id: targetCallId,
        overall_grade: coachingResult.overall_grade,
        primary_focus_area: coachingResult.primary_focus_area,
      });
      console.log(`[analyze-call] Phase 2 completed in ${Math.round(phase2Duration)}ms, Grade: ${coachingResult.overall_grade}, Focus: ${coachingResult.primary_focus_area}`);
    } catch (coachErr) {
      const error = coachErr instanceof Error ? coachErr.message : String(coachErr);
      console.warn('[analyze-call] The Coach agent failed, using defaults:', error);
      analysisWarnings.push(`Coaching synthesis failed: ${error}`);
      await logPerformance(supabaseAdmin, 'agent_coach_synthesis', performance.now() - phase2Start, 'error', { 
        call_id: targetCallId, 
        error,
      });
      coachingResult = DEFAULT_COACHING;
    }

    const pipelineDuration = performance.now() - pipelineStartTime;
    console.log(`[analyze-call] Full pipeline completed in ${Math.round(pipelineDuration)}ms (Phase 1: ${Math.round(phase1Duration)}ms, Phase 2: ${Math.round(pipelineDuration - phase1Duration)}ms)`);

    // Check if an analysis record already exists for this call
    const { data: existingAnalysis } = await supabaseAdmin
      .from('ai_call_analysis')
      .select('id')
      .eq('call_id', targetCallId)
      .maybeSingle();

    // Prepare the analysis data including warnings and coaching
    const analysisData = {
      analysis_metadata: metadataResult,
      analysis_behavior: behaviorResult,
      analysis_strategy: strategyResult,
      analysis_psychology: psychologyResult,
      analysis_coaching: coachingResult,
      analysis_pipeline_version: 'v2',
      call_summary: metadataResult.summary,
      // Store warnings in raw_json for debugging/transparency
      raw_json: analysisWarnings.length > 0 ? { analysis_warnings: analysisWarnings } : null,
    };

    if (existingAnalysis) {
      // Update existing record
      const { error: updateError } = await supabaseAdmin
        .from('ai_call_analysis')
        .update(analysisData)
        .eq('id', existingAnalysis.id);

      if (updateError) {
        console.error('[analyze-call] Failed to update analysis:', updateError);
        throw new Error('Failed to save analysis results');
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabaseAdmin
        .from('ai_call_analysis')
        .insert({
          call_id: targetCallId,
          rep_id: transcript.rep_id,
          model_name: 'google/gemini-2.5-flash,google/gemini-2.5-pro',
          ...analysisData,
        });

      if (insertError) {
        console.error('[analyze-call] Failed to insert analysis:', insertError);
        throw new Error('Failed to save analysis results');
      }
    }

    // Update transcript status to completed
    const { error: completeError } = await supabaseAdmin
      .from('call_transcripts')
      .update({ 
        analysis_status: 'completed',
        analysis_version: 'v2'
      })
      .eq('id', targetCallId);

    if (completeError) {
      console.error('[analyze-call] Failed to update status to completed:', completeError);
    }

    // Log overall pipeline performance
    await logPerformance(supabaseAdmin, 'analyze_call_pipeline', pipelineDuration, 'success', {
      call_id: targetCallId,
      transcript_length: transcriptLength,
      warnings_count: analysisWarnings.length,
      behavior_score: behaviorResult.overall_score,
      threading_score: strategyResult.strategic_threading.score,
      overall_grade: coachingResult.overall_grade,
    });

    console.log(`[analyze-call] Analysis 2.0 complete for call_id: ${targetCallId}, Grade: ${coachingResult.overall_grade}`);

    // Trigger background chunking for RAG indexing (non-blocking)
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(triggerBackgroundChunking(targetCallId, supabaseUrl, supabaseServiceKey));

    return new Response(
      JSON.stringify({
        success: true,
        call_id: targetCallId,
        analysis_version: 'v2',
        metadata: metadataResult,
        behavior: behaviorResult,
        strategy: strategyResult,
        psychology: psychologyResult,
        coaching: coachingResult,
        processing_time_ms: Math.round(pipelineDuration),
        warnings: analysisWarnings.length > 0 ? analysisWarnings : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[analyze-call] Error:', errorMessage);

    // Update transcript status to error using stored targetCallId (no re-parsing needed)
    if (targetCallId && UUID_REGEX.test(targetCallId)) {
      try {
        const { error: statusErr } = await supabaseAdmin
          .from('call_transcripts')
          .update({ 
            analysis_status: 'error',
            analysis_error: errorMessage 
          })
          .eq('id', targetCallId);
        
        if (statusErr) {
          console.error('[analyze-call] Failed to update error status:', statusErr);
        }
      } catch (e) {
        console.error('[analyze-call] Exception updating error status:', e);
      }
    }

    // Return appropriate error response
    const isRateLimit = errorMessage.includes('Rate limit');
    const isCredits = errorMessage.includes('credits');
    const isTimeout = errorMessage.includes('timeout');

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: isRateLimit ? 429 : isCredits ? 402 : isTimeout ? 504 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});