// Database operations for analyze-call

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { AnalysisResult, ProspectData, StakeholderIntel } from './types.ts';

/**
 * Update prospect with AI-extracted intel (consolidated single query)
 */
export async function updateProspectWithIntel(
  supabaseAdmin: SupabaseClient,
  prospectId: string,
  currentProspect: ProspectData,
  analysis: AnalysisResult,
  callId: string
): Promise<void> {
  const prospectUpdates: Record<string, unknown> = {};
  
  // AI-extracted info
  if (analysis.prospect_intel) {
    prospectUpdates.ai_extracted_info = analysis.prospect_intel;
    
    // Auto-populate industry only if not already set
    if (analysis.prospect_intel.industry && !currentProspect.industry) {
      prospectUpdates.industry = analysis.prospect_intel.industry;
      console.log(`[analyze-call] Auto-populating industry: ${analysis.prospect_intel.industry}`);
    }
  }
  
  // Suggested follow-ups from coaching
  if (analysis.coach_output?.recommended_follow_up_questions) {
    prospectUpdates.suggested_follow_ups = analysis.coach_output.recommended_follow_up_questions;
  }
  
  // Heat score
  if (analysis.coach_output?.heat_signature?.score) {
    prospectUpdates.heat_score = analysis.coach_output.heat_signature.score;
  }

  // Auto-populate opportunity_details with user counts if extracted
  const userCounts = analysis.prospect_intel?.user_counts;
  if (userCounts && (userCounts.it_users || userCounts.end_users || userCounts.ai_users)) {
    const currentDetails = (currentProspect.opportunity_details as Record<string, unknown>) || {};
    prospectUpdates.opportunity_details = {
      ...currentDetails,
      it_users_count: userCounts.it_users || currentDetails.it_users_count,
      end_users_count: userCounts.end_users || currentDetails.end_users_count,
      ai_users_count: userCounts.ai_users || currentDetails.ai_users_count,
      auto_populated_from: {
        source: 'transcript' as const,
        source_id: callId,
        extracted_at: new Date().toISOString(),
      },
    };
    console.log('[analyze-call] Including user counts in prospect update');
  }

  // Execute single consolidated prospect update
  if (Object.keys(prospectUpdates).length > 0) {
    const { error: updateProspectError } = await supabaseAdmin
      .from('prospects')
      .update(prospectUpdates)
      .eq('id', prospectId);
    
    if (updateProspectError) {
      console.error('[analyze-call] Failed to update prospect:', updateProspectError);
    } else {
      console.log(`[analyze-call] Updated prospect ${prospectId} with AI intel (single query)`);
    }
  }
}

/**
 * Process stakeholders in batches (batch fetch, batch insert, batch upsert mentions)
 */
export async function processStakeholdersBatched(
  supabaseAdmin: SupabaseClient,
  prospectId: string,
  repId: string,
  callId: string,
  stakeholdersIntel: StakeholderIntel[]
): Promise<void> {
  console.log(`[analyze-call] Processing ${stakeholdersIntel.length} stakeholders (batched)`);
  
  // Single query to get all existing stakeholders for this prospect
  const { data: existingStakeholders } = await supabaseAdmin
    .from('stakeholders')
    .select('id, name')
    .eq('prospect_id', prospectId)
    .is('deleted_at', null);
  
  // Create lookup map (lowercase name -> id)
  const existingMap = new Map<string, string>();
  if (existingStakeholders) {
    for (const s of existingStakeholders) {
      existingMap.set(s.name.toLowerCase(), s.id);
    }
  }
  
  // Separate into updates and inserts
  const stakeholderUpdates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const stakeholderInserts: Array<Record<string, unknown>> = [];
  const mentionsToInsert: Array<{ call_id: string; stakeholder_id: string; was_present: boolean; context_notes: string | null }> = [];
  
  for (const intel of stakeholdersIntel) {
    if (!intel.name) continue;
    
    const existingId = existingMap.get(intel.name.toLowerCase());
    const baseData = {
      job_title: intel.job_title || null,
      influence_level: intel.influence_level || 'light_influencer',
      champion_score: intel.champion_score || null,
      champion_score_reasoning: intel.champion_score_reasoning || null,
      ai_extracted_info: intel.ai_notes ? { notes: intel.ai_notes } : null,
      last_interaction_date: new Date().toISOString().split('T')[0],
    };
    
    if (existingId) {
      stakeholderUpdates.push({ id: existingId, data: baseData });
      // Queue mention
      if (intel.was_present !== false) {
        mentionsToInsert.push({
          call_id: callId,
          stakeholder_id: existingId,
          was_present: intel.was_present ?? true,
          context_notes: intel.ai_notes || null,
        });
      }
    } else {
      stakeholderInserts.push({
        prospect_id: prospectId,
        rep_id: repId,
        name: intel.name,
        ...baseData,
        is_primary_contact: false,
      });
    }
  }
  
  // Execute batch updates (can't truly batch updates, but at least we minimize queries)
  for (const update of stakeholderUpdates) {
    await supabaseAdmin
      .from('stakeholders')
      .update(update.data)
      .eq('id', update.id);
  }
  console.log(`[analyze-call] Updated ${stakeholderUpdates.length} existing stakeholders`);
  
  // Batch insert new stakeholders
  if (stakeholderInserts.length > 0) {
    const { data: newStakeholders, error: insertStakeholdersError } = await supabaseAdmin
      .from('stakeholders')
      .insert(stakeholderInserts)
      .select('id, name');
    
    if (insertStakeholdersError) {
      console.error('[analyze-call] Failed to batch insert stakeholders:', insertStakeholdersError);
    } else if (newStakeholders) {
      console.log(`[analyze-call] Created ${newStakeholders.length} new stakeholders`);
      
      // Queue mentions for new stakeholders
      for (const newS of newStakeholders) {
        const intel = stakeholdersIntel.find(i => i.name?.toLowerCase() === newS.name.toLowerCase());
        if (intel && intel.was_present !== false) {
          mentionsToInsert.push({
            call_id: callId,
            stakeholder_id: newS.id,
            was_present: intel.was_present ?? true,
            context_notes: intel.ai_notes || null,
          });
        }
      }
    }
  }
  
  // Batch upsert all call_stakeholder_mentions
  if (mentionsToInsert.length > 0) {
    const { error: mentionsError } = await supabaseAdmin
      .from('call_stakeholder_mentions')
      .upsert(mentionsToInsert, { onConflict: 'call_id,stakeholder_id' });
    
    if (mentionsError) {
      console.error('[analyze-call] Failed to batch upsert mentions:', mentionsError);
    } else {
      console.log(`[analyze-call] Upserted ${mentionsToInsert.length} stakeholder mentions`);
    }
  }
  
  console.log(`[analyze-call] Finished processing stakeholders`);
}

/**
 * Create background job record for tracking
 */
export async function createBackgroundJob(
  supabaseAdmin: SupabaseClient,
  jobType: string,
  createdBy: string,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('background_jobs')
    .insert({
      job_type: jobType,
      status: 'pending',
      created_by: createdBy,
      progress: metadata ? { metadata } : null
    })
    .select('id')
    .single();
  
  if (error) {
    console.error(`[analyze-call] Failed to create background job: ${error.message}`);
    return null;
  }
  return data?.id || null;
}

/**
 * Trigger background tasks (follow-ups and chunking) with job tracking
 */
export async function triggerBackgroundTasks(
  supabaseAdmin: SupabaseClient,
  supabaseUrl: string,
  supabaseServiceKey: string,
  prospectId: string | null,
  callId: string,
  userId: string,
  waitUntil: (promise: Promise<unknown>) => void
): Promise<void> {
  // Trigger follow-up generation if prospect exists
  if (prospectId) {
    const jobId = await createBackgroundJob(supabaseAdmin, 'follow_up_generation', userId, {
      prospect_id: prospectId,
      triggered_by_call: callId
    });
    
    console.log(`[analyze-call] Triggering follow-up generation for prospect: ${prospectId} (job: ${jobId})`);
    waitUntil(
      fetch(`${supabaseUrl}/functions/v1/generate-account-follow-ups`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prospect_id: prospectId, job_id: jobId })
      }).catch(err => console.error('[analyze-call] Failed to trigger follow-up generation:', err))
    );
  }

  // Trigger transcript chunking for RAG indexing
  const chunkJobId = await createBackgroundJob(supabaseAdmin, 'transcript_chunking', userId, {
    call_id: callId
  });
  
  console.log(`[analyze-call] Triggering transcript chunking for call: ${callId} (job: ${chunkJobId})`);
  waitUntil(
    fetch(`${supabaseUrl}/functions/v1/chunk-transcripts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ call_ids: [callId], job_id: chunkJobId })
    }).catch(err => console.error('[analyze-call] Failed to trigger chunking:', err))
  );
}
