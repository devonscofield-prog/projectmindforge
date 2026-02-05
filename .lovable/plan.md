

# Auto-Task Templates (Task Sets for Call Submissions)

## Overview
Allow reps to define a reusable set of task templates on the "My Tasks" page. When enabled, every time they submit a call, the system automatically creates those tasks linked to the call's account. This saves reps from manually creating the same follow-up tasks after every call.

---

## How It Works

1. On the **My Tasks** page, a new "Task Templates" section (or a gear/settings button) lets the rep define a list of template tasks
2. Each template has: title, category, priority, and a relative due date (e.g., "1 day after call", "3 days after call")
3. Reps can toggle the entire set on/off
4. When a call is submitted, the system checks if the rep has an active task set and automatically creates the tasks linked to the call's prospect

---

## Database Changes

### New table: `rep_task_templates`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Default `gen_random_uuid()` |
| rep_id | uuid (FK profiles) | NOT NULL |
| title | text | NOT NULL |
| description | text | Nullable |
| priority | text | Default 'medium' |
| category | text | Nullable (phone_call, drip_email, etc.) |
| due_days_offset | integer | Days after call date for due date (nullable) |
| reminder_enabled | boolean | Default false |
| reminder_time | time | Default '09:00' |
| sort_order | integer | For ordering templates in the list |
| is_active | boolean | Default true |
| created_at | timestamptz | Default now() |
| updated_at | timestamptz | Default now() |

### New table: `rep_task_template_settings`

| Column | Type | Notes |
|--------|------|-------|
| rep_id | uuid (PK, FK profiles) | One row per rep |
| auto_create_enabled | boolean | Default true -- master toggle |
| updated_at | timestamptz | Default now() |

### RLS Policies
- Reps can SELECT/INSERT/UPDATE/DELETE their own rows (`auth.uid() = rep_id`)
- Admins can manage all rows

---

## New Files

| File | Purpose |
|------|---------|
| `src/api/taskTemplates.ts` | CRUD operations for `rep_task_templates` and `rep_task_template_settings` |
| `src/components/tasks/TaskTemplatesSection.tsx` | UI section on RepTasks page for managing templates |
| `src/components/tasks/TaskTemplateRow.tsx` | Individual template row with inline edit |
| `src/components/tasks/AddTaskTemplateDialog.tsx` | Dialog for adding a new template to the set |
| `src/hooks/useTaskTemplates.ts` | React Query hooks for template CRUD and auto-creation |

---

## Modified Files

| File | Changes |
|------|---------|
| `src/pages/rep/RepTasks.tsx` | Add a "Task Templates" tab or section with toggle and template list |
| `src/api/aiCallAnalysis/transcripts.ts` | After prospect linking, fetch rep's active templates and bulk-create follow-ups |

---

## UI Design on RepTasks Page

- Add a new **"Auto Tasks"** tab alongside Pending/Completed/Dismissed
- The tab shows:
  - A master toggle: "Automatically create these tasks for every call I submit"
  - An ordered list of template tasks showing title, category, priority, and "X days after call"
  - Add/Edit/Delete/Reorder controls
  - An "Add Template" button that opens a simplified dialog (title, category, priority, due days offset, reminder settings)

---

## Auto-Creation Flow

When `createCallTranscriptAndAnalyze()` runs:

1. After the prospect is resolved (line ~126), query `rep_task_template_settings` to check if auto-create is enabled
2. If enabled, fetch all active `rep_task_templates` for the rep ordered by `sort_order`
3. For each template, call `createManualFollowUps()` (already exists as a batch insert) with:
   - `prospectId` = the resolved prospect
   - `repId` = the authenticated user
   - `title`, `description`, `priority`, `category` from template
   - `dueDate` = call date + `due_days_offset` (if set)
   - `reminderEnabled` and `reminderTime` from template
   - `sourceCallId` = the new transcript ID
4. This is non-blocking (fire-and-forget with logging) so it doesn't slow down call submission

---

## Technical Details

### API Layer (`src/api/taskTemplates.ts`)

```text
fetchTaskTemplates(repId) -> TaskTemplate[]
createTaskTemplate(repId, params) -> TaskTemplate
updateTaskTemplate(id, params) -> TaskTemplate
deleteTaskTemplate(id) -> void
reorderTaskTemplates(repId, orderedIds) -> void
getAutoCreateSetting(repId) -> { enabled: boolean }
setAutoCreateSetting(repId, enabled) -> void
applyTaskTemplates(repId, prospectId, callId, callDate) -> AccountFollowUp[]
```

The `applyTaskTemplates` function is called from the call submission flow. It fetches active templates, calculates due dates relative to the call date, and batch-inserts follow-ups.

### Add Template Dialog

Simplified version of StandaloneTaskDialog without the account picker (since account is determined at call submission time):
- Title (required)
- Description (optional)
- Priority (high/medium/low)
- Category (phone call, DRIP email, text message, follow up email)
- Due date offset: "Due X days after call" with presets (1, 3, 7, 14 days) or custom
- Reminder toggle and time

### Integration Point in Call Submission

In `src/api/aiCallAnalysis/transcripts.ts`, after the prospect linking block (~line 160), add:

```text
// Auto-create tasks from rep's task templates (non-blocking)
if (prospectId) {
  applyTaskTemplates(repId, prospectId, transcript.id, callDate)
    .then(tasks => log.info('Auto-created tasks from templates', { count: tasks.length }))
    .catch(err => log.warn('Failed to auto-create template tasks', { error: err }));
}
```

---

## Implementation Sequence

1. Create database migration (new tables + RLS + updated_at trigger)
2. Create `src/api/taskTemplates.ts` with all CRUD + apply function
3. Create `AddTaskTemplateDialog.tsx` component
4. Create `TaskTemplateRow.tsx` for individual template display/edit
5. Create `TaskTemplatesSection.tsx` combining toggle + list + add button
6. Add "Auto Tasks" tab to `RepTasks.tsx`
7. Wire `applyTaskTemplates` into `createCallTranscriptAndAnalyze`
8. Create `useTaskTemplates.ts` hooks for queries and mutations

