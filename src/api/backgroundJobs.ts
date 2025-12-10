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

// Check if a job is stalled (no heartbeat for > 60 seconds)
export function isJobStalled(job: BackgroundJob | null): boolean {
  if (!job) return false;
  if (job.status !== 'processing' && job.status !== 'pending') return false;
  
  const updatedAt = new Date(job.updated_at).getTime();
  const now = Date.now();
  const stalledThresholdMs = 60000; // 60 seconds
  
  return now - updatedAt > stalledThresholdMs;
}

// Cancel stalled job and return true if cancelled
export async function cancelStalledJob(jobId: string): Promise<boolean> {
  const { error } = await supabase
    .from('background_jobs')
    .update({ 
      status: 'cancelled', 
      error: 'Job stalled - no heartbeat detected',
      updated_at: new Date().toISOString() 
    })
    .eq('id', jobId)
    .in('status', ['pending', 'processing']);

  return !error;
}

export async function cancelBackgroundJob(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('background_jobs')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', jobId);

  if (error) throw error;
}

// Process a single batch of NER extraction synchronously (frontend-driven pattern)
export interface NERBatchResult {
  processed: number;
  remaining: number;
  total: number;
  errors: number;
  complete?: boolean;
}

// Timeout for NER batch requests (90 seconds - edge functions can take time)
const NER_BATCH_TIMEOUT_MS = 90000;

export async function processNERBatch(
  token: string, 
  batchSize: number = 10
): Promise<NERBatchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NER_BATCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chunk-transcripts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ ner_batch: true, batch_size: batchSize }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[${response.status}] ${errorText || 'Failed to process NER batch'}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('NER batch request timed out - will retry');
    }
    throw error;
  }
}

// Legacy function - kept for backward compatibility but now uses frontend-driven pattern
export async function startNERBackfillJob(token: string): Promise<{ jobId: string }> {
  // This is now deprecated - use processNERBatch instead
  throw new Error('startNERBackfillJob is deprecated. Use processNERBatch for frontend-driven backfill.');
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
