

# What's Consuming Your Cloud Resources

## Major Sources (ranked by impact)

### 1. Cron-Triggered Edge Functions (every 60 seconds)
The `trigger-pending-analyses` function runs **every minute** via pg_cron, even when there are no pending calls to process. The edge function logs confirm this — every single invocation returns "No pending calls to process." This is the single biggest contributor to unnecessary cloud usage.

Similarly, `check-performance-alerts` and `cleanup-stuck-sessions` run on cron schedules.

### 2. Presence Channel + `last_seen_at` Updates (every 30 seconds)
In `AuthContext.tsx`, every logged-in user:
- Subscribes to a Realtime presence channel (`online-users`)
- Runs a `setInterval` that writes to the database every **30 seconds** to update `last_seen_at`

This means each active browser tab generates ~2 database writes per minute, plus Realtime connection overhead.

### 3. Active User Check (every 60 seconds)
Also in `AuthContext.tsx`, another `setInterval` queries the database every **60 seconds** to check if the user's account is still active (`checkUserActive`). That's another read per minute per user.

### 4. Polling Queries with `refetchInterval`
Several React Query hooks poll the database continuously:
- **Admin Performance Monitor**: 2 queries every 60s (`system-health`, `benchmark-comparison`)
- **Admin stuck calls**: every 30s
- **Sidebar badge counts**: 3 queries every 5 min (tasks, accounts, coaching overdue)
- **Notification unread count**: every 60s
- **SDR transcript/call lists**: every 3s while processing (appropriate, but can add up if items get stuck)
- **RAG health dashboard**: every 5 min
- **Call detail analysis polling**: every 2s while processing

### 5. Realtime Subscriptions (5 active channels)
Multiple components subscribe to Postgres changes:
- Performance alerts, notifications, prospect updates, global activity feed, recent calls

These are efficient on their own but each maintains an open connection.

## Recommended Fixes

### Quick Wins (biggest impact, least effort)
1. **Disable or reduce `trigger-pending-analyses` cron** — It fires every minute doing nothing. Switch to a database trigger that only fires when a transcript is actually inserted, or reduce to every 5-10 minutes.
2. **Reduce `last_seen_at` interval** from 30s → 5 minutes. Nobody needs 30-second precision on "last seen."
3. **Remove `checkUserActive` polling** or reduce from 60s → 5 minutes. Account deactivation is rare; checking every minute is excessive.

### Medium Effort
4. **Make admin polling conditional** — Only poll `system-health` and `benchmark-comparison` when the admin performance monitor page is actually open (they already are page-scoped, but confirm they unmount properly).
5. **Add stuck-state timeouts to SDR polling** — If SDR processing gets stuck, the 3-second polling continues indefinitely. Add a max poll duration (e.g., 5 minutes).

### Lower Priority
6. **Consolidate sidebar badge queries** into a single RPC call instead of 3 separate queries every 5 minutes.

## Implementation Plan

| Change | Files | Impact |
|--------|-------|--------|
| Reduce `trigger-pending-analyses` cron to every 5 min (or use DB trigger) | Migration SQL | ~80% reduction in that function's invocations |
| `last_seen_at` interval 30s → 300s | `src/contexts/AuthContext.tsx` | ~90% fewer writes per user |
| `checkUserActive` interval 60s → 300s | `src/contexts/AuthContext.tsx` | ~80% fewer reads per user |
| Reduce admin monitor polling 60s → 300s | `src/pages/admin/AdminPerformanceMonitor.tsx` | Fewer admin reads |
| Reduce stuck calls polling 30s → 120s | `src/hooks/useCallDetailQueries.ts` | Fewer admin reads |

