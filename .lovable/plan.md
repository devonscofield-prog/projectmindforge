

# Fix: Handle Single-Segment Splitter Responses

## Problem
The chunk size reduction to 25K is working (transcript now splits into 4 chunks), but the model sometimes returns a **single segment object** instead of an **array of segments**. When a chunk contains just one call, the model returns:

```json
{"raw_text": "...", "start_timestamp": "00:00", "approx_duration_seconds": 120}
```

Instead of:

```json
[{"raw_text": "...", "start_timestamp": "00:00", "approx_duration_seconds": 120}]
```

The validation code only looks for arrays, so it rejects this valid single-segment response.

## Solution
Add a fallback in the segment extraction logic: if the parsed JSON is not an array and none of the known wrapper keys contain arrays, check if the object itself looks like a segment (has a `raw_text` field). If so, wrap it in an array.

## Changes

### 1. Update segment parsing in `supabase/functions/sdr-process-transcript/index.ts` (~line 479-484)

After the existing array-detection logic, add a check before throwing:

```typescript
// Existing: check for Array.isArray(parsed), then check wrapper keys, then check any array value
// NEW: if still no segments, check if parsed itself is a single segment object
if (!segments && typeof parsed === 'object' && parsed.raw_text) {
  segments = [parsed];
}
```

This handles the case where the model returns one segment as a plain object.

### 2. Reset failed transcripts
- Reset `3cd262db`, `da96ee0d`, `4da68621` back to `pending` and clear errors
- These will reprocess with the fix

### 3. Deploy and trigger
- Redeploy `sdr-process-transcript`
- Trigger reprocessing

## Why This Is Safe
- Only activates when no array is found and the object has `raw_text` (a required segment field)
- Does not change behavior for normal array responses
- The downstream pipeline already handles arrays of 1+ segments
