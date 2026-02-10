

# Fix: Reduce Chunk Size Further for Reliable Splitter Output

## Problem
Even after removing the "chunk 1/2" label from the prompt, the model (gpt-5.2) is refusing to process ~42K character chunks because the **output JSON** would be too large to generate without truncation risk. The error:

> "the provided transcript is too long to segment reliably within a single response without risking truncation"

The 85K transcript splits into 2 chunks at the current 50K threshold, yielding ~42K per chunk — still too large for reliable output generation.

## Solution
Lower `SPLITTER_CHUNK_MAX_CHARS` from 50,000 to **25,000**. This will split the 85K transcript into ~4 chunks of ~21K each, which is well within the model's comfortable output range. The existing deduplication logic already handles merging overlapping results across chunks.

## Changes

### 1. Update chunk threshold in `supabase/functions/sdr-process-transcript/index.ts`
- Change `SPLITTER_CHUNK_MAX_CHARS` from `50_000` to `25_000`
- Update the comment to reflect the new sizing rationale

### 2. Reset failed transcripts
- Reset all failed/pending transcripts (`da96ee0d`, `4da68621`, `3fdfa46b`, `bfdf4522`) to `pending` status so they reprocess with the smaller chunk size

### 3. Deploy and trigger
- Redeploy the `sdr-process-transcript` edge function
- Trigger reprocessing for the reset transcripts

## Technical Detail
- 85K chars / 25K per chunk = 4 chunks of ~21K each
- 21K chars is roughly 5K tokens of input, leaving plenty of output token budget for the segmented JSON response
- More chunks means slightly more API calls, but each completes faster and more reliably
