
# Daily Call Report System

## Overview

Build an automated daily report that emails managers/admins a summary of the previous day's calls every weekday. The report includes who had good/bad calls, call effectiveness scores, and estimated pipeline created. Managers can customize which reps they receive reports for and when the email arrives.

---

## Database Changes

### New Table: `daily_report_configs`

Stores each manager/admin's report preferences.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Auto-generated |
| user_id | uuid (FK profiles) | The manager/admin receiving the report |
| enabled | boolean | Whether reports are active (default true) |
| delivery_time | text | Time in HH:MM format (default "08:00") |
| timezone | text | IANA timezone (default "America/New_York") |
| rep_ids | uuid[] | Array of rep IDs to include; null = all team members |
| include_weekends | boolean | Whether to send on Mon about Sat/Sun calls (default false) |
| created_at | timestamptz | Auto-set |
| updated_at | timestamptz | Auto-set |

RLS: Users can only read/write their own config rows. Service role used by the edge function.

---

## Edge Function: `send-daily-report`

A new scheduled edge function that:

1. Fetches all `daily_report_configs` where `enabled = true`
2. Filters to users whose local time matches `delivery_time` (same pattern as `send-task-reminders`)
3. Skips weekends unless `include_weekends` is true
4. For each config, queries yesterday's calls:
   - From `call_transcripts` joined with `ai_call_analysis` and `profiles`
   - Filtered to the configured `rep_ids` (or all team reps if null, determined via `teams.manager_id`)
   - Extracts: rep name, account name, call type, `call_effectiveness_score`, `potential_revenue`, `deal_heat_analysis`
5. Builds a summary:
   - Total calls count
   - Top performers (highest effectiveness scores)
   - Calls needing attention (lowest scores)
   - Estimated pipeline created (sum of `potential_revenue` from yesterday's calls)
   - Per-rep breakdown table
6. Sends a styled HTML email via Resend
7. Logs to `notification_log` table

The function will be registered in `config.toml` with `verify_jwt = false` (called by CRON).

### CRON Schedule

A `pg_cron` job that runs every hour to check if any user's local delivery time matches, identical to the task reminders pattern.

---

## Frontend: Settings UI

### New Section on Settings Page

Add a "Daily Call Report" settings card (for manager/admin roles only) with:

- **Enable/Disable toggle** for the daily report
- **Delivery time** picker (dropdown of hour slots)
- **Timezone** selector (auto-detected, editable)
- **Rep selection** - multi-select checklist of reps on their team(s), with an "All Team Members" option
- **Send Test Report** button (calls the edge function in test mode, like task reminders)

This section only renders for users with `manager` or `admin` roles.

---

## Report Email Content

The HTML email will include:

```text
+-----------------------------------------------+
|  Daily Call Report - [Date]                    |
|  [Team Name]                                   |
+-----------------------------------------------+
|                                                 |
|  SUMMARY                                        |
|  - 12 calls analyzed                           |
|  - Avg effectiveness: 7.2/10                   |
|  - Est. pipeline created: $45,000              |
|                                                 |
|  TOP PERFORMERS                                 |
|  - Sarah M. (9.1 avg, 3 calls)                |
|  - James K. (8.5 avg, 2 calls)                |
|                                                 |
|  NEEDS ATTENTION                                |
|  - Mike R. (4.2 avg, 2 calls)                 |
|                                                 |
|  REP BREAKDOWN TABLE                           |
|  Rep | Calls | Avg Score | Pipeline             |
|  ----|-------|-----------|----------            |
|  ... | ...   | ...       | ...                  |
|                                                 |
|  [View Full Dashboard ->]                       |
+-----------------------------------------------+
```

---

## Technical Details

### Files to Create
- `supabase/functions/send-daily-report/index.ts` - The edge function
- `src/components/settings/DailyReportSettings.tsx` - Settings UI component
- `src/api/dailyReportConfig.ts` - API helpers for CRUD on configs

### Files to Modify
- `supabase/config.toml` - Add `[functions.send-daily-report]` entry
- Settings page file - Import and render the new DailyReportSettings component (for manager/admin only)

### Implementation Sequence
1. Create the `daily_report_configs` table with RLS policies
2. Create the `send-daily-report` edge function
3. Build the settings UI component
4. Wire up the settings component into the existing Settings page
5. Set up the CRON job (hourly schedule)
6. Test end-to-end with the "Send Test Report" button
