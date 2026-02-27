

# Remaining API Migration Issues

The previous migration missed a few spots. Here's what still needs fixing:

## Issue 1: `chunk-transcripts/index.ts` — Still reads `LOVABLE_API_KEY` secret
Line 1204 reads `Deno.env.get('LOVABLE_API_KEY')` and passes it as the API key for NER extraction. The NER function itself correctly calls `api.openai.com`, but it's using the wrong secret. This needs to read `OPENAI_API_KEY` instead.

**Files:** `supabase/functions/chunk-transcripts/index.ts`
- Change line 1204: `LOVABLE_API_KEY` → `OPENAI_API_KEY`
- Rename the `lovableApiKey` variable to `openaiNerKey` throughout (6+ call sites)

## Issue 2: `agent-factory.ts` — Coach consensus still calls Gemini model on OpenAI
Line 592 sends `google/gemini-3-pro-preview` as a model name to the OpenAI API, which will be rejected. The consensus should use two OpenAI models or run single-model only.

**Files:** `supabase/functions/_shared/agent-factory.ts`
- Change line 592's second model from `google/gemini-3-pro-preview` to `openai/gpt-5-mini` (or remove dual-model consensus and always use single-model)
- Update reconciler log messages that say "Gemini" to say "Model B"

## Issue 3: `_shared/README.md` — Stale documentation references Lovable Gateway
Still shows `LOVABLE_API_KEY` and `ai.gateway.lovable.dev` in code examples.

**Files:** `supabase/functions/_shared/README.md`
- Update examples to reference OpenAI API

## Issue 4: Variable naming cleanup
Several files use `LOVABLE_API_KEY` as a **variable name** (while correctly reading `OPENAI_API_KEY` from env). This is confusing but not broken. Will rename for clarity in:
- `generate-agreed-next-steps/index.ts`
- `generate-coaching-chunk-summary/index.ts`
- `generate-coaching-trends/index.ts`
- `generate-call-follow-up-suggestions/index.ts`
- `regenerate-account-insights/index.ts`
- `generate-account-follow-ups/index.ts`

## Summary
| Issue | Severity | Impact |
|-------|----------|--------|
| chunk-transcripts reads wrong secret | **Breaking** | NER extraction fails silently |
| Coach consensus sends Gemini model to OpenAI | **Breaking** | Second coach model always errors, falls back to single |
| README stale docs | Cosmetic | Misleading for future development |
| Variable naming | Cosmetic | Confusing but functional |

