

# New "Reporting" Section for Managers and Admins

## Overview

Create a dedicated **Reporting** section accessible from the sidebar for managers and admins. This section will serve as a hub for generating on-demand reports and managing daily email report settings (moved out of the general Settings page).

## What Gets Built

### 1. New Reporting Page (`/admin/reporting` and `/manager/reporting`)

A tabbed page with two sections:

- **On-Demand Reports** -- Generate and download reports instantly
- **Daily Email Settings** -- The existing `DailyReportSettings` component, relocated from Settings

**On-Demand Report Types:**

| Report | Description |
|--------|-------------|
| Team Performance Summary | Call volume, avg effectiveness, pipeline by rep for a selected date range |
| Individual Rep Report | Deep dive on a single rep: calls, scores, coaching sessions, trends |
| Pipeline Report | All deals/prospects with revenue estimates, heat scores, and stage |
| Coaching Activity Report | AI coaching session counts and themes by rep |

Each report will have:
- Date range picker (preset: Today, Last 7 Days, Last 30 Days, Custom)
- Rep filter (for admins/managers with multiple reps)
- "Generate Report" button that calls the existing `send-daily-report` edge function with custom parameters, or renders results in-page
- Export to CSV option for tabular data

### 2. Sidebar Navigation Update

Add a "Reporting" nav item to both admin and manager sidebar groups:

- **Admin sidebar**: New group "Reporting" with a single item pointing to `/admin/reporting`
- **Manager sidebar**: New item in an appropriate group pointing to `/manager/reporting`

### 3. Move Daily Report Settings

- Remove `<DailyReportSettings />` from the Settings page (keep it only for manager/admin roles in the new Reporting page)
- The Settings page will no longer show the Daily Call Report card for managers/admins

---

## Technical Details

### Files to Create

| File | Purpose |
|------|---------|
| `src/pages/admin/AdminReporting.tsx` | Main reporting page with tabs for on-demand reports and daily email settings |
| `src/components/reporting/OnDemandReportGenerator.tsx` | Component with date range picker, rep filter, report type selector, and results display |
| `src/components/reporting/ReportResultsTable.tsx` | Reusable table component for displaying generated report data |
| `src/api/reportingApi.ts` | API functions to query call data, coaching data, and pipeline data for custom date ranges |

### Files to Modify

| File | Change |
|------|--------|
| `src/components/layout/AppLayout.tsx` | Add "Reporting" nav item to `adminNavGroups` and `managerNavGroups` |
| `src/App.tsx` | Add routes for `/admin/reporting` and `/manager/reporting` |
| `src/pages/UserSettings.tsx` | Remove the `DailyReportSettings` import and rendering for manager/admin |
| `src/lib/routes.ts` | Add `getReportingUrl()` helper |

### Route Configuration

- `/admin/reporting` -- Protected for admin role
- `/manager/reporting` -- Protected for manager role
- Both render the same `AdminReporting` page component (it adapts based on role)

### On-Demand Report Data Flow

The on-demand reports will query the database directly from the frontend using the existing Supabase client (respecting RLS). No new edge functions are needed since admins and managers already have read access to calls, prospects, coaching sessions, and profiles through existing RLS policies.

```text
User selects report type + date range + rep filter
  -> reportingApi.ts queries relevant tables
  -> Results rendered in ReportResultsTable
  -> Optional: Export to CSV via client-side generation
```

### Page Layout

The reporting page uses a tab-based layout:

```text
+------------------------------------------+
|  Reporting                                |
|  [On-Demand Reports]  [Daily Email]       |
+------------------------------------------+
|                                           |
|  Report Type:  [Team Performance v]       |
|  Date Range:   [Last 7 Days v]  or Custom |
|  Reps:         [All Team Members v]       |
|                                           |
|  [Generate Report]     [Export CSV]        |
|                                           |
|  +--------------------------------------+ |
|  | Results Table                        | |
|  | Rep | Calls | Avg Score | Pipeline   | |
|  | ... | ...   | ...       | ...        | |
|  +--------------------------------------+ |
+------------------------------------------+
```

The "Daily Email" tab contains the existing `DailyReportSettings` and `ReportDeliveryHistory` components, unchanged.

### No Database Changes Required

All data is already accessible through existing tables and RLS policies. The on-demand reports simply query `call_transcripts`, `call_analyses`, `prospects`, `profiles`, and `sales_coach_sessions` with date and rep filters.

