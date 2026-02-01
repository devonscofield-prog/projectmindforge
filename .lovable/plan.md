

# Plan: Fix URL Length Limit Issue in RAG Analysis for Large Transcript Selections

## Problem Summary

When users select a large number of transcripts (e.g., 499), the RAG analysis fails with:
```
Error: Failed to index transcripts: Failed to fetch transcripts: TypeError: error sending request
```

**Root Cause**: Supabase REST API queries with `.in('id', transcriptIds)` create URLs that exceed HTTP URL length limits when the array contains hundreds of UUIDs.

## Affected Code Locations

| File | Line | Issue |
|------|------|-------|
| `supabase/functions/admin-transcript-chat/index.ts` | 1065-1068 | `transcript_chunks` query with all IDs |
| `supabase/functions/admin-transcript-chat/index.ts` | 1270-1273 | `call_transcripts` query with all IDs |

## Solution: Batch Large IN Queries

### Part 1: Create a Batched Query Helper Function

Add a utility function to split large ID arrays into batches of 50 and execute multiple queries:

```typescript
async function batchedInQuery<T>(
  supabase: any,
  table: string,
  column: string,
  ids: string[],
  selectFields: string,
  batchSize = 50
): Promise<{ data: T[] | null; error: any }> {
  if (ids.length <= batchSize) {
    // Small enough for single query
    const { data, error } = await supabase
      .from(table)
      .select(selectFields)
      .in(column, ids);
    return { data, error };
  }

  // Split into batches
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    batches.push(ids.slice(i, i + batchSize));
  }

  // Execute batches in parallel (max 5 concurrent)
  const results: T[] = [];
  const CONCURRENT_LIMIT = 5;
  
  for (let i = 0; i < batches.length; i += CONCURRENT_LIMIT) {
    const batchPromises = batches.slice(i, i + CONCURRENT_LIMIT).map(batch =>
      supabase.from(table).select(selectFields).in(column, batch)
    );
    
    const batchResults = await Promise.all(batchPromises);
    
    for (const { data, error } of batchResults) {
      if (error) return { data: null, error };
      if (data) results.push(...data);
    }
  }

  return { data: results, error: null };
}
```

### Part 2: Update `buildRagContext` Function (Line 1065-1068)

Replace the single query:
```typescript
const { data: existingChunks } = await supabase
  .from('transcript_chunks')
  .select('transcript_id')
  .in('transcript_id', transcriptIds);
```

With the batched version:
```typescript
const { data: existingChunks, error: chunksError } = await batchedInQuery(
  supabase,
  'transcript_chunks',
  'transcript_id',
  transcriptIds,
  'transcript_id',
  50
);

if (chunksError) {
  console.error('[admin-transcript-chat] Error fetching chunk status:', chunksError);
  throw new Error(`Failed to check chunk status: ${chunksError.message}`);
}
```

### Part 3: Update `chunkTranscriptsInline` Function (Line 1270-1273)

Replace:
```typescript
const { data: transcripts, error: fetchError } = await supabase
  .from('call_transcripts')
  .select('id, call_date, account_name, call_type, raw_text, rep_id')
  .in('id', transcriptIds);
```

With:
```typescript
const { data: transcripts, error: fetchError } = await batchedInQuery(
  supabase,
  'call_transcripts',
  'id',
  transcriptIds,
  'id, call_date, account_name, call_type, raw_text, rep_id',
  50
);
```

## Files to Modify

| File | Action |
|------|--------|
| `supabase/functions/admin-transcript-chat/index.ts` | Add `batchedInQuery` helper and update 2 query locations |

## Expected Behavior After Fix

| Scenario | Before | After |
|----------|--------|-------|
| 499 transcripts selected | 500 error - URL too long | Works - splits into 10 batches of 50 |
| 20 transcripts selected | Works | Works (no change) |
| RAG mode with 100+ transcripts | Fails on chunk check | Works with batched queries |

## Testing Recommendations

1. Select 100+ transcripts and open the analysis chat
2. Verify RAG mode activates without URL errors
3. Confirm analysis results return correctly

