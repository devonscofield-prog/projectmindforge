

# Block Analysis Completion Until Deal Heat & Follow-Ups Are Ready

## Problem Statement

Currently, the `analyze-call` function marks the call as `completed` (line 385) **before** triggering Deal Heat and Follow-up Suggestions (lines 394-409). This causes:

1. The UI to show "Analysis Complete" before suggestions are available
2. Users to potentially leave the page before seeing the suggestions panel
3. A confusing UX where content appears incrementally after "completion"

## Current Flow

```text
┌─────────────────────────────────────────────────────────────────┐
│                    analyze-call function                        │
├─────────────────────────────────────────────────────────────────┤
│  1. Run 7-agent analysis pipeline                               │
│  2. Save analysis results to ai_call_analysis                   │
│  3. Set status = 'completed'  ← USER SEES "COMPLETE" HERE       │
│  4. Fire-and-forget: triggerDealHeatCalculation()               │
│  5. Fire-and-forget: triggerBackgroundChunking()                │
│  6. Fire-and-forget: triggerFollowUpSuggestions()               │
│                                                                 │
│  Result: User sees "completed" but suggestions arrive 30-60s    │
│          later, after they may have already left                │
└─────────────────────────────────────────────────────────────────┘
```

## Proposed Flow

```text
┌─────────────────────────────────────────────────────────────────┐
│                    analyze-call function                        │
├─────────────────────────────────────────────────────────────────┤
│  1. Run 7-agent analysis pipeline                               │
│  2. Save analysis results to ai_call_analysis                   │
│  3. Set status = 'post_processing'  ← NEW INTERMEDIATE STATUS   │
│  4. AWAIT triggerDealHeatCalculation()                          │
│  5. Fire-and-forget: triggerBackgroundChunking() (non-critical) │
│  6. AWAIT triggerFollowUpSuggestions()                          │
│  7. Set status = 'completed'  ← USER SEES "COMPLETE" NOW        │
│                                                                 │
│  Result: User only sees "completed" when everything is ready    │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### Option A: Add New Status (Recommended)

Add an intermediate status `post_processing` that indicates the main analysis is done but supplementary features are being generated. The UI can show a different message for this state.

**Database Change:**
Update the `analysis_status` CHECK constraint to include `post_processing` (or no change if using text type without constraints).

**Edge Function Changes (analyze-call/index.ts):**

1. **Line 385**: Change status to `post_processing` instead of `completed`
2. **Lines 394-409**: Await Deal Heat and Follow-up Suggestions (instead of fire-and-forget)
3. **After line 409**: Add new status update to `completed`

**UI Updates (CallDetailPage.tsx):**
- Treat `post_processing` similarly to `processing` - show "Finalizing analysis..." or similar

### Option B: Simple Await (Faster to implement)

Keep the same status flow but await the critical functions before setting `completed`.

**Edge Function Changes Only:**

```typescript
// Line 385: DON'T set completed yet, keep status as 'processing'
// (remove the early status update)

// Lines 394-409: Await instead of fire-and-forget
await triggerDealHeatCalculation(...);  // AWAIT
await triggerBackgroundChunking(...);   // Keep fire-and-forget (non-critical)
await triggerFollowUpSuggestions(...);  // AWAIT

// NEW: Only NOW set completed
await supabaseAdmin.from('call_transcripts')
  .update({ analysis_status: 'completed', analysis_version: 'v2' })
  .eq('id', targetCallId);
```

## Edge Case Handling

### Timeout Risk
Deal Heat + Follow-up Suggestions add ~10-20 seconds to the pipeline. The `EdgeRuntime.waitUntil()` pattern already handles this, so no HTTP timeout issues.

### Failure Handling
If Deal Heat or Follow-ups fail, we should still mark as `completed` but log the warning. The analysis itself is still valuable without these supplementary features.

```typescript
// Attempt post-processing, but don't fail the whole analysis
let dealHeatSuccess = false;
let suggestionsSuccess = false;

try {
  await triggerDealHeatCalculation(...);
  dealHeatSuccess = true;
} catch (e) {
  console.warn(`[analyze-call] Deal Heat failed for ${targetCallId}:`, e);
}

try {
  await triggerFollowUpSuggestions(...);
  suggestionsSuccess = true;
} catch (e) {
  console.warn(`[analyze-call] Suggestions failed for ${targetCallId}:`, e);
}

// Fire-and-forget for non-critical chunking
triggerBackgroundChunking(...).catch(() => {});

// Mark complete regardless of post-processing results
await supabaseAdmin.from('call_transcripts')
  .update({ 
    analysis_status: 'completed', 
    analysis_version: 'v2',
    // Optionally track what succeeded
  })
  .eq('id', targetCallId);

console.log(`[analyze-call] ✅ Analysis complete for ${targetCallId} (DealHeat: ${dealHeatSuccess}, Suggestions: ${suggestionsSuccess})`);
```

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/analyze-call/index.ts` | Move status=completed to AFTER Deal Heat + Suggestions complete |

## UI Consideration

With this change, the UI will continue showing "Analyzing..." for the full duration (including Deal Heat and Suggestions generation). This is actually better UX because:

1. User sees one clear transition: Processing → Complete
2. When "Complete" appears, ALL content is ready including suggestions
3. No more "ghost loading" where panels pop in 30-60 seconds after completion

## Summary

This is a small but impactful change to the analyze-call function:
- Remove the early `completed` status update (line 385)
- Await Deal Heat and Follow-up Suggestions
- Set `completed` only after both finish
- Handle failures gracefully so partial success still completes

The result: users will see the suggestions panel immediately when the analysis shows as "completed".

