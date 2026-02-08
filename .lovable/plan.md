

# Fix Daily Email Report System -- All Identified Issues

## Issues to Address

1. **Monday Gap Bug** -- When weekends are disabled, Monday's report only looks back 1 day (Sunday), so Friday's calls are never reported.
2. **Duplicate Send Risk** -- No deduplication check; if cron fires twice in the same hour, users get duplicate emails.
3. **Outlook Email Compatibility** -- The template uses `display:flex` which breaks in Outlook; needs table-based layout.
4. **Week-over-Week Trends** -- No comparison data showing how today's numbers compare to the prior period.
5. **Unsubscribe Link** -- No one-click unsubscribe for compliance and convenience.
6. **Delivery Status Visibility** -- No way for managers/admins to see if their reports have been sent or what they contained.

---

## Changes

### 1. Fix Monday Gap (Edge Function)

**File:** `supabase/functions/send-daily-report/index.ts`

Current logic (lines 252-255):
```
let daysBack = 1;
if (dayOfWeek === 1 && config.include_weekends) {
  daysBack = 3;
}
```

This only looks back 3 days on Monday when `include_weekends` is true. When weekends are OFF, Monday looks back 1 day (Sunday), skipping Friday entirely.

**Fix:** On Monday, always look back to Friday (3 days). When weekends are enabled, the weekend calls are already included. When weekends are disabled, Monday should still cover Friday. The `daysBack` should also skip Saturday/Sunday reports when weekends are off (already handled by the `isWeekend` check), but the Monday lookback needs to go to Friday regardless.

```text
if dayOfWeek === 1:
  daysBack = 3  // Always cover Fri-Sun on Monday
else:
  daysBack = 1
```

### 2. Duplicate Send Prevention (Edge Function)

**File:** `supabase/functions/send-daily-report/index.ts`

Before sending each report, check `notification_log` for an existing entry with the same `user_id`, `notification_type = 'daily_call_report'`, and `sent_at` within the current hour. If found, skip that user.

Add this check at the beginning of the `for (const config of usersToProcess)` loop (around line 152):

```text
// Check notification_log for duplicate in same hour
const hourStart = new Date(now)
hourStart.setMinutes(0, 0, 0)

query notification_log where:
  user_id = config.user_id
  notification_type = 'daily_call_report'
  sent_at >= hourStart.toISOString()

if found -> skip this user with a log message
```

### 3. Outlook-Compatible Email Template (Edge Function)

**File:** `supabase/functions/send-daily-report/index.ts`

Replace all `display:flex` layouts with table-based equivalents. The main areas affected:

- **Summary Stats row** (line 517): Three stat cards side-by-side using `display:flex;gap:16px` -- replace with a 3-column `<table>` with `<td>` cells
- **Call snippet** `callSnippet` function (line 431): Uses `display:flex;justify-content:space-between` -- replace with a 2-column table row
- **Pipeline stat card** (line 484): Nested inside the flex stats row -- becomes a third `<td>` in the stats table

No visual change intended; purely a rendering compatibility fix.

### 4. Week-over-Week Trend Data (Edge Function)

**File:** `supabase/functions/send-daily-report/index.ts`

After fetching the current period's calls, also fetch the previous equivalent period for comparison:

```text
// If current period is Mon (covering Fri-Sun), previous period is the prior Fri-Sun
// If current period is 1 day, previous period is the same weekday last week
prevStart = reportStart - 7 days
prevEnd = reportEnd - 7 days

Fetch calls for prevStart-prevEnd with same rep filters
Calculate: prevTotalCalls, prevAvgEffectiveness, prevTotalPipeline
```

Add trend indicators to the email template:
- Next to "Calls Analyzed": show arrow + percentage change (e.g., "+12%" or "-5%")
- Next to "Avg Effectiveness": show arrow + point change
- Next to "Est. Pipeline": show arrow + percentage change

Display as a small colored indicator beneath each stat (green for up, red for down, gray for no change). Only show if previous period had data.

### 5. Unsubscribe Link (Edge Function + Settings)

**File:** `supabase/functions/send-daily-report/index.ts`

Add to the email footer (line 573-575), replacing the current plain text:

```text
<p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px;">
  Sent by MindForge |
  <a href="{dashboardUrl}/settings" style="color:#6b7280;">Manage report settings</a> |
  <a href="{dashboardUrl}/api/unsubscribe-report?token={token}" style="color:#6b7280;">Unsubscribe</a>
</p>
```

**New edge function:** `supabase/functions/unsubscribe-report/index.ts`

- Accepts a signed JWT token containing `user_id`
- Sets `enabled = false` on the user's `daily_report_configs` row
- Returns a simple HTML page confirming the unsubscription
- Token is generated in `send-daily-report` using a simple HMAC with the service role key as secret

### 6. Delivery Status UI (Frontend)

**File:** `src/components/settings/DailyReportSettings.tsx`

Add a "Recent Deliveries" section below the "Send Test Report" button that queries `notification_log` for the user's recent `daily_call_report` entries and displays them in a small list:

```text
Recent Deliveries:
  Feb 7, 2026 - 42 calls, avg 68  [Delivered]
  Feb 6, 2026 - 38 calls, avg 71  [Delivered]
  Feb 5, 2026 - 45 calls, avg 65  [Delivered]
```

**New API function in:** `src/api/dailyReportConfig.ts`

- `getReportDeliveryHistory(limit = 10)` -- queries `notification_log` filtered to `notification_type = 'daily_call_report'` and `user_id = current user`

---

## Files Created/Modified

| File | Action | Change |
|------|--------|--------|
| `supabase/functions/send-daily-report/index.ts` | Modify | Fix Monday gap, add dedup check, table-based email, WoW trends, unsubscribe link |
| `supabase/functions/unsubscribe-report/index.ts` | Create | One-click unsubscribe endpoint |
| `src/api/dailyReportConfig.ts` | Modify | Add `getReportDeliveryHistory()` |
| `src/components/settings/DailyReportSettings.tsx` | Modify | Add delivery history section |

No database migrations needed -- all changes use existing tables (`daily_report_configs`, `notification_log`).
