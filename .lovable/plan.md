

# Fix SDR System: Manager Visibility + Pipeline Recovery

## Problem Summary

Three interconnected issues need fixing:

1. **Lonnell can't see team transcripts** -- The `sdr_teams` and `sdr_team_members` tables are completely empty. All manager pages filter by team membership, so Lonnell (and Devon test) see zero transcripts despite having the `sdr_manager` role.

2. **Stuck transcripts** -- 2 transcripts are stuck in "processing" and 6 in "pending" with no recovery mechanism.

3. **Splitter failures on large transcripts** -- The splitter uses `response_format: { type: 'json_object' }` which forces a JSON *object* (not array), causing the model to sometimes wrap results in `{ "error": "..." }` instead of returning segments.

---

## Fix 1: Create Team + Assign Members (Data Insert)

Insert into `sdr_teams` to create Lonnell's team, then insert all 7 SDRs into `sdr_team_members`.

- **Team**: Create team for Lonnell Holman (`05687c5a-4326-4fee-885f-3bbb7277587b`)
- **Members**: Add all 7 SDR-role users to his team:
  - Matthew Verville, Cole Buck, Kiara Contreras, Caleb Thompson, Devon Scofield, Jack Bamis, Brenndan Valenzuela

This immediately fixes RLS visibility -- the `is_sdr_manager_of()` function will return true for Lonnell's queries.

---

## Fix 2: Reset Stuck Transcripts (Data Update)

- Reset 2 "processing" transcripts (`fee7f249`, `f489e7ce`) to "failed" status so they can be retried
- Reset 6 "pending" transcripts to "failed" so they surface in the UI with retry buttons
- Reset 10 stuck calls (2 "processing", 8 "pending") to appropriate statuses

---

## Fix 3: Improve Splitter Error Handling (Code Change)

**File: `supabase/functions/sdr-process-transcript/index.ts`**

In `runSplitterOnChunk()`, add handling for when the model returns `{ "error": "..." }` instead of segments:
- If parsed JSON has an `error` key and no array values, log the model's error message and throw a descriptive error instead of a cryptic "unexpected structure" message
- This provides better diagnostics for future failures

Also update the CORS headers to match the standardized pattern (missing several required Supabase client headers).

---

## Fix 4: Add Stuck-Transcript Cleanup Logic (Code Change)

**File: `supabase/functions/sdr-process-transcript/index.ts`**

At the start of `processTranscriptPipeline()`, add a guard: if the transcript has been in "processing" for more than 10 minutes (based on `updated_at`), allow retry even if status isn't explicitly "failed". This prevents transcripts from getting permanently stuck.

---

## Technical Summary

| Change | Type | Details |
|--------|------|---------|
| Create Lonnell's team + assign 7 SDRs | Data insert | `sdr_teams` + `sdr_team_members` |
| Reset 8 stuck transcripts | Data update | Set status to "failed" |
| Reset 10 stuck calls | Data update | Set status to "failed" |
| Better splitter error handling | Code | `sdr-process-transcript/index.ts` |
| Fix CORS headers | Code | `sdr-process-transcript/index.ts` |
| Stuck-state recovery guard | Code | `sdr-process-transcript/index.ts` |

