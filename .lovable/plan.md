

# Fix Analysis Pipeline Reliability Issues

Three root causes identified from logs and code inspection.

---

## Issue 1: Timeout Retry Storm (Critical)

**Root cause:** In `agent-factory.ts` line 299-301, timeout errors (`AbortError`) trigger `continue` which retries the agent. Speaker Labeler (60s timeout × 3 attempts = 180s) and Interrogator (75s timeout × 3 attempts = 225s) burn ~378s total, exceeding the 300s `PIPELINE_TIMEOUT_MS`.

**Fix in `supabase/functions/_shared/agent-factory.ts`:**
- Do NOT retry on timeout errors. If an agent times out once, it will almost certainly time out again on the same transcript. Change the `AbortError` catch block to throw immediately instead of `continue`.
- Keep retries only for HTTP 429/5xx and JSON parse errors (transient failures).

---

## Issue 2: Dead Variable Reference in Coach Consensus (Bug)

**Root cause:** In `agent-factory.ts` lines 596 and 641, the code references `geminiResult` and `geminiData` — variables that don't exist. They were renamed to `modelBResult`/`modelBData` on line 589 but the references on lines 596 and 641 were never updated. This means Coach consensus crashes at runtime whenever both models succeed.

**Fix in `supabase/functions/_shared/agent-factory.ts`:**
- Line 596: Change `geminiResult` to `modelBResult`
- Line 641: Change `geminiData` (2 occurrences) to `modelBData`

---

## Issue 3: Missing `rate_limits` Table (Minor)

**Root cause:** The `rateLimiter.ts` expects a `rate_limits` table that was never created. Every analysis request logs a warning. The rate limiter falls back to allowing all requests, so there's no actual rate limiting.

**Fix:** Create the `rate_limits` table via migration:
```sql
CREATE TABLE public.rate_limits (
  key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow service role access only (no RLS needed, accessed via service key)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
```

---

## Summary of Changes

| File | Change |
|---|---|
| `agent-factory.ts` | Stop retrying on timeout (throw immediately on `AbortError`) |
| `agent-factory.ts` | Fix `geminiResult`/`geminiData` → `modelBResult`/`modelBData` |
| Database migration | Create `rate_limits` table |

