

# Revamp Daily Call Report: Opportunity-Centric Focus

## Overview

Shift the Daily Call Report away from effectiveness scores and performer rankings toward **opportunity tracking** -- showing total opportunity size by rep, revenue breakdown by label (Commit/Best Case/Pipeline/Time Waster), expected close month, a single "Best Deal of the Day" highlight, and an honest pipeline integrity summary.

## What Changes

### 1. Edge Function: Fetch Opportunity Data from `call_transcripts`

The `send-daily-report` edge function currently queries `call_transcripts` but only pulls `potential_revenue`. It needs to also select `estimated_opportunity_size`, `target_close_date`, and `opportunity_label`.

### 2. Remove From the Email

- **Avg Effectiveness stat card** -- removed from summary stats
- **Top Performers section** -- removed entirely
- **Needs Attention section** -- removed entirely
- **Top/Bottom Calls by score** -- replaced with "Best Deal of the Day"

### 3. Add to the Email

**A) Summary Stats (revised)**
- Total Calls (kept)
- Total Opportunity Size (sum of `estimated_opportunity_size` across all calls)
- Pipeline stat becomes total opportunity size rather than `potential_revenue`

**B) Opportunity Breakdown by Label**
A table showing revenue grouped by opportunity label:

| Label | Calls | Total Opp Size |
|-------|-------|----------------|
| Commit | 3 | $150,000 |
| Best Case | 5 | $320,000 |
| Pipeline | 8 | $480,000 |
| Time Waster | 2 | $10,000 |

**C) Revenue by Expected Close Month**
A table bucketing `estimated_opportunity_size` by the month from `target_close_date`:

| Close Month | Total Opp Size | # Deals |
|-------------|----------------|---------|
| Feb 2026 | $200,000 | 4 |
| Mar 2026 | $350,000 | 6 |
| Q2+ | $410,000 | 8 |

**D) Best Deal of the Day**
Pick the single call with the highest `estimated_opportunity_size` where `opportunity_label` is "commit" or "best_case" (highest chance to close). Show rep name, account, opp size, label, target close date, and a short summary.

**E) Pipeline Integrity Summary**
For each rep, compare what they labeled vs. what the AI analysis says. Flag calls where:
- The rep labeled something "Commit" but the AI call summary/score suggests otherwise (e.g., low effectiveness score, or summary mentions objections/uncertainty)
- Large opportunities with no clear next steps in the summary

This is a short, honest blurb per rep that has questionable labels. If everything looks consistent, show a positive confirmation.

**F) Rep Breakdown (revised)**
Replace the avg score column with opportunity columns:

| Rep | Calls | Total Opp Size | Commit | Best Case | Pipeline |
|-----|-------|----------------|--------|-----------|----------|

### 4. Update Report Section Toggles

Replace the old section keys with new ones in both the database defaults and the UI:

| Old Section | New Section |
|-------------|-------------|
| `summary_stats` | `summary_stats` (kept, content changes) |
| `wow_trends` | `wow_trends` (kept) |
| `top_calls` | `best_deal` (renamed) |
| `bottom_calls` | `label_breakdown` (new) |
| `top_performers` | `close_month_breakdown` (new) |
| `needs_attention` | `pipeline_integrity` (new) |
| `rep_breakdown` | `rep_breakdown` (kept, columns change) |
| `pipeline` | removed (merged into summary) |

### 5. Update On-Demand Reports to Match

Update the Team Performance report in `reportingApi.ts` and `ReportResultsTable.tsx` to include `estimated_opportunity_size`, `opportunity_label`, and `target_close_date` data. Update column definitions accordingly.

---

## Technical Details

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/send-daily-report/index.ts` | Fetch opportunity fields, rebuild email HTML with new sections, remove effectiveness/performer sections |
| `src/api/dailyReportConfig.ts` | Update `ReportSections` interface with new keys (`best_deal`, `label_breakdown`, `close_month_breakdown`, `pipeline_integrity`), remove old keys (`top_calls`, `bottom_calls`, `top_performers`, `needs_attention`, `pipeline`) |
| `src/components/settings/ReportSectionToggles.tsx` | Update section option labels and descriptions to match new sections |
| `src/components/settings/DailyReportSettings.tsx` | No structural changes, just picks up new section keys |
| `src/api/reportingApi.ts` | Add opportunity fields to `TeamPerformanceRow`, fetch `estimated_opportunity_size`, `opportunity_label`, `target_close_date` in the query |
| `src/components/reporting/ReportResultsTable.tsx` | Add new columns for opportunity data in team performance table |
| `src/components/reporting/ColumnSelector.tsx` | Update column definitions for team performance to include opportunity columns |

### Database Migration

Update the default value for the `report_sections` JSONB column to reflect the new section keys:

```sql
ALTER TABLE daily_report_configs
ALTER COLUMN report_sections SET DEFAULT '{
  "summary_stats": true,
  "wow_trends": true,
  "best_deal": true,
  "label_breakdown": true,
  "close_month_breakdown": true,
  "pipeline_integrity": true,
  "rep_breakdown": true
}'::jsonb;
```

Existing rows with old keys will be handled gracefully -- the edge function and frontend will merge with defaults, so missing new keys default to `true` and old keys are simply ignored.

### Pipeline Integrity Logic

The "honest pipeline summary" compares:
1. The rep's `opportunity_label` on each call
2. The AI's `call_effectiveness_score` and `call_summary`

Flagging rules:
- "Commit" label + effectiveness score < 50 = flag as questionable
- "Commit" or "Best Case" label + summary containing keywords like "objection", "not interested", "no budget", "postpone" = flag
- Large opp size (top quartile) with no summary available = flag as needs review

The output is a short per-rep note in the email, e.g.:
> **John S.** -- 1 call labeled "Commit" ($80k, Acme Corp) scored 38 with objections noted. Worth reviewing.

If no flags, show: "All opportunity labels appear consistent with call outcomes."

### Email Layout (New Structure)

```text
+------------------------------------------+
| Daily Call Report - Feb 8, 2026           |
| Hi [Name]                                |
+------------------------------------------+
| [Total Calls]  [Total Opp Size]          |
|  with WoW trends                         |
+------------------------------------------+
| Best Deal of the Day                     |
| Rep - Account - $X - Commit - Mar 2026   |
| "Summary snippet..."                     |
+------------------------------------------+
| Opportunity by Label                     |
| Commit: $X (N calls)                     |
| Best Case: $X (N calls)                  |
| Pipeline: $X (N calls)                   |
| Time Waster: $X (N calls)               |
+------------------------------------------+
| Revenue by Expected Close Month          |
| Feb 2026: $X (N deals)                   |
| Mar 2026: $X (N deals)                   |
+------------------------------------------+
| Pipeline Integrity Check                 |
| John: 1 "Commit" call scored low...      |
| Sarah: All labels look consistent        |
+------------------------------------------+
| Rep Breakdown                            |
| Rep | Calls | Opp Size | Commit | ...   |
+------------------------------------------+
```

