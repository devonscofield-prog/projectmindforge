

# Fix Edge Function Build Errors

## Problem Summary

There are build errors across 4 edge functions, all stemming from two root causes:

1. **`corsHeaders` used but never defined** in 3 functions (`calculate-deal-heat`, `send-daily-report`, `send-task-reminders`) -- these functions import `getCorsHeaders` but reference an undefined `corsHeaders` variable in helper functions that don't have access to the request's `Origin`.

2. **Untyped Supabase client** in `analyze-audio-voice` -- the `createClient()` call returns a generic client whose tables (`performance_metrics`, `voice_analysis_usage`, `voice_analysis_limits`) resolve to `never` because no database types are passed. The helper functions also type their parameter as `ReturnType<typeof createClient>` which conflicts with the `any`-typed client created in the main handler.

## Fixes

### 1. `calculate-deal-heat/index.ts`
Add a module-level fallback `corsHeaders` constant near the top (after the import), used by the `handleBackfillBatch` function which doesn't have access to a request origin:
```ts
const corsHeaders = getCorsHeaders(null);
```
This gives a safe default CORS header set for internal/backfill responses.

### 2. `send-daily-report/index.ts`
Same fix -- add `const corsHeaders = getCorsHeaders(null);` near the top for the `jsonResponse` helper at line 829 which uses `corsHeaders` outside the request handler scope.

### 3. `send-task-reminders/index.ts`
Same fix -- add `const corsHeaders = getCorsHeaders(null);` near the top. The references at lines 468, 482, 499, and 706 all use this variable in the main handler body but it was never assigned.

### 4. `analyze-audio-voice/index.ts`
Change the Supabase client typing to `any` throughout the helper functions to avoid the `never` type resolution. Specifically:
- Change `logEdgeMetric`, `checkUsageQuota`, and `incrementUsage` parameter types from `ReturnType<typeof createClient>` to `any`
- This matches how the client is actually created (`createClient(url, key)` without type params) and eliminates all 14 type errors in this file

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/calculate-deal-heat/index.ts` | Add `const corsHeaders = getCorsHeaders(null);` after import |
| `supabase/functions/send-daily-report/index.ts` | Add `const corsHeaders = getCorsHeaders(null);` after imports |
| `supabase/functions/send-task-reminders/index.ts` | Add `const corsHeaders = getCorsHeaders(null);` after imports |
| `supabase/functions/analyze-audio-voice/index.ts` | Change helper function supabase param types from `ReturnType<typeof createClient>` to `any` |

No database changes or new files needed.

