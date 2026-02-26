

# Fix: SDR Transcript Detail "Failed to load" Error

## Root Cause

The `sdr_calls` table is missing the `processing_error` column. The Postgres logs confirm repeated errors:
```
column sdr_calls.processing_error does not exist
```

The SDR queries in `src/hooks/sdr/queries.ts` include `processing_error` in the SELECT for both `SDR_CALL_LIST_SELECT` (line 70) and `SDR_CALL_DETAIL_SELECT` (line 90). Every query to `sdr_calls` fails, which triggers the `callsError` state in `SDRTranscriptDetail.tsx`, showing the error message.

## Fix

**Step 1: Add the missing column via database migration**

```sql
ALTER TABLE public.sdr_calls ADD COLUMN IF NOT EXISTS processing_error text;
```

This is the only change needed. The column already exists in the TypeScript types (`SDRCallListItem.processing_error`) and is referenced throughout the UI (e.g., displaying error messages for failed calls). Adding it to the database will unblock all SDR call queries.

## Additional Postgres Errors Observed

For awareness, the logs also show:
- `column ai_call_analysis.updated_at does not exist` — may affect other pages
- `column stakeholders.title does not exist` — may affect prospect pages
- `column profiles.role does not exist` — may affect auth/role checks

These are separate issues but follow the same pattern of code referencing columns that don't exist in the schema.

