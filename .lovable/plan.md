

# Fix: `gpt-5.4-pro-2026-03-05` is Not a Chat Model

## Root Cause

The edge function logs confirm the issue clearly:

- **`gpt-5.4-2026-03-05`** — **works fine** (Census, Historian, Referee, Interrogator, Scribe all complete successfully)
- **`gpt-5.4-pro-2026-03-05`** — **fails with 404** every time: *"This is not a chat model and thus not supported in the v1/chat/completions endpoint"*

The `gpt-5.4-pro-2026-03-05` model is not available on OpenAI's Chat Completions API. Every function using it gets a 404, which surfaces as "An unexpected error occurred" to users.

The Sales Coach chat uses `gpt-5.4-pro-2026-03-05` directly on line 229, which is why Dawson keeps hitting this error.

## Fix

Replace all `gpt-5.4-pro-2026-03-05` references with `gpt-5.4-2026-03-05` across all 17 affected files. This is the only model that's confirmed working.

## Files to Update (17 files, ~30 string replacements)

| File | Change |
|---|---|
| `sales-coach-chat/index.ts` | model + log message |
| `admin-assistant-chat/index.ts` | model + log message |
| `sdr-assistant-chat/index.ts` | model fallback |
| `sales-assistant-chat/index.ts` | model |
| `admin-transcript-chat/index.ts` | model |
| `calculate-deal-heat/index.ts` | model |
| `calculate-account-heat/index.ts` | model + comment |
| `generate-coaching-trends/index.ts` | model |
| `generate-account-follow-ups/index.ts` | model |
| `generate-agreed-next-steps/index.ts` | model |
| `competitor-research/index.ts` | model |
| `account-research/index.ts` | model |
| `regenerate-account-insights/index.ts` | model |
| `analyze-performance/index.ts` | model |
| `roleplay-grade-session/index.ts` | model + comment |
| `_shared/agent-factory.ts` | timeout key, consensus models, comments, consensus execution |
| `_shared/agent-registry.ts` | all agent model assignments that use pro |
| `generate-aggregate-coaching-trends/index.ts` | comment only |

## Approach

Simple global replacement: `gpt-5.4-pro-2026-03-05` → `gpt-5.4-2026-03-05` everywhere. Also update `agent-factory.ts` to remove the separate pro timeout tier (consolidate to single 90s timeout since there's only one model now).

