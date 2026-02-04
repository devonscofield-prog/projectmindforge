
## What’s actually happening (based on backend + database evidence)

For the call you’re on (`/calls/43337453-375d-4e35-8d8d-6a534a11226c`):

- The backend **did** complete analysis (`analysis_status = completed`).
- The backend **did** calculate Deal Heat and save it (DB has `heat_score = 39`).
- The backend **did** generate and save Advisor suggestions (DB has `5` suggestions).

So the issue is not “functions didn’t run”—it’s **the UI isn’t reliably refetching after the post-analysis jobs finish**.

There are two concrete frontend gaps causing what you’re seeing:

1) **The analysis adapter doesn’t expose `follow_up_suggestions`**
   - `ai_call_analysis.follow_up_suggestions` exists in the database and is returned by `.select('*')`,
   - but `toCallAnalysis()` in `src/lib/supabaseAdapters.ts` currently **does not map** `follow_up_suggestions` into the `CallAnalysis` object.
   - Result: even if the data is fetched, the UI never sees it.

2) **Refetch timing: call “completed” updates arrive before Deal Heat + suggestions**
   - `useCallAnalysisRealtime()` listens only to updates on `call_transcripts.analysis_status`.
   - When status flips to `completed`, we invalidate and refetch once.
   - **Deal Heat + Advisor suggestions are saved after that** (seconds later) into `ai_call_analysis`.
   - Since we do not subscribe to `ai_call_analysis` updates and we have a 30s staleTime, the page often won’t refetch again, so it looks like Deal Heat/suggestions “didn’t run”.

This matches your symptoms perfectly: “analysis finished, but no Deal Heat and no reminder options.”

---

## Fix goals

1) Ensure `follow_up_suggestions` is part of the `CallAnalysis` domain object so the UI can render the panel.
2) Ensure the Call Detail page refreshes automatically when post-analysis artifacts are written:
   - Deal Heat saved to `ai_call_analysis.deal_heat_analysis`
   - Advisor saved to `ai_call_analysis.follow_up_suggestions`

---

## Changes to implement

### A) Add `follow_up_suggestions` to frontend types + adapter (required)

**Files**
- `src/api/aiCallAnalysis/types.ts`
  - Add: `follow_up_suggestions: unknown[] | null` (or a typed `FollowUpSuggestion[] | null` if we want stronger typing)
- `src/lib/supabaseAdapters.ts`
  - In `toCallAnalysis(row)`, map:
    - `follow_up_suggestions: row.follow_up_suggestions` (using `parseJsonField` if you want validation; otherwise pass-through as JSON)

**Why this matters**
- `CallDetailPage` already checks `analysis?.follow_up_suggestions` before rendering `PostCallSuggestionsPanel`.
- Right now that property never exists on the analysis object, so the panel never appears.

---

### B) Add realtime subscription (or short polling) to catch Deal Heat + Advisor writes (required)

#### Option 1 (preferred): Realtime subscribe to `ai_call_analysis` updates
Update `useCallAnalysisRealtime()` to also subscribe to:

- `postgres_changes` on `public.ai_call_analysis`
- filter `call_id=eq.${callId}`
- on UPDATE:
  - invalidate `callDetailKeys.call(callId)`
  - (optionally) show a toast when suggestions appear: “✨ Follow-up suggestions ready” (only once)

**Files**
- `src/hooks/useCallAnalysisRealtime.ts`

**Behavior**
- Analysis completes → initial refetch happens.
- A few seconds later Deal Heat and suggestions are saved → realtime event fires → we refetch again automatically.
- This eliminates “it ran but I don’t see it” without the rep needing to click Refresh.

#### Option 2: Short “post-complete” polling window
If we want to avoid another realtime channel:
- When status becomes `completed`, start polling `getAnalysisForCall()` every ~2s for up to ~20–30s until either:
  - `deal_heat_analysis` exists AND `follow_up_suggestions` exists (or the suggestion function has finished), then stop
  - timeout reached, stop

This is simpler, but realtime is more elegant and consistent with the existing approach.

---

### C) Make sure query invalidation covers both call + analysis keys (nice-to-have)
Right now realtime invalidates only `callDetailKeys.call(callId)`.

But the page also uses `useAnalysisPolling()` (separate key) in some states. For completeness:
- invalidate `callDetailKeys.analysis(callId)` too whenever we detect completion / ai_call_analysis update.

**Files**
- `src/hooks/useCallAnalysisRealtime.ts`
- `src/pages/calls/CallDetailPage.tsx` (only if needed)

---

## Verification steps (what we’ll test in Test)

1) Submit a new call under “Tester”.
2) Navigate to call detail immediately.
3) Confirm:
   - “Analysis complete” toast appears.
   - Within a few seconds (no manual refresh):
     - Deal Heat badge + DealHeatCard shows a score
     - “Suggested Follow-Up Actions” panel appears with 3–7 items
4) Click “Accept” on a suggestion:
   - confirm a follow-up task is created and appears where tasks are shown
5) Click “Re-Run Analysis”:
   - confirm old suggestions clear
   - confirm new suggestions and Deal Heat repopulate without manual refresh

---

## Notes / edge cases handled

- If a call has no `prospect_id`, the suggestions panel is currently gated and won’t show. That’s expected per current UI condition; we can later decide whether to allow suggestions without account context.
- We’ll ensure we only show “suggestions ready” toast once per page load (useRef guard), similar to the existing “analysis complete” toast guard.

---

## Files likely to change

- `src/lib/supabaseAdapters.ts` (add `follow_up_suggestions` mapping)
- `src/api/aiCallAnalysis/types.ts` (add field to `CallAnalysis`)
- `src/hooks/useCallAnalysisRealtime.ts` (subscribe to `ai_call_analysis` updates and invalidate queries)

---

## Why this will fix your exact symptom

Your backend is working; the UI is just fetching at the wrong moment and also dropping the suggestions field during mapping. After these changes:
- the suggestions field will exist in the frontend object
- the page will automatically refresh when Deal Heat + suggestions arrive
