

# Daily Report Bugs and Improvements

## Bugs Found

### Bug 1: Scores are all zeros in the report

The edge function reads `call_effectiveness_score` from `ai_call_analysis`, but for all recent calls (Jan-Feb 2026), this column is NULL. The analysis pipeline migrated to a new structure where scores live in `analysis_behavior->>'overall_score'` (which has values like 96, 79, 80 for recent calls). The report shows "Avg Effectiveness: 0.0" because it only reads the legacy column.

**Fix:** Update the edge function to compute a composite score: prefer `call_effectiveness_score` when non-null, otherwise fall back to `analysis_behavior->>'overall_score'`. This handles both old and new data.

### Bug 2: Pipeline always shows $0

The `potential_revenue` column on `call_transcripts` is NULL for every single call in the database. No call has ever had this populated. The report shows "$0 Pipeline" which is misleading.

**Fix:** Two options -- (a) pull estimated deal values from `analysis_metadata->>'user_counts'` or `deal_heat_analysis` if available, or (b) simply hide the pipeline metric when it's $0/$null across all calls, and show a "No pipeline data available" message instead. Option (b) is safer and more honest.

### Bug 3: Score scale mismatch

The older `call_effectiveness_score` values that do exist are on a 0-100 scale (e.g., 85, 78, 88). But the email template's `scoreColor` function uses thresholds of 7 and 5 (assuming 0-10 scale), meaning every call with an old score would show green. The new `analysis_behavior` scores are also 0-100. The email displays scores with one decimal like "85.0" which looks odd.

**Fix:** Normalize the display to 0-100 scale. Update `scoreColor` thresholds to 70/50 (instead of 7/5). Display scores as whole numbers (no decimal needed at this scale).

### Bug 4: Non-admin/manager users see "No reps configured"

When the edge function runs in test mode for a user who is a "rep" (not admin/manager), it falls through all the rep-finding logic and returns "No reps configured." This is fine behavior but the UI shouldn't show the Daily Report settings card to reps -- which it currently doesn't (gated by role check). However, the edge function itself doesn't validate the caller's role, so a rep could invoke it via API. Not critical but worth a guard.

## Improvements

### Improvement 1: Show "no data" state gracefully in the email

When all scores are null and pipeline is 0, the email still renders empty tables with "No standout performers" and "No calls flagged for attention." Add a clear banner at the top summarizing data quality: "9 calls recorded, 0 with effectiveness scores."

### Improvement 2: Include analysis_behavior scores in report data

Pull the richer analysis data (behavior scores, strategy scores) that the new pipeline generates. This makes the report immediately useful with current data rather than waiting for the legacy score column to be backfilled.

### Improvement 3: Add call summary snippets to email

The `analysis_metadata->>'summary'` field has short call summaries. Including 1-2 sentence summaries for top/bottom calls would make the report much more actionable than just showing numbers.

---

## Technical Details

### Files to modify

**`supabase/functions/send-daily-report/index.ts`**:
- Update the Supabase query to also select `ai_call_analysis(call_effectiveness_score, analysis_behavior)` 
- Add a `getEffectivenessScore()` helper that checks `call_effectiveness_score` first, then falls back to `analysis_behavior->overall_score`
- Update `scoreColor` thresholds from 7/5 to 70/50
- Change score display from `.toFixed(1)` to `Math.round()`
- Conditionally hide the "Est. Pipeline" stat card when total pipeline is 0
- Add a data quality note when scored-call percentage is low
- Include brief call summaries (from `analysis_metadata`) for top/bottom 2 calls

### Summary of changes

| Issue | Current | Fixed |
|-------|---------|-------|
| Score source | `call_effectiveness_score` only (always NULL) | Falls back to `analysis_behavior.overall_score` |
| Score scale | Thresholds at 7/5 (0-10) | Thresholds at 70/50 (0-100) |
| Score display | "8.5" | "85" |
| Pipeline $0 | Shows "$0" | Hides stat when no data |
| Data quality | No indication | Shows "X of Y calls scored" |
| Call context | Numbers only | Top/bottom call summaries |

