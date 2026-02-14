

# Remove Transcript Limit for RAG-Based Analysis

## Problem
When using "Analyze with AI" with RAG mode enabled, the system caps transcript selection at 50. This limit is enforced by the Zod validation schema on the backend edge function. Since RAG mode uses semantic search over pre-indexed chunks (not direct transcript injection), there is no technical reason to restrict the number of transcripts.

## Changes

### 1. Backend Schema - Remove the 50-transcript cap for RAG
**File:** `supabase/functions/_shared/schemas.ts` (line 138)

Change the `.max(50)` validation to a higher limit (e.g., 500) so RAG-based analysis can work across the full transcript library.

```
// Before
transcript_ids: z.array(uuidSchema).min(1).max(50, "Maximum 50 transcripts allowed")

// After
transcript_ids: z.array(uuidSchema).min(1).max(500, "Maximum 500 transcripts allowed")
```

### 2. Redeploy Edge Function
The `admin-transcript-chat` edge function will be redeployed to pick up the updated schema.

No other changes are needed -- the client-side code already shows "RAG Mode - Unlimited" in the UI and has no hard cap on selection count. The RAG path in the edge function queries pre-indexed chunks filtered by transcript IDs, so scaling to hundreds of transcripts is handled efficiently by the database.

## Technical Details

| Layer | Current Limit | New Limit | Reason |
|-------|--------------|-----------|--------|
| Zod schema (`_shared/schemas.ts`) | 50 | 500 | Only hard blocker; RAG doesn't need this cap |
| Direct injection threshold | 20 transcripts | No change | Below 20 uses full text; above uses RAG chunks |
| RAG chunk retrieval | 100 chunks | No change | Semantic search returns top-100 relevant chunks regardless of transcript count |

