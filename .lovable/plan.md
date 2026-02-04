# Add "The Scribe" Agent to the Analysis Pipeline

## ✅ COMPLETED

The Scribe agent has been added to the analysis pipeline. Call notes are now generated automatically during analysis.

### Changes Made

| File | Changes |
|------|---------|
| `supabase/functions/_shared/agent-schemas.ts` | Added `ScribeSchema` and `ScribeOutput` type |
| `supabase/functions/_shared/agent-prompts.ts` | Added `SCRIBE_PROMPT` |
| `supabase/functions/_shared/agent-registry.ts` | Added Scribe agent config with `DEFAULT_SCRIBE` as Phase 2 agent |
| `supabase/functions/_shared/pipeline.ts` | Added Scribe to Phase 2 (parallel with Coach), added `buildScribeInput` function, updated `PipelineResult` interface |
| `supabase/functions/analyze-call/index.ts` | Stores `sales_assets` and `sales_assets_generated_at` in analysis data |
| `src/pages/calls/CallDetailPage.tsx` | Changed button to "View Call Notes" with checkmark badge when notes exist |
| `src/components/calls/SalesAssetsGenerator.tsx` | Simplified to viewer-first UX (generate CTA only shows if no notes exist) |

### Result

1. **Automatic notes** - Notes generated during analysis, no manual step required
2. **Faster user experience** - Notes ready immediately when analysis completes
3. **Parallel execution** - Scribe runs alongside Coach in Phase 2, minimal added latency
4. **Preserved functionality** - Users can still edit, copy, and regenerate notes
5. **Visual indicator** - Button shows "View Call Notes" with checkmark when notes exist

