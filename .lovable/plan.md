

# Email Reminders, Template Editing UX, and Task Analytics

## Overview

Three enhancements to the Rep Task Management page:

1. **Email Reminder Delivery** -- Already fully implemented (edge function, hourly cron, notification preferences UI). No additional work needed here.
2. **Template Drag-and-Drop Reordering** -- Let reps reorder their auto-task templates by dragging them up/down, so they control the sequence tasks are created in.
3. **Task Analytics and Insights** -- A new "Insights" tab on the My Tasks page showing completion rates, overdue trends, category breakdowns, and template effectiveness.

---

## Feature 1: Email Reminder Delivery

This is already production-ready:
- Edge function `send-task-reminders` runs hourly via pg_cron
- Sends consolidated HTML digest emails via Resend (overdue, due today, due tomorrow sections)
- Notification preferences UI exists at Settings with timezone, primary/secondary reminder times, weekend exclusion, and priority filtering
- Test email button works
- No changes needed

---

## Feature 2: Template Drag-and-Drop Reordering

### Approach
Use simple up/down arrow buttons rather than a drag-and-drop library (keeps bundle small, works on mobile, no new dependency needed).

### Changes

**`src/api/taskTemplates.ts`** -- Add `reorderTaskTemplates` function:
- Accepts `repId` and an array of `{ id, sort_order }` pairs
- Batch updates via individual update calls (templates are small lists, typically under 10)

**`src/hooks/useTaskTemplates.ts`** -- Add `useReorderTaskTemplates` mutation hook with optimistic reordering

**`src/components/tasks/TaskTemplateRow.tsx`** -- Add up/down arrow buttons (ChevronUp, ChevronDown) to each row:
- Up arrow disabled on first item, down arrow disabled on last item
- Compact icons alongside existing edit/delete buttons

**`src/components/tasks/TaskTemplatesSection.tsx`** -- Wire up reorder handlers:
- `handleMoveUp(index)` / `handleMoveDown(index)` swap adjacent templates and call the reorder mutation
- Optimistically reorder the local list

---

## Feature 3: Task Analytics and Insights

### New Tab
Add an **"Insights"** tab to `RepTasks.tsx` alongside Pending/Completed/Dismissed/Auto Tasks.

### Data Source
Create a new API function `getTaskAnalytics(repId)` in `src/api/accountFollowUps.ts` that fetches:
- All follow-ups for the rep (pending, completed, dismissed) with `source = 'manual'`
- Aggregates computed client-side (small dataset, under 1000 rows per rep)

### Metrics Displayed

| Metric | Visualization | Description |
|--------|--------------|-------------|
| Completion Rate | Large percentage + progress ring | Completed / (Completed + Dismissed + Pending) |
| Avg. Time to Complete | Number (days) | Average days between created_at and completed_at |
| Overdue Rate | Percentage | Tasks completed after their due date / total completed with due dates |
| Tasks by Priority | Horizontal bar chart | Count of tasks by priority (high/medium/low), stacked by status |
| Tasks by Category | Horizontal bar chart | Count by category (phone call, email, etc.) |
| Weekly Completion Trend | Line/area chart | Tasks completed per week over last 8 weeks |
| Template Effectiveness | Table | For each auto-task template: how many tasks created, completion rate, avg. days to complete |

### New Files

| File | Purpose |
|------|---------|
| `src/components/tasks/TaskInsightsSection.tsx` | Analytics dashboard component with charts and stat cards |
| `src/api/taskAnalytics.ts` | Data fetching and aggregation logic |

### Charts
Use `recharts` (already installed) for:
- `BarChart` for priority/category breakdowns
- `AreaChart` for weekly completion trend
- Simple stat cards using existing `Card` components with large numbers

### UI Layout
```text
+--------------------------------------------------+
| Completion Rate    | Avg. Days to Complete        |
|     78%            |     2.3 days                 |
+--------------------------------------------------+
| Tasks by Priority         | Tasks by Category      |
| [==== High: 12 ====]      | [== Phone Call: 8 ==]  |
| [======= Med: 24 =]       | [== Email: 14 ======]  |
| [=== Low: 6 =======]      | [== Text: 4 ========]  |
+--------------------------------------------------+
| Weekly Completion Trend (last 8 weeks)            |
| [area chart showing completed tasks per week]     |
+--------------------------------------------------+
| Template Effectiveness                            |
| Template Name | Created | Completed | Avg Days    |
| Send recap    |    12   |    10     |   1.5       |
| Follow up     |    8    |    5     |   3.2       |
+--------------------------------------------------+
```

---

## Modified Files Summary

| File | Changes |
|------|---------|
| `src/api/taskTemplates.ts` | Add `reorderTaskTemplates()` function |
| `src/hooks/useTaskTemplates.ts` | Add `useReorderTaskTemplates` mutation |
| `src/components/tasks/TaskTemplateRow.tsx` | Add up/down arrow buttons for reordering |
| `src/components/tasks/TaskTemplatesSection.tsx` | Wire reorder handlers |
| `src/pages/rep/RepTasks.tsx` | Add "Insights" tab |

## New Files

| File | Purpose |
|------|---------|
| `src/api/taskAnalytics.ts` | Fetch and aggregate task data for analytics |
| `src/components/tasks/TaskInsightsSection.tsx` | Analytics dashboard with charts and stats |

## Implementation Sequence

1. Add `reorderTaskTemplates` to API layer and hook
2. Add up/down buttons to `TaskTemplateRow` and wire in `TaskTemplatesSection`
3. Create `src/api/taskAnalytics.ts` with data fetching and aggregation
4. Create `TaskInsightsSection.tsx` with stat cards and recharts visualizations
5. Add "Insights" tab to `RepTasks.tsx`

