import { supabase } from '@/integrations/supabase/client';

export interface BackgroundJob {
  id: string;
  job_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: {
    processed?: number;
    total?: number;
    errors?: number;
    current_batch?: number;
    message?: string;
  };
  error: string | null;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchBackgroundJob(jobId: string): Promise<BackgroundJob | null> {
  const { data, error } = await supabase
    .from('background_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (error) throw error;
  return data as BackgroundJob | null;
}

export async function fetchActiveJob(jobType: string): Promise<BackgroundJob | null> {
  const { data, error } = await supabase
    .from('background_jobs')
    .select('*')
    .eq('job_type', jobType)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as BackgroundJob | null;
}

export async function cancelBackgroundJob(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('background_jobs')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', jobId);

  if (error) throw error;
}

export async function startNERBackfillJob(token: string): Promise<{ jobId: string }> {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chunk-transcripts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ backfill_entities: true }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to start NER backfill job');
  }

  const result = await response.json();
  return { jobId: result.job_id };
}

export async function startEmbeddingsBackfillJob(token: string): Promise<{ jobId: string }> {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chunk-transcripts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ backfill_embeddings: true }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to start embeddings backfill job');
  }

  const result = await response.json();
  return { jobId: result.job_id };
}

export async function startFullReindexJob(token: string): Promise<{ jobId: string }> {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chunk-transcripts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ full_reindex: true }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to start full reindex job');
  }

  const result = await response.json();
  return { jobId: result.job_id };
}
