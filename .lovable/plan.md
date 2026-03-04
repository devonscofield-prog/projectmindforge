

# Pipeline Performance Review & Optimization Plan

## Current Performance Data (Last 7 Days)

| Agent | Avg (ms) | P90 (ms) | Max (ms) | Errors | Error Rate |
|-------|----------|----------|----------|--------|------------|
| Interrogator | 71,675 | 75,002 | 226,804 | 43 | 55% |
| Speaker Labeler | 50,571 | 69,402 | 181,531 | 41 | 51% |
| Strategist | 38,608 | 50,927 | 194,070 | 1 | 1% |
| Referee | 36,577 | 75,001 | 122,743 | 10 | 13% |
| Spy | 31,776 | 50,723 | 87,328 | 10 | 13% |
| Auditor | 26,798 | 58,895 | 171,361 | 11 | 14% |
| Census | 30,757 | 47,671 | 59,667 | 0 | 0% |
| Negotiator | 30,555 | 54,046 | 90,602 | 0 | 0% |
| Historian | 23,039 | 33,275 | 106,927 | 0 | 0% |
| Profiler | 15,285 | 25,488 | 36,020 | 0 | 0% |
| Skeptic | 9,803 | 12,414 | 19,794 | 1 | 1% |
| Sentinel | 8,626 | 16,901 | 27,581 | 0 | 0% |

---

## Issues Identified

### Issue 1: Interrogator — 55% Error Rate (Critical Bottleneck)
The Interrogator uses `gpt-5-mini` but has a 75s timeout, and 42/43 errors are "timeout after 75s." It's the slowest agent on average (71s) and times out on over half of all calls. This is the single biggest reliability problem.

**Root cause:** `gpt-5-mini` is struggling with the Interrogator's complex question-extraction task on long transcripts. The 75s timeout is insufficient.

**Fix:** Increase Interrogator timeout to 120s (matching Coach). Since this runs in background via fire-and-forget, there's no HTTP timeout concern.

### Issue 2: Speaker Labeler — 51% Error Rate
40/41 errors are "timeout after 60s." The Speaker Labeler processes full transcripts and its 60s timeout is too tight for long calls.

**Fix:** Increase Speaker Labeler timeout to 90s.

### Issue 3: Referee — 13% Error Rate (Timeout)
10 errors, all timeouts at 75s. P90 is exactly 75,001ms (hitting the limit).

**Fix:** Increase Referee timeout to 120s.

### Issue 4: Spy Schema Validation Failures
8 out of 10 Spy errors are schema validation failures: `silver_bullet_question` is required but the AI omits it. This is a schema strictness issue, not a performance issue.

**Fix:** Make `silver_bullet_question` optional (`.optional()`) in the SpySchema, with a coercion fallback.

### Issue 5: Auditor Schema Validation Failures  
6 out of 11 Auditor errors are "coaching_tips array must contain at most 5 elements." The AI returns more tips than allowed.

**Fix:** Add a coercion step to truncate `coaching_tips` to 5 items (like existing `coerceStrategistOutput`).

### Issue 6: Skeptic Category Enum Too Restrictive
1 error where AI returned "Compliance" but enum only allows 12 categories. This will recur.

**Fix:** Add "Compliance" and "Legal" to the Skeptic category enum.

### Issue 7: Serialized Batch 2a/2b — Unnecessary Sequential Wait
Batch 2 is split into 2a (Profiler, Strategist, Referee) and 2b (Interrogator, Negotiator, Auditor) with a 200ms delay between them. Batch 2b "needs context from Strategist" but only for building Negotiator and Auditor prompts. The Interrogator doesn't actually need Strategist output.

**Fix:** Run Interrogator in Batch 2a (parallel with Profiler/Strategist/Referee) instead of waiting for 2b. Keep Negotiator and Auditor in 2b since they genuinely need Strategist context.

### Issue 8: Speaker Labeler Uses `gpt-5-mini` But Needs More Power
The Speaker Labeler has a complex labeling task across entire transcripts. Using `gpt-5-mini` leads to errors like "RE P" (typo in enum value). Upgrade to `gpt-5.2` for reliability.

**Fix:** Change Speaker Labeler model to `gpt-5.2` in the registry.

---

## Summary of Changes

| File | Change |
|---|---|
| `agent-factory.ts` | Increase timeout overrides: speaker_labeler 60s→90s, interrogator 75s→120s, referee 75s→120s, auditor 60s→90s |
| `agent-schemas.ts` | Make `silver_bullet_question` optional; add "Compliance" and "Legal" to Skeptic category enum |
| `agent-factory.ts` | Add `coerceAuditorOutput` to truncate `coaching_tips` to 5 items |
| `agent-factory.ts` | Add `coerceSpyOutput` to provide default `silver_bullet_question` when missing |
| `agent-factory.ts` | Add `coerceSpeakerLabelerOutput` to fix typos like "RE P" → "REP" |
| `agent-registry.ts` | Upgrade Speaker Labeler model from `gpt-5-mini` to `gpt-5.2` |
| `pipeline.ts` | Move Interrogator from Batch 2b to Batch 2a to parallelize it earlier |
| `pipeline.ts` | Remove the 200ms delay between Batch 2a/2b (unnecessary with rate limits relaxed) |
| `pipeline.ts` | Reduce `BATCH_DELAY_MS` from 300ms to 100ms |

### Expected Impact
- Interrogator error rate: 55% → ~5% (timeout headroom doubled)
- Speaker Labeler error rate: 51% → ~10% (timeout + model upgrade)
- Referee error rate: 13% → ~2%
- Spy/Auditor schema errors: eliminated via coercion
- Overall pipeline speed: ~15-20% faster by running Interrogator in parallel with Batch 2a and removing delays

