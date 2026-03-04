

# Call Notes Not Auto-Populating: Root Cause & Fix

## Problem
7 out of 134 recent calls (~5%) have call notes showing "Call notes generation failed. Please regenerate manually." — the Scribe agent's default fallback text. Users see no useful notes until they manually click "Generate Call Notes."

## Root Cause
Two issues:

1. **No timeout override for the Scribe agent.** It defaults to 60s (`gpt-5-mini` default), but it runs in Phase 2 alongside Coach, which gets 120s. When the Scribe times out, the pipeline silently uses the default placeholder text and saves it to the database.

2. **No automatic fallback.** When the Scribe fails, there is no retry or automatic invocation of the `generate-sales-assets` edge function. The default placeholder is saved with a `sales_assets_generated_at` timestamp, so the UI treats it as "generated" and shows the unhelpful placeholder.

## Fix

### 1. Add Scribe timeout override in `agent-factory.ts`
Add `'scribe': 90000` to `AGENT_TIMEOUT_OVERRIDES` — matching the Auditor. The Scribe runs in background (fire-and-forget), so 90s is safe.

### 2. Auto-retry Scribe on failure in `pipeline.ts`
When `scribeResult.success` is false, retry once with the same input before falling back to default. This handles transient AI errors.

### 3. Fallback to `generate-sales-assets` in `analyze-call/index.ts`
After saving analysis results, check if `result.salesAssets.internal_notes_markdown` contains the default placeholder text. If so, trigger the `generate-sales-assets` edge function as a post-processing step (like Deal Heat and Follow-up Suggestions), passing the transcript and strategic context. This provides a second chance using a completely separate AI call path.

### 4. Fix the 7 existing failed notes
Run a database query to clear `sales_assets` and `sales_assets_generated_at` for the 7 affected calls, so the UI shows "Generate Call Notes" instead of the misleading placeholder.

## Files to Change

| File | Change |
|---|---|
| `supabase/functions/_shared/agent-factory.ts` | Add `'scribe': 90000` to timeout overrides |
| `supabase/functions/_shared/pipeline.ts` | Add single retry for Scribe on failure |
| `supabase/functions/analyze-call/index.ts` | Add `triggerSalesAssetsFallback()` in post-processing when Scribe produced default output |
| Database migration | Clear failed placeholder notes for 7 existing calls |

## Expected Impact
- Scribe timeout errors eliminated (60s was too tight)
- Automatic retry catches transient failures
- Fallback to `generate-sales-assets` catches any remaining failures
- 7 existing calls get their notes cleared so users can regenerate

