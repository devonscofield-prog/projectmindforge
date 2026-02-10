

# Fix SDR Pipeline: Update OpenAI Model and Add Reliability

## Problem
The transcript `3c7a6e87-...` is stuck in "processing" because the pipeline's background worker likely failed calling OpenAI with model string `gpt-5.2` (which may not resolve correctly). No error was captured because the `EdgeRuntime.waitUntil` background task crashed silently.

## Changes

### 1. Update model to `gpt-5.2-2025-12-11` in both edge functions

**`supabase/functions/sdr-process-transcript/index.ts`** -- 3 places:
- Splitter agent (line 268): `'gpt-5.2'` -> `'gpt-5.2-2025-12-11'`
- Filter agent (line 364): `'gpt-5.2'` -> `'gpt-5.2-2025-12-11'`
- Grader agent (line 484): `'gpt-5.2'` -> `'gpt-5.2-2025-12-11'`
- Also update the `model_name` stored in DB (line 187): `'gpt-5.2'` -> `'gpt-5.2-2025-12-11'`

**`supabase/functions/sdr-grade-call/index.ts`** -- 2 places:
- Grader function call (line ~200): `'gpt-5.2'` -> `'gpt-5.2-2025-12-11'`
- `model_name` in DB insert (line 110): `'gpt-5.2'` -> `'gpt-5.2-2025-12-11'`

### 2. Add timeouts to OpenAI fetch calls
Add `AbortSignal.timeout(55000)` (55-second timeout) to each `fetch()` call to OpenAI so that if a request hangs, it fails with a clear error instead of silently dying.

### 3. Reset the stuck transcript
Run a SQL update to set the stuck transcript back to `pending` so you can reprocess it after deploying the fix.

## No other changes
- Prompts stay the same
- Direct OpenAI API calls stay (no Lovable AI proxy)
- Pipeline architecture unchanged

