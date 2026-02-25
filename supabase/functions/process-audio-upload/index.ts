/**
 * process-audio-upload Edge Function
 *
 * Entry point for audio file uploads. Called AFTER the frontend has already
 * uploaded the audio file to Supabase Storage ('call-audio' bucket).
 *
 * Responsibilities:
 * 1. Validate auth (JWT) and verify audio file exists in storage
 * 2. Create database record (call_transcripts or sdr_daily_transcripts + sdr_calls)
 * 3. Return 202 immediately with created record ID
 * 4. Chain to transcribe-audio via EdgeRuntime.waitUntil() with HMAC signing
 */

import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";
import { signedFetch } from "../_shared/hmac.ts";

// Declare EdgeRuntime for Supabase Deno edge functions
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ProcessAudioUploadPayload {
  audioPath: string;          // Path in 'call-audio' bucket
  callDate: string;           // ISO date
  pipeline: 'full_cycle' | 'sdr';
  // Full-cycle specific:
  accountName?: string;
  callType?: string;
  primaryStakeholderName?: string;
  estimatedOpportunitySize?: number;
  targetCloseDate?: string;
  opportunityLabel?: string;
  managerId?: string;
  // SDR specific:
  sdrId?: string;             // If manager uploading for a rep
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ------------------------------------------------------------------
    // Auth check
    // ------------------------------------------------------------------
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[process-audio-upload] No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // User client to verify authentication
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      console.error('[process-audio-upload] User authentication failed:', userError?.message);
      return new Response(
        JSON.stringify({
          error: 'Your session has expired. Please sign in again.',
          code: 'AUTH_FAILED',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[process-audio-upload] Authenticated user:', user.id);

    // ------------------------------------------------------------------
    // Parse and validate request body
    // ------------------------------------------------------------------
    const payload: ProcessAudioUploadPayload = await req.json();

    if (!payload.audioPath || typeof payload.audioPath !== 'string' || payload.audioPath.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'audioPath is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate audioPath doesn't contain path traversal
    if (payload.audioPath.includes('..') || payload.audioPath.includes('//') || payload.audioPath.startsWith('/')) {
      return new Response(
        JSON.stringify({ error: 'Invalid audioPath: path traversal not allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.callDate || typeof payload.callDate !== 'string') {
      return new Response(
        JSON.stringify({ error: 'callDate is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (payload.pipeline !== 'full_cycle' && payload.pipeline !== 'sdr') {
      return new Response(
        JSON.stringify({ error: "pipeline must be 'full_cycle' or 'sdr'" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate optional UUID fields
    if (payload.managerId && !UUID_REGEX.test(payload.managerId)) {
      return new Response(
        JSON.stringify({ error: 'managerId must be a valid UUID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (payload.sdrId && !UUID_REGEX.test(payload.sdrId)) {
      return new Response(
        JSON.stringify({ error: 'sdrId must be a valid UUID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ------------------------------------------------------------------
    // Service client for DB writes (bypasses RLS; security via auth above)
    // ------------------------------------------------------------------
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // ------------------------------------------------------------------
    // Verify audio file exists in storage
    // ------------------------------------------------------------------
    const { data: fileData, error: fileError } = await serviceClient
      .storage
      .from('call-audio')
      .list(payload.audioPath.split('/').slice(0, -1).join('/'), {
        search: payload.audioPath.split('/').pop(),
        limit: 1,
      });

    if (fileError) {
      console.error('[process-audio-upload] Storage check failed:', fileError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to verify audio file in storage' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileName = payload.audioPath.split('/').pop() || '';
    const fileExists = fileData && fileData.some(f => f.name === fileName);

    if (!fileExists) {
      console.error('[process-audio-upload] Audio file not found at path:', payload.audioPath);
      return new Response(
        JSON.stringify({ error: 'Audio file not found in storage. Please upload the file first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[process-audio-upload] Audio file verified at:', payload.audioPath);

    // ------------------------------------------------------------------
    // Verify the audio file belongs to the authenticated user
    // (managers upload to their own folder, not the SDR's folder)
    // ------------------------------------------------------------------
    const expectedPrefix = `${user.id}/`;
    if (!payload.audioPath.startsWith(expectedPrefix)) {
      console.error('[process-audio-upload] Path ownership mismatch:', payload.audioPath, 'expected prefix:', expectedPrefix);
      return new Response(
        JSON.stringify({ error: 'Audio file path does not match authenticated user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ------------------------------------------------------------------
    // Create database record(s) based on pipeline
    // ------------------------------------------------------------------
    let transcriptId: string;
    let callId: string | undefined;

    if (payload.pipeline === 'full_cycle') {
      // ------- Full-cycle pipeline: insert into call_transcripts -------
      if (!payload.accountName || payload.accountName.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: 'accountName is required for full_cycle pipeline' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const insertData = {
        rep_id: user.id,
        call_date: payload.callDate,
        source: 'other' as const,
        raw_text: null,
        notes: null,
        analysis_status: 'processing' as const,
        upload_method: 'audio',
        audio_file_path: payload.audioPath,
        primary_stakeholder_name: payload.primaryStakeholderName || '',
        account_name: payload.accountName,
        call_type: payload.callType || null,
        manager_id: payload.managerId || null,
        estimated_opportunity_size: payload.estimatedOpportunitySize ?? null,
        target_close_date: payload.targetCloseDate || null,
        opportunity_label: payload.opportunityLabel || null,
      };

      console.log('[process-audio-upload] Inserting call_transcripts for rep:', user.id, 'account:', payload.accountName);

      const { data: transcript, error: insertError } = await serviceClient
        .from('call_transcripts')
        .insert(insertData)
        .select('id')
        .single();

      if (insertError) {
        console.error('[process-audio-upload] Insert error (call_transcripts):', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to create call transcript record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      transcriptId = transcript.id;
      console.log('[process-audio-upload] call_transcripts record created:', transcriptId);

    } else {
      // ------- SDR pipeline: insert into sdr_daily_transcripts + sdr_calls -------
      const targetSdrId = payload.sdrId || user.id;

      // Permission check: uploading for another user requires admin or sdr_manager role
      if (payload.sdrId && payload.sdrId !== user.id) {
        const { data: callerProfile } = await serviceClient
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (!callerProfile) {
          return new Response(
            JSON.stringify({ error: 'Profile not found' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const callerRole = callerProfile.role;
        if (callerRole !== 'admin') {
          if (callerRole !== 'sdr_manager') {
            return new Response(
              JSON.stringify({ error: 'You do not have permission to upload audio for other users' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          // Verify the manager actually manages this SDR
          const { data: isManager } = await serviceClient.rpc('is_sdr_manager_of', {
            manager: user.id,
            sdr: payload.sdrId,
          });
          if (!isManager) {
            return new Response(
              JSON.stringify({ error: 'You can only upload audio for SDRs on your team' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }

      // Create sdr_daily_transcripts record
      const { data: dailyTranscript, error: dailyInsertError } = await serviceClient
        .from('sdr_daily_transcripts')
        .insert({
          sdr_id: targetSdrId,
          transcript_date: payload.callDate,
          raw_text: null,
          processing_status: 'processing',
          uploaded_by: user.id,
          upload_method: 'audio',
          audio_file_path: payload.audioPath,
        })
        .select('id')
        .single();

      if (dailyInsertError) {
        // Handle unique constraint violation
        if (dailyInsertError.code === '23505') {
          return new Response(
            JSON.stringify({ error: 'An audio upload for this SDR and date is already being processed' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.error('[process-audio-upload] Insert error (sdr_daily_transcripts):', dailyInsertError);
        return new Response(
          JSON.stringify({ error: 'Failed to create daily transcript record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      transcriptId = dailyTranscript.id;
      console.log('[process-audio-upload] sdr_daily_transcripts record created:', transcriptId);

      // Create a single sdr_calls record as placeholder for the audio call
      const { data: sdrCall, error: callInsertError } = await serviceClient
        .from('sdr_calls')
        .insert({
          daily_transcript_id: transcriptId,
          sdr_id: targetSdrId,
          call_index: 1,
          raw_text: null,
          call_type: 'conversation',
          is_meaningful: true,
          analysis_status: 'pending',
        })
        .select('id')
        .single();

      if (callInsertError) {
        console.error('[process-audio-upload] Insert error (sdr_calls):', callInsertError);
        // Non-fatal: the transcript record exists and transcription can still proceed
        console.warn('[process-audio-upload] Continuing without sdr_calls record');
      } else {
        callId = sdrCall.id;
        console.log('[process-audio-upload] sdr_calls record created:', callId);
      }
    }

    // ------------------------------------------------------------------
    // Chain to transcribe-audio in the background via EdgeRuntime.waitUntil
    // ------------------------------------------------------------------
    const chainToTranscribeAudio = async () => {
      try {
        console.log('[process-audio-upload] Triggering transcribe-audio for:', transcriptId);

        const response = await signedFetch(
          `${supabaseUrl}/functions/v1/transcribe-audio`,
          {
            method: 'POST',
            body: {
              transcriptId,
              audioPath: payload.audioPath,
              pipeline: payload.pipeline,
              ...(callId ? { callId } : {}),
            },
            serviceRoleKey: supabaseServiceKey,
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[process-audio-upload] transcribe-audio call failed:', response.status, errorText);

          // Update status to error so user sees failure
          if (payload.pipeline === 'full_cycle') {
            await serviceClient
              .from('call_transcripts')
              .update({ analysis_status: 'error', analysis_error: 'Failed to start transcription' })
              .eq('id', transcriptId);
          } else {
            await serviceClient
              .from('sdr_daily_transcripts')
              .update({ processing_status: 'failed', processing_error: 'Failed to start transcription' })
              .eq('id', transcriptId);
          }
        } else {
          console.log('[process-audio-upload] transcribe-audio triggered successfully for:', transcriptId);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[process-audio-upload] Failed to trigger transcribe-audio:', errorMessage);

        // Update status to error
        if (payload.pipeline === 'full_cycle') {
          await serviceClient
            .from('call_transcripts')
            .update({ analysis_status: 'error', analysis_error: `Transcription trigger failed: ${errorMessage}` })
            .eq('id', transcriptId);
        } else {
          await serviceClient
            .from('sdr_daily_transcripts')
            .update({ processing_status: 'failed', processing_error: `Transcription trigger failed: ${errorMessage}` })
            .eq('id', transcriptId);
        }
      }
    };

    EdgeRuntime.waitUntil(chainToTranscribeAudio());

    // ------------------------------------------------------------------
    // Return 202 Accepted immediately
    // ------------------------------------------------------------------
    const responseBody: Record<string, unknown> = {
      success: true,
      message: payload.pipeline === 'full_cycle'
        ? 'Audio upload accepted. Transcription and analysis will begin shortly.'
        : 'Audio upload accepted. Transcription and grading will begin shortly.',
    };

    if (payload.pipeline === 'full_cycle') {
      responseBody.transcriptId = transcriptId;
    } else {
      responseBody.dailyTranscriptId = transcriptId;
      if (callId) {
        responseBody.callId = callId;
      }
    }

    console.log('[process-audio-upload] Returning 202 Accepted:', JSON.stringify(responseBody));

    return new Response(
      JSON.stringify(responseBody),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[process-audio-upload] Unexpected error:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
