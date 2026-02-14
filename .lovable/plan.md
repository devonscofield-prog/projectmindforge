
# Fix: Embedding Backfill Stalling Due to Edge Function Timeout

## Root Cause

The embedding backfill uses `EdgeRuntime.waitUntil()` to run a long-lived background loop inside a single edge function invocation. This loop processes chunks one at a time with 500ms delays between each. For 8,542 chunks, this requires a minimum of ~71 minutes of wall-clock time (not counting API call latency). Edge functions have a hard wall-clock limit and silently terminate, leaving the job stuck in "processing" forever.

This is the same problem that was already solved for NER backfill -- NER was converted to a **frontend-driven batch pattern** where the browser loops through small synchronous batches. Embeddings backfill was never migrated to this pattern.

## Solution

Convert the embedding backfill from `EdgeRuntime.waitUntil()` background processing to the same **frontend-driven batch pattern** used by NER backfill. Each call processes a small batch (e.g., 10 embeddings), returns progress, and the frontend loops until complete.

## Changes

### 1. Edge Function: Add `embedding_batch` mode (`supabase/functions/chunk-transcripts/index.ts`)

Add a new request mode alongside the existing `ner_batch`:

- Accept `embedding_batch: true` and optional `batch_size` (default 10, max 50)
- Query chunks where `embedding IS NULL`, limited to batch size
- Generate embeddings synchronously for the batch
- Return `{ processed, remaining, total, errors, complete }` -- same shape as NER batch responses

This replaces the `backfill_embeddings` + `EdgeRuntime.waitUntil()` path.

### 2. Frontend API: Add `processEmbeddingBatch` function (`src/api/backgroundJobs.ts`)

Create a new function mirroring `processNERBatch`:

- Calls the edge function with `{ embedding_batch: true, batch_size: 10 }`
- Has a 90-second timeout
- Returns the same `{ processed, remaining, total, errors, complete }` shape

### 3. Frontend Hook: Convert embedding backfill to loop pattern (`src/pages/admin/transcript-analysis/useTranscriptAnalysis.ts`)

Replace `startEmbeddingsBackfillJob` usage with a frontend loop that:

- Calls `processEmbeddingBatch` repeatedly
- Updates progress state between batches
- Stops when `complete === true` or on error
- Supports cancellation via a ref flag

### 4. Schema Update (`supabase/functions/chunk-transcripts/index.ts`)

Add `embedding_batch` to the Zod validation schema's `.refine()` check.

### 5. Clean Up Stalled Job

Reset the currently stuck job (id: `4a5d5c8f-...`) to `failed` status so it no longer blocks new attempts.

## Technical Details

| Aspect | Old (broken) | New (fixed) |
|--------|-------------|-------------|
| Processing model | `EdgeRuntime.waitUntil()` in single invocation | Frontend-driven loop of short HTTP calls |
| Batch size per call | All remaining (thousands) | 10 chunks per call |
| Wall-clock per call | Hours | ~10-15 seconds |
| Failure mode | Silent termination, stuck job | Retryable, resumable |
| Progress updates | Heartbeat inside background loop | Real progress after each batch |

The `backfill_embeddings` and `backfill_entities` legacy paths (using `EdgeRuntime.waitUntil()`) will be kept for backward compatibility but are effectively deprecated. The `processEmbeddingsBackfillJob` and `processNERBackfillJob` background functions remain in code but are no longer the primary path.
