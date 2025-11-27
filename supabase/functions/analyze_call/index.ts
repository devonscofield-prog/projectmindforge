import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  // Create service role client for bypassing RLS when writing analysis
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  
  // Create user client for RLS-based access checks
  const authHeader = req.headers.get('Authorization');
  const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader || '' } }
  });

  let callId: string | null = null;

  try {
    const { call_id } = await req.json();
    callId = call_id;

    if (!callId) {
      return new Response(
        JSON.stringify({ error: 'call_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[analyze_call] Starting analysis for call_id: ${callId}`);

    // Step 1: Fetch the call transcript using user's RLS context (validates access)
    const { data: transcript, error: fetchError } = await supabaseUser
      .from('call_transcripts')
      .select('*')
      .eq('id', callId)
      .maybeSingle();

    if (fetchError) {
      console.error(`[analyze_call] Error fetching transcript:`, fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch call transcript', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!transcript) {
      console.warn(`[analyze_call] Transcript not found or access denied for call_id: ${callId}`);
      return new Response(
        JSON.stringify({ error: 'Call transcript not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[analyze_call] Transcript found for rep_id: ${transcript.rep_id}`);

    // Step 2: Update status to 'processing'
    const { error: updateProcessingError } = await supabaseAdmin
      .from('call_transcripts')
      .update({ analysis_status: 'processing', analysis_error: null })
      .eq('id', callId);

    if (updateProcessingError) {
      console.error(`[analyze_call] Error updating status to processing:`, updateProcessingError);
    }

    // Step 3: Build mock analysis (placeholder for real AI call later)
    const mockAnalysis = buildMockAnalysis(transcript);

    console.log(`[analyze_call] Mock analysis generated`);

    // Step 4: Insert analysis row
    const { data: analysisResult, error: insertError } = await supabaseAdmin
      .from('ai_call_analysis')
      .insert({
        call_id: callId,
        rep_id: transcript.rep_id,
        model_name: 'mock-v1',
        prompt_version: 1,
        confidence: 'medium',
        ...mockAnalysis
      })
      .select()
      .single();

    if (insertError) {
      console.error(`[analyze_call] Error inserting analysis:`, insertError);
      
      // Update transcript with error status
      await supabaseAdmin
        .from('call_transcripts')
        .update({ 
          analysis_status: 'error', 
          analysis_error: insertError.message 
        })
        .eq('id', callId);

      return new Response(
        JSON.stringify({ error: 'Failed to save analysis', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 5: Update status to 'completed'
    const { error: updateCompletedError } = await supabaseAdmin
      .from('call_transcripts')
      .update({ analysis_status: 'completed' })
      .eq('id', callId);

    if (updateCompletedError) {
      console.error(`[analyze_call] Error updating status to completed:`, updateCompletedError);
    }

    console.log(`[analyze_call] Analysis completed successfully for call_id: ${callId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis_id: analysisResult.id,
        message: 'Analysis completed successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[analyze_call] Unexpected error:`, error);

    // If we have a callId, try to update status to error
    if (callId) {
      try {
        await supabaseAdmin
          .from('call_transcripts')
          .update({ 
            analysis_status: 'error', 
            analysis_error: error instanceof Error ? error.message : 'Unknown error' 
          })
          .eq('id', callId);
      } catch (updateErr) {
        console.error(`[analyze_call] Failed to update error status:`, updateErr);
      }
    }

    return new Response(
      JSON.stringify({ 
        error: 'Analysis failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Build a mock analysis object for testing the pipeline.
 * This will be replaced with real AI analysis later.
 */
function buildMockAnalysis(transcript: any) {
  const rawTextLength = transcript.raw_text?.length || 0;
  const estimatedDuration = Math.floor(rawTextLength / 15); // rough estimate

  return {
    // Summary & metadata (Category 1)
    call_summary: `This is a mock summary of a ${transcript.source} call. The transcript contains ${rawTextLength} characters of conversation.`,
    call_type: 'discovery',
    customer_persona: 'mid-market decision maker',
    key_topics: ['product features', 'pricing', 'implementation timeline'],
    next_steps_mentioned: ['follow-up demo', 'send proposal'],
    pain_points: ['current solution is too slow', 'lacks reporting capabilities'],
    key_quotes: [
      { speaker: 'customer', quote: 'We need something that scales with our growth.' },
      { speaker: 'rep', quote: 'Our platform handles that seamlessly.' }
    ],
    estimated_duration_seconds: estimatedDuration,
    speaker_stats: { rep_talk_pct: 55, customer_talk_pct: 45 },

    // Discovery (Category 2)
    discovery_score: 72,
    discovery_num_questions: 8,
    discovery_depth_notes: 'Good initial discovery but missed opportunity to dig deeper on budget timeline.',
    discovery_missed_opportunities: ['Did not ask about decision-making process', 'Could have explored competitor usage'],
    discovery_good_examples: ['Great open-ended question about current workflow', 'Followed up on pain point effectively'],
    discovery_improvement_suggestions: 'Try to uncover the business impact of current pain points with specific metrics.',

    // Objection Handling (Category 3)
    objection_score: 65,
    objections_raised: [
      { objection: 'Price seems high', response: 'Acknowledged value proposition', outcome: 'partially_addressed' }
    ],
    objection_quality_notes: 'Handled pricing objection but could have been more specific about ROI.',
    objection_missed_opportunities: ['Did not proactively address implementation concerns'],
    objection_good_examples: ['Good reframe on timeline concern'],
    objection_needs_work_examples: ['Dismissed budget concern too quickly'],
    objection_improvement_suggestions: 'Use the AAA model: Acknowledge, Ask, Answer.',
    used_aaa_model: false,

    // Rapport & Communication (Category 4)
    rapport_score: 78,
    tone_notes: 'Professional and friendly tone throughout. Good energy matching with the customer.',
    rapport_strengths: ['Active listening cues', 'Personalized examples'],
    rapport_opportunities: ['Could use more customer name usage', 'Mirror language more'],
    talk_listen_ratio: { rep: 55, customer: 45, ideal: { rep: 40, customer: 60 } },
    communication_good_examples: ['Great summary at the end of each topic'],
    communication_needs_work_examples: ['Interrupted customer twice'],

    // Product Knowledge (Category 5)
    product_knowledge_score: 80,
    product_positioning_notes: 'Strong positioning against competitors. Accurate feature descriptions.',
    product_knowledge_gaps: ['Unsure about API rate limits'],
    product_knowledge_strengths: ['Clear explanation of core value prop', 'Good use case examples'],
    product_knowledge_opportunities: ['Could highlight more differentiated features'],
    product_knowledge_improvement_suggestions: 'Review latest product updates before calls.',

    // Deal Gaps & Missed Opportunities (Category 6)
    critical_missing_info: ['Budget range', 'Decision timeline', 'Other stakeholders involved'],
    unresolved_objections: ['ROI justification'],
    open_customer_questions: ['Integration with existing CRM'],
    missed_deal_opportunities: ['Did not ask for next meeting'],
    explicit_followups_from_call: ['Send pricing deck', 'Schedule technical demo'],

    // Scoring & Tags (Categories 7 & 8)
    deal_advancement_score: 70,
    call_effectiveness_score: 73,
    skill_tags: ['discovery', 'rapport-building', 'needs-objection-handling-training'],
    deal_tags: ['mid-funnel', 'pricing-discussion', 'multi-stakeholder'],
    meta_tags: ['first-call', 'inbound-lead']
  };
}
