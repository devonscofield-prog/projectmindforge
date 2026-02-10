

# Lower Splitter Chunk Size Threshold

## Summary
Reduce `SPLITTER_CHUNK_MAX_CHARS` from 120,000 to 50,000 so large transcripts get split into smaller chunks that complete within the 55-second timeout window. Then reset the failed transcript for reprocessing.

## Changes

### 1. Update chunk threshold in `supabase/functions/sdr-process-transcript/index.ts`
- Change `SPLITTER_CHUNK_MAX_CHARS` from `120_000` to `50_000`

### 2. Reset the failed transcript
- Set transcript `bfdf4522-62d0-4d30-8a4d-701d08b3b7a4` back to `pending` status so it can be reprocessed with the new smaller chunk size

### 3. Deploy
- Redeploy the `sdr-process-transcript` edge function

## Expected Result
The 85K-character transcript will now be split into 2 chunks (~42K each), each well within the 55-second timeout. The deduplication logic already handles merging overlapping chunk results.

