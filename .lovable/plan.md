

# Migrate All AI Calls from Lovable AI Gateway to OpenAI API

## Scope

19 files currently use `https://ai.gateway.lovable.dev/v1/chat/completions` with `LOVABLE_API_KEY`. All must be migrated to `https://api.openai.com/v1/chat/completions` with `OPENAI_API_KEY`. The project already has `OPENAI_API_KEY` configured as a secret.

## Model Mapping

Gemini models used via Lovable Gateway will be replaced with OpenAI equivalents:

| Current (Lovable Gateway) | New (OpenAI) |
|---|---|
| `google/gemini-3-pro-preview` | `gpt-5.2` |
| `google/gemini-2.5-pro` | `gpt-5.2` |
| `google/gemini-2.5-flash` | `gpt-5-mini` |
| `google/gemini-2.5-flash-lite` | `gpt-5-nano` |

## Files to Update

### Shared Infrastructure (affects analyze-call pipeline)
1. **`supabase/functions/_shared/agent-factory.ts`** — Remove `LOVABLE_AI_URL`, remove `callLovableAI` function, route ALL models through OpenAI API. Update the coach reconciler (~line 644) to use OpenAI. Update `agent-registry.ts` model types.
2. **`supabase/functions/_shared/agent-registry.ts`** — Change all `google/gemini-*` model references to OpenAI equivalents.
3. **`supabase/functions/_shared/utils.ts`** — Replace `callLovableAI()` helper to use OpenAI API instead of Lovable Gateway.

### Individual Edge Functions (16 files)
4. **`account-research/index.ts`** — `gemini-3-pro-preview` → `gpt-5.2`
5. **`admin-transcript-chat/index.ts`** — Two calls: query classification (`gemini-2.5-flash-lite` → `gpt-5-nano`) and main analysis (`gemini-3-pro-preview` → `gpt-5.2`)
6. **`analyze-performance/index.ts`** — `gemini-2.5-flash` → `gpt-5-mini`
7. **`calculate-account-heat/index.ts`** — `gemini-3-pro-preview` → `gpt-5.2`
8. **`calculate-deal-heat/index.ts`** — Two calls: flash for backfill, pro for main. Both → OpenAI equivalents
9. **`chunk-transcripts/index.ts`** — NER extraction (`gemini-2.5-flash-lite` → `gpt-5-nano`). Note: embedding calls already use OpenAI.
10. **`competitor-research/index.ts`** — `gemini-3-pro-preview` → `gpt-5.2`
11. **`edit-recap-email/index.ts`** — `gemini-2.5-flash` → `gpt-5-mini`
12. **`generate-account-follow-ups/index.ts`** — `gemini-3-pro-preview` → `gpt-5.2`
13. **`generate-agreed-next-steps/index.ts`** — `gemini-3-pro-preview` → `gpt-5.2`
14. **`generate-call-follow-up-suggestions/index.ts`** — `gemini-2.5-flash` → `gpt-5-mini`
15. **`generate-coaching-chunk-summary/index.ts`** — `gemini-2.5-flash` → `gpt-5-mini`
16. **`generate-coaching-trends/index.ts`** — `gemini-3-pro-preview` → `gpt-5.2`
17. **`generate-sales-assets/index.ts`** — `gemini-2.5-flash` → `gpt-5-mini`
18. **`regenerate-account-insights/index.ts`** — `gemini-3-pro-preview` → `gpt-5.2`
19. **`roleplay-grade-session/index.ts`** — Remove Lovable AI fallback, use OpenAI only with `gpt-5.2`

### Already Using OpenAI (no changes needed)
- `sales-coach-chat` — already `gpt-5.2` via OpenAI
- `sales-assistant-chat` — already `gpt-5.2` via OpenAI
- `admin-assistant-chat` — already `gpt-5.2` via OpenAI
- `sdr-assistant-chat` — already `gpt-5.2` via OpenAI
- `sdr-process-transcript` — already `gpt-5.2` via OpenAI
- `sdr-grade-call` — already `gpt-5.2` via OpenAI
- `analyze-audio-voice` — already OpenAI
- `transcribe-audio` — already OpenAI
- `roleplay-session-manager` — already OpenAI

## Pattern for Each Change

In every file, the change follows the same pattern:
```typescript
// BEFORE
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
  headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}` },
  body: JSON.stringify({ model: 'google/gemini-2.5-flash', ... })
});

// AFTER
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
await fetch('https://api.openai.com/v1/chat/completions', {
  headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
  body: JSON.stringify({ model: 'gpt-5-mini', ... })
});
```

## Risk & Notes
- All 19 edge functions will be redeployed automatically
- No client-side code changes needed (streaming format is identical between OpenAI and Lovable Gateway)
- `OPENAI_API_KEY` is already configured as a secret
- Error handling for 429/402 remains the same (OpenAI uses the same status codes)

