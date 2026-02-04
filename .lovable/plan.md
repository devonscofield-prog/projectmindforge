
# Fix: AI Advisor Not Generating Follow-Up Suggestions

## Root Cause Analysis

The "Test" call analysis completed successfully (Deal Heat = 19/100, Grade = C), BUT the follow-up suggestions weren't generated because of a **database constraint issue**.

### Error from logs:
```
PGRST201: Could not embed because more than one relationship was found 
for 'call_transcripts' and 'ai_call_analysis'
```

### Database Issue:
The `ai_call_analysis` table has **two duplicate foreign keys** pointing to `call_transcripts.id`:
- `ai_call_analysis_call_id_fkey`
- `fk_ai_call_analysis_call_id`

PostgREST can't determine which relationship to use for embedded joins.

---

## Two-Part Fix

### Part 1: Drop Duplicate Foreign Key

**Migration SQL:**
```sql
ALTER TABLE ai_call_analysis 
DROP CONSTRAINT IF EXISTS fk_ai_call_analysis_call_id;

ALTER TABLE ai_call_analysis 
DROP CONSTRAINT IF EXISTS fk_ai_call_analysis_rep_id;
```

This removes the duplicate constraints while keeping the canonical ones (`ai_call_analysis_call_id_fkey` and `ai_call_analysis_rep_id_fkey`).

### Part 2: Fix Edge Function Query Syntax

Update `generate-call-follow-up-suggestions` to use explicit relationship hints as a safety measure:

**Current (broken):**
```typescript
.select(`
  id, raw_text, ...,
  ai_call_analysis (
    id, call_summary, ...
  )
`)
```

**Fixed:**
```typescript
.select(`
  id, raw_text, ...,
  ai_call_analysis!ai_call_analysis_call_id_fkey (
    id, call_summary, ...
  )
`)
```

This explicitly tells PostgREST which FK to use.

---

## Files to Modify

| File | Change |
|------|--------|
| Database migration | Drop duplicate FK constraints |
| `supabase/functions/generate-call-follow-up-suggestions/index.ts` | Add explicit FK hint to all embedded queries |

---

## After Implementation

1. The duplicate constraints will be removed
2. Re-run analysis for the "Test" call using "Re-Run Analysis" button
3. Follow-up suggestions should now generate successfully
4. The PostCallSuggestionsPanel will appear on the call detail page

---

## Why Deal Heat Worked But Suggestions Didn't

Deal Heat calculation in `calculate-deal-heat` doesn't use embedded queries (it queries `ai_call_analysis` directly by `call_id`), so it wasn't affected.

The Advisor uses embedded queries (`call_transcripts` → `ai_call_analysis`) which requires PostgREST to resolve the FK relationship, causing the failure.
