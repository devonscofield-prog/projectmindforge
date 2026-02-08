

# Add Report Customization Options

## Overview

Add toggleable sections/columns so users can choose exactly what information appears in both on-demand reports and daily email reports.

## What Changes

### 1. Database Migration -- Add `report_sections` column

Add a JSONB column `report_sections` to `daily_report_configs` that stores which email sections are enabled:

```sql
ALTER TABLE daily_report_configs
ADD COLUMN report_sections jsonb DEFAULT '{
  "summary_stats": true,
  "wow_trends": true,
  "top_calls": true,
  "bottom_calls": true,
  "top_performers": true,
  "needs_attention": true,
  "rep_breakdown": true,
  "pipeline": true
}'::jsonb;
```

All sections default to ON so existing users see no change.

### 2. Daily Email Settings UI -- Section Toggles

**File:** `src/components/settings/DailyReportSettings.tsx`

Add a new "Report Sections" area (below Include Weekends, above Send Test) with checkboxes for each email section:

| Toggle | Controls |
|--------|----------|
| Summary Stats | The 2-3 stat cards at the top (calls, effectiveness, pipeline) |
| Week-over-Week Trends | The trend arrows beneath each stat |
| Best Calls | Top-scoring call highlights |
| Calls to Review | Lowest-scoring call highlights |
| Top Performers | Reps with scores >= 70 |
| Needs Attention | Reps with scores < 50 |
| Rep Breakdown | Full per-rep table |
| Pipeline Data | Pipeline/revenue figures throughout the report |

Each is a checkbox that updates the `report_sections` JSONB via the existing `handleUpdate` flow.

### 3. Update Types and API

**File:** `src/api/dailyReportConfig.ts`

- Add `report_sections` to `DailyReportConfig` and `DailyReportConfigUpdate` interfaces
- Define a `ReportSections` interface with the 8 boolean keys

### 4. Edge Function -- Conditionally Render Sections

**File:** `supabase/functions/send-daily-report/index.ts`

- Read `report_sections` from the config (default all true if null)
- Pass the sections object into `buildEmailHtml`
- Wrap each email section in a conditional: only include the HTML if that section's flag is true
- When pipeline is off, hide the pipeline stat card AND the pipeline column in rep breakdown

### 5. On-Demand Report Column Selector

**File:** `src/components/reporting/OnDemandReportGenerator.tsx`

Add a "Columns" multi-select (using checkboxes in a popover) that lets users toggle which columns appear in the results table. Each report type has its own set of toggleable columns:

| Report Type | Available Columns |
|-------------|-------------------|
| Team Performance | Rep, Calls, Avg Effectiveness, Pipeline |
| Individual Rep | Date, Account, Score, Summary |
| Pipeline | Prospect, Account, Heat, Potential Rev, Active Rev, Rep |
| Coaching Activity | Rep, Sessions, Latest Session |

The selected columns are passed as a `visibleColumns` prop to `ReportResultsTable`, which conditionally renders only the chosen columns. Defaults: all columns ON. The CSV export also respects the column selection.

### 6. Update ReportResultsTable

**File:** `src/components/reporting/ReportResultsTable.tsx`

Accept a `visibleColumns` prop (string array). Only render `<TableHead>` and `<TableCell>` for columns in the array. The `exportToCsv` call also filters to only the visible columns.

---

## Technical Details

### Files to Create

None -- all changes are in existing files.

### Files to Modify

| File | Change |
|------|--------|
| `daily_report_configs` table | Add `report_sections` JSONB column via migration |
| `src/api/dailyReportConfig.ts` | Add `ReportSections` interface, update config types |
| `src/components/settings/DailyReportSettings.tsx` | Add section toggle checkboxes |
| `supabase/functions/send-daily-report/index.ts` | Read `report_sections`, conditionally render email sections |
| `src/components/reporting/OnDemandReportGenerator.tsx` | Add column selector popover with per-report-type defaults |
| `src/components/reporting/ReportResultsTable.tsx` | Accept `visibleColumns` prop, filter rendered columns and CSV export |

### Default Behavior

- Existing users: all sections/columns ON (no behavior change)
- New users: all sections/columns ON by default
- The `report_sections` JSONB defaults ensure backward compatibility even if the column is null

