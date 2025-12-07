// Database operations for analyze-call

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { AnalysisResult, ProspectData, StakeholderIntel } from './types.ts';
import type { Logger } from './logger.ts';

/**
 * Update prospect with AI-extracted intel (consolidated single query)
 */
export async function updateProspectWithIntel(
  supabaseAdmin: SupabaseClient,
  prospectId: string,
  currentProspect: ProspectData,
  analysis: AnalysisResult,
  callId: string,
  logger?: Logger
): Promise<void> {
  const prospectUpdates: Record<string, unknown> = {};
  
  // AI-extracted info
  if (analysis.prospect_intel) {
    prospectUpdates.ai_extracted_info = analysis.prospect_intel;
    
    // Auto-populate industry only if not already set
    if (analysis.prospect_intel.industry && !currentProspect.industry) {
      prospectUpdates.industry = analysis.prospect_intel.industry;
      logger?.info('Auto-populating industry', { industry: analysis.prospect_intel.industry });
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
    logger?.info('Including user counts in prospect update', { 
      it_users: userCounts.it_users, 
      end_users: userCounts.end_users, 
      ai_users: userCounts.ai_users 
    });
  }

  // Execute single consolidated prospect update
  if (Object.keys(prospectUpdates).length > 0) {
    const { error: updateProspectError } = await supabaseAdmin
      .from('prospects')
      .update(prospectUpdates)
      .eq('id', prospectId);
    
    if (updateProspectError) {
      logger?.error('Failed to update prospect', { 
        prospectId, 
        error: updateProspectError.message 
      });
    } else {
      logger?.info('Updated prospect with AI intel', { 
        prospectId, 
        fieldsUpdated: Object.keys(prospectUpdates).length 
      });
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
  stakeholdersIntel: StakeholderIntel[],
  logger?: Logger
): Promise<void> {
  logger?.info('Processing stakeholders', { 
    count: stakeholdersIntel.length, 
    mode: 'batched' 
  });
  
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
  
  // Execute batch updates using Promise.all for parallelization (better than sequential)
  if (stakeholderUpdates.length > 0) {
    const updatePromises = stakeholderUpdates.map(update =>
      supabaseAdmin
        .from('stakeholders')
        .update(update.data)
        .eq('id', update.id)
    );
    
    const results = await Promise.allSettled(updatePromises);
    const failedCount = results.filter(r => r.status === 'rejected').length;
    if (failedCount > 0) {
      logger?.warn('Some stakeholder updates failed', { failed: failedCount, total: stakeholderUpdates.length });
    }
    logger?.info('Updated existing stakeholders', { count: stakeholderUpdates.length - failedCount });
  }
  
  // Batch insert new stakeholders
  if (stakeholderInserts.length > 0) {
    const { data: newStakeholders, error: insertStakeholdersError } = await supabaseAdmin
      .from('stakeholders')
      .insert(stakeholderInserts)
      .select('id, name');
    
    if (insertStakeholdersError) {
      logger?.error('Failed to batch insert stakeholders', { 
        error: insertStakeholdersError.message 
      });
    } else if (newStakeholders) {
      logger?.info('Created new stakeholders', { count: newStakeholders.length });
      
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
      logger?.error('Failed to batch upsert mentions', { 
        error: mentionsError.message 
      });
    } else {
      logger?.info('Upserted stakeholder mentions', { count: mentionsToInsert.length });
    }
  }
  
  logger?.info('Finished processing stakeholders');
}

/**
 * Create background job record for tracking
 */
export async function createBackgroundJob(
  supabaseAdmin: SupabaseClient,
  jobType: string,
  createdBy: string,
  metadata?: Record<string, unknown>,
  logger?: Logger
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
    logger?.error('Failed to create background job', { 
      jobType, 
      error: error.message 
    });
    return null;
  }
  
  logger?.info('Created background job', { jobId: data?.id, jobType });
  return data?.id || null;
}

/**
 * Update background job status
 */
export async function updateBackgroundJobStatus(
  supabaseAdmin: SupabaseClient,
  jobId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled',
  progress?: Record<string, unknown>,
  error?: string,
  logger?: Logger
): Promise<void> {
  const updates: Record<string, unknown> = { 
    status, 
    updated_at: new Date().toISOString() 
  };
  
  if (progress) {
    updates.progress = progress;
  }
  
  if (error) {
    updates.error = error;
  }
  
  if (status === 'processing') {
    updates.started_at = new Date().toISOString();
  }
  
  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    updates.completed_at = new Date().toISOString();
  }
  
  const { error: updateError } = await supabaseAdmin
    .from('background_jobs')
    .update(updates)
    .eq('id', jobId);
  
  if (updateError) {
    logger?.error('Failed to update background job', { 
      jobId, 
      status, 
      error: updateError.message 
    });
  } else {
    logger?.info('Updated background job status', { jobId, status });
  }
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
  waitUntil: (promise: Promise<unknown>) => void,
  logger?: Logger
): Promise<void> {
  // Trigger follow-up generation if prospect exists
  if (prospectId) {
    const jobId = await createBackgroundJob(
      supabaseAdmin, 
      'follow_up_generation', 
      userId, 
      { prospect_id: prospectId, triggered_by_call: callId },
      logger
    );
    
    logger?.info('Triggering follow-up generation', { prospectId, jobId });
    waitUntil(
      fetch(`${supabaseUrl}/functions/v1/generate-account-follow-ups`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prospect_id: prospectId, job_id: jobId })
      })
      .then(async (res) => {
        if (!res.ok) {
          const errText = await res.text().catch(() => 'Unknown error');
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }
      })
      .catch(async (err) => {
        logger?.error('Failed to trigger follow-up generation', { error: String(err) });
        // Update job status to failed
        if (jobId) {
          await updateBackgroundJobStatus(supabaseAdmin, jobId, 'failed', undefined, String(err), logger);
        }
      })
    );
  }

  // Trigger transcript chunking for RAG indexing
  const chunkJobId = await createBackgroundJob(
    supabaseAdmin, 
    'transcript_chunking', 
    userId, 
    { call_id: callId },
    logger
  );
  
  logger?.info('Triggering transcript chunking', { callId, jobId: chunkJobId });
  waitUntil(
    fetch(`${supabaseUrl}/functions/v1/chunk-transcripts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ call_ids: [callId], job_id: chunkJobId })
    })
    .then(async (res) => {
      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }
    })
    .catch(async (err) => {
      logger?.error('Failed to trigger chunking', { error: String(err) });
      // Update job status to failed
      if (chunkJobId) {
        await updateBackgroundJobStatus(supabaseAdmin, chunkJobId, 'failed', undefined, String(err), logger);
      }
    })
  );
}
