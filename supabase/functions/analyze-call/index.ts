/**
 * analyze-call Edge Function - Analysis 2.0 Pipeline
 * 
 * Multi-agent analysis system with graceful error recovery:
 * - Agent 1: The Clerk (metadata extraction) - gemini-2.5-flash [CRITICAL]
 * - Agent 2: The Referee (behavioral scoring) - gemini-2.5-flash
 * - Agent 3: The Interrogator (question leverage) - gemini-2.5-flash
 * - Agent 4: The Auditor (strategy audit) - gemini-2.5-pro
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { UUID_REGEX } from './lib/constants.ts';
import { getCorsHeaders } from './lib/cors.ts';
import { 
  analyzeCallMetadata, 
  analyzeCallBehavior, 
  analyzeCallStrategy,
  analyzeQuestionLeverage,
  type CallMetadata,
  type BehaviorScore,
  type QuestionLeverage,
  type StrategyAudit,
  type MergedBehaviorScore,
} from '../_shared/analysis-agents.ts';

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

const DEFAULT_STRATEGY: StrategyAudit = {
  strategic_threading: {
    score: 0,
    grade: 'Fail',
    relevance_map: [],
    missed_opportunities: [],
  },
  critical_gaps: [],
};

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

  // Verify user
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid authentication' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Store call_id early for error handling
  let callId: string | null = null;

  try {
    // Parse and validate input
    const body = await req.json();
    callId = body.call_id;

    if (!callId || typeof callId !== 'string' || !UUID_REGEX.test(callId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid call_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[analyze-call] Starting Analysis 2.0 for call_id: ${callId}, user: ${user.id}`);

    // Fetch the transcript
    const { data: transcript, error: fetchError } = await supabaseAdmin
      .from('call_transcripts')
      .select('id, raw_text, rep_id, account_name, analysis_status')
      .eq('id', callId)
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

    // Check if already being processed (idempotency)
    if (transcript.analysis_status === 'processing') {
      console.log('[analyze-call] Already processing, skipping');
      return new Response(
        JSON.stringify({ error: 'Analysis already in progress', call_id: callId }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to processing
    const { error: statusUpdateError } = await supabaseAdmin
      .from('call_transcripts')
      .update({ analysis_status: 'processing', analysis_error: null })
      .eq('id', callId);

    if (statusUpdateError) {
      console.error('[analyze-call] Failed to update status to processing:', statusUpdateError);
    }

    const startTime = Date.now();
    const analysisWarnings: string[] = [];

    // Run ALL FOUR agents in PARALLEL with graceful error recovery
    console.log('[analyze-call] Running Clerk, Referee, Interrogator, and Auditor agents in parallel...');
    
    const [metadataSettled, behaviorSettled, questionSettled, strategySettled] = await Promise.allSettled([
      analyzeCallMetadata(transcript.raw_text),
      analyzeCallBehavior(transcript.raw_text),
      analyzeQuestionLeverage(transcript.raw_text),
      analyzeCallStrategy(transcript.raw_text),
    ]);

    // Metadata is CRITICAL - if it fails, the whole analysis fails
    if (metadataSettled.status === 'rejected') {
      const error = metadataSettled.reason instanceof Error ? metadataSettled.reason.message : String(metadataSettled.reason);
      console.error('[analyze-call] CRITICAL: Metadata agent failed:', error);
      throw new Error(`Metadata extraction failed: ${error}`);
    }
    const metadataResult: CallMetadata = metadataSettled.value;

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

    // Strategy agent - use fallback on failure
    let strategyResult: StrategyAudit;
    if (strategySettled.status === 'rejected') {
      const error = strategySettled.reason instanceof Error ? strategySettled.reason.message : String(strategySettled.reason);
      console.warn('[analyze-call] Strategy agent failed, using defaults:', error);
      analysisWarnings.push(`Strategy analysis failed: ${error}`);
      strategyResult = DEFAULT_STRATEGY;
    } else {
      strategyResult = strategySettled.value;
    }

    const analysisTime = Date.now() - startTime;
    console.log(`[analyze-call] All agents completed in ${analysisTime}ms (${analysisWarnings.length} warnings)`);
    
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

    // Check if an analysis record already exists for this call
    const { data: existingAnalysis } = await supabaseAdmin
      .from('ai_call_analysis')
      .select('id')
      .eq('call_id', callId)
      .maybeSingle();

    // Prepare the analysis data including warnings
    const analysisData = {
      analysis_metadata: metadataResult,
      analysis_behavior: behaviorResult,
      analysis_strategy: strategyResult,
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
          call_id: callId,
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
      .eq('id', callId);

    if (completeError) {
      console.error('[analyze-call] Failed to update status to completed:', completeError);
    }

    console.log(`[analyze-call] Analysis 2.0 complete for call_id: ${callId}`);

    return new Response(
      JSON.stringify({
        success: true,
        call_id: callId,
        analysis_version: 'v2',
        metadata: metadataResult,
        behavior: behaviorResult,
        strategy: strategyResult,
        processing_time_ms: analysisTime,
        warnings: analysisWarnings.length > 0 ? analysisWarnings : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[analyze-call] Error:', errorMessage);

    // Try to update transcript status to error (use stored callId instead of re-parsing)
    if (callId && UUID_REGEX.test(callId)) {
      try {
        await supabaseAdmin
          .from('call_transcripts')
          .update({ 
            analysis_status: 'error',
            analysis_error: errorMessage 
          })
          .eq('id', callId);
      } catch (e) {
        console.error('[analyze-call] Failed to update error status:', e);
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