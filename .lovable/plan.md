

# Reducing Cloud Usage Costs

## Current Cost Drivers Identified

### 1. Client-Side Performance Metrics (HIGH IMPACT)
The `performanceCollector.ts` writes every slow query (>500ms) and every error to the `performance_metrics` database table. With multiple users, this generates a continuous stream of database inserts from every browser session. Edge functions also write metrics via `logEdgeMetric`. This table likely has thousands of rows growing daily with no automatic cleanup.

**Fix:** Disable client-side metric collection in production (or make it sample-based), and add a retention policy to auto-delete old metrics.

### 2. Realtime Subscriptions (MEDIUM IMPACT)
Currently active Realtime channels:
- `online-users` (presence tracking for every logged-in user)
- `in-app-notifications-realtime`
- `performance-alerts-realtime`
- `admin-recent-calls`
- `audio-processing-{id}` (per-transcript)
- `call-analysis-{id}` (per-call)

Each channel consumes Realtime connection resources. The presence tracker and performance alert listener run for every user at all times.

**Fix:** Only subscribe to channels that are actively needed. Remove the performance alerts realtime listener for non-admin users. Lazy-load presence tracking.

### 3. Polling Intervals (MEDIUM IMPACT)
Several queries poll on intervals even when not needed:
- Sidebar badge counts poll every 5 minutes (3 separate queries running always)
- Notification count polls every 60 seconds
- Call detail follow-up suggestions poll every 2 minutes
- Call analysis polls every 2 seconds while processing
- SDR queries poll every 3 seconds while processing

**Fix:** Increase notification polling to 5 minutes (realtime already handles instant updates). Remove the follow-up suggestions polling entirely. Sidebar badge polling is already reasonable at 5 minutes.

### 4. Edge Function Metric Logging (LOW-MEDIUM IMPACT)
Four edge functions (`transcribe-audio`, `analyze-audio-voice`, `sdr-grade-call`, `sdr-process-transcript`) write metrics to the database on every invocation. These are useful for debugging but add DB writes.

**Fix:** Make edge function metric logging conditional or sample-based.

### 5. Performance Metrics Table Growth (LOW IMPACT)
The `cleanup_old_metrics()` function exists but is never called automatically. The table grows unbounded.

**Fix:** Add a periodic call or reduce retention to 7 days.

## Recommended Changes (Ordered by Impact)

### Phase 1 — Quick Wins
1. **Disable client-side performance metric collection in production** — Change `performanceCollector.ts` to skip all inserts in production, or sample at 10%. This alone will significantly reduce database writes.
2. **Increase notification polling from 60s to 5 minutes** — Realtime subscription already handles instant delivery.
3. **Remove follow-up suggestions 2-minute polling** — These don't change frequently enough to justify constant polling.

### Phase 2 — Realtime Optimization
4. **Gate performance alert realtime subscription to admin role only** — Non-admin users don't see these alerts.
5. **Lazy-load presence tracking** — Only activate when viewing pages that display online status.

### Phase 3 — Database Cleanup
6. **Auto-cleanup performance_metrics older than 7 days** — Either via a scheduled edge function or by calling the existing `cleanup_old_metrics()` function on a cron.

## Estimated Impact
- Phase 1 alone should reduce database operations by 40-60% for typical usage
- Phase 2 reduces Realtime connection costs
- Phase 3 prevents table bloat and keeps query performance fast

