

# Update All OpenAI Models to Dated Versions

## What Changed
OpenAI released dated model snapshots. All references need updating:
- `gpt-5.4` → `gpt-5.4-2026-03-05`
- `gpt-5.4-pro` → `gpt-5.4-pro-2026-03-05`

## Files to Update (24 files)

### Core Infrastructure (3 files)
1. **`_shared/agent-registry.ts`** — Update type union and all 14 agent model assignments
2. **`_shared/agent-factory.ts`** — Update timeout keys, consensus models, comments, and model references
3. **`_shared/utils.ts`** — Update default model in `callLovableAI`

### Edge Functions (21 files)
Each has 1-2 hardcoded model strings to replace:

| File | Current Model |
|---|---|
| `sales-coach-chat` | `gpt-5.4-pro` |
| `admin-assistant-chat` | `gpt-5.4-pro` |
| `admin-transcript-chat` | `gpt-5.4` + `gpt-5.4-pro` |
| `sales-assistant-chat` | `gpt-5.4-pro` |
| `sdr-assistant-chat` | `gpt-5.4-pro` |
| `calculate-deal-heat` | `gpt-5.4` + `gpt-5.4-pro` |
| `calculate-account-heat` | `gpt-5.4-pro` |
| `generate-coaching-trends` | `gpt-5.4-pro` |
| `generate-coaching-chunk-summary` | `gpt-5.4` |
| `generate-aggregate-coaching-trends` | comment only |
| `generate-call-follow-up-suggestions` | `gpt-5.4` |
| `generate-account-follow-ups` | `gpt-5.4-pro` |
| `generate-agreed-next-steps` | `gpt-5.4-pro` |
| `generate-sales-assets` | `gpt-5.4` |
| `competitor-research` | `gpt-5.4-pro` |
| `account-research` | `gpt-5.4-pro` |
| `regenerate-account-insights` | `gpt-5.4-pro` |
| `chunk-transcripts` | `gpt-5.4` |
| `edit-recap-email` | `gpt-5.4` |
| `analyze-performance` | `gpt-5.4-pro` |
| `roleplay-grade-session` | `gpt-5.4-pro` |

## Approach
Simple find-and-replace across all 24 files:
- Every `'gpt-5.4-pro'` → `'gpt-5.4-pro-2026-03-05'`
- Every `'gpt-5.4'` (non-pro) → `'gpt-5.4-2026-03-05'`
- Every `'openai/gpt-5.4-pro'` → `'openai/gpt-5.4-pro-2026-03-05'`
- Every `'openai/gpt-5.4'` → `'openai/gpt-5.4-2026-03-05'`
- Update comments referencing these models

No logic changes, no timeout changes, no structural changes — purely model identifier updates.

