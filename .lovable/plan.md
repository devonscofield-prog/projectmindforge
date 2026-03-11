

## Plan: Switch Sales Coach Chat to Anthropic Claude Sonnet 4.6

**Single file edit**: `supabase/functions/sales-coach-chat/index.ts`

### Changes

1. Replace OpenAI fetch call with Anthropic Messages API (`https://api.anthropic.com/v1/messages`)
2. Model: `claude-sonnet-4-6`
3. Headers: `x-api-key` + `anthropic-version: 2023-06-01`
4. Request body restructure:
   - System prompt moves to top-level `system` field
   - `max_tokens: 32768` replaces `max_completion_tokens`
   - `stream: true`
5. SSE translation layer: Read Anthropic's `content_block_delta` events and re-emit as OpenAI-compatible format so the frontend needs zero changes
6. Secret: Use `ANTHROPIC_API_KEY` — will prompt you to add it
7. Update error handling references from OpenAI to Anthropic

### Frontend impact
**None** — same SSE format emitted, `src/api/salesCoach.ts` unchanged.

