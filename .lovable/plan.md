

# Auto-Task Sequences: Named Groups of Tasks Selectable Per Call

## Overview
Currently, task templates are a flat list that auto-applies to **every** call. This redesign introduces **sequences** -- named collections of tasks that reps can choose from when submitting a call. For example, a rep might have a "Discovery Follow-Up" sequence (with 3 tasks) and a "Demo Follow-Up" sequence (with 5 tasks), then pick the right one at submission time.

## Database Changes

### New table: `rep_task_sequences`
Stores the named sequence (the group).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| rep_id | uuid (FK profiles) | Owner |
| name | text | e.g. "Discovery Follow-Up" |
| description | text (nullable) | Optional note |
| sort_order | int | For ordering in dropdowns |
| is_active | boolean | Show/hide in dropdown |
| created_at | timestamptz | |
| updated_at | timestamptz | |

RLS: reps can only see/manage their own sequences.

### Modify existing `rep_task_templates`
Add a nullable column:
- `sequence_id uuid REFERENCES rep_task_sequences(id) ON DELETE CASCADE`

Existing templates (if any) will have `sequence_id = NULL` and can be migrated or cleaned up. Going forward, every template belongs to a sequence.

### Remove `rep_task_template_settings` dependency
The old "auto-create for every call" toggle becomes unnecessary since reps now explicitly choose a sequence per call. The toggle and settings table can remain for backward compatibility but will no longer drive behavior -- the dropdown selection on the form is the new mechanism.

## Frontend Changes

### 1. Redesign TaskTemplatesSection (Settings page)
Replace the current flat list with a **sequence-based** layout:

- **Top level**: List of sequences (e.g. "Discovery Follow-Up", "Demo Follow-Up")
- Each sequence expands to show its tasks (the existing template rows)
- "Add Sequence" button creates a new named sequence
- Within each sequence, "Add Task" adds a template to that sequence
- Drag-and-drop reordering works within each sequence
- Sequences themselves can be reordered
- Remove the "Auto-create for every call" toggle (replaced by per-call selection)

### 2. Add Sequence Selector to Submit Call Form
On the RepDashboard submit call form, add a dropdown **above the submit button** (in the call details section or as its own small section):

- Label: "Auto-Task Sequence" (optional field)
- Dropdown shows all active sequences by name, plus a "None" option
- When a sequence is selected, its tasks are auto-created upon submission
- The selection can be saved in the local draft alongside other form fields

### 3. Update `applyTaskTemplates` logic
Instead of checking a global toggle and applying all active templates:
- Accept an optional `sequenceId` parameter
- If provided, fetch only templates belonging to that sequence
- Create follow-up tasks from those templates
- If no sequence selected, skip auto-task creation

### 4. New API layer (`src/api/taskSequences.ts`)
- `fetchTaskSequences(repId)` -- list all sequences with their template counts
- `createTaskSequence(repId, params)` -- create a new sequence
- `updateTaskSequence(id, params)` -- rename, toggle active
- `deleteTaskSequence(id)` -- cascade deletes templates within it
- `reorderTaskSequences(updates)` -- reorder sequences

### 5. New hooks (`src/hooks/useTaskSequences.ts`)
React Query hooks mirroring the API: `useTaskSequences`, `useCreateTaskSequence`, `useUpdateTaskSequence`, `useDeleteTaskSequence`, `useReorderTaskSequences`.

### 6. Update `createCallTranscriptAndAnalyze`
Pass the selected `sequenceId` through to `applyTaskTemplates` so only the chosen sequence's tasks are created.

## Technical Details

### Migration SQL
```sql
CREATE TABLE public.rep_task_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.rep_task_templates
  ADD COLUMN sequence_id uuid REFERENCES public.rep_task_sequences(id) ON DELETE CASCADE;

-- RLS
ALTER TABLE public.rep_task_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sequences"
  ON public.rep_task_sequences FOR ALL
  USING (rep_id = auth.uid())
  WITH CHECK (rep_id = auth.uid());

-- Updated timestamp trigger
CREATE TRIGGER update_rep_task_sequences_updated_at
  BEFORE UPDATE ON public.rep_task_sequences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### File changes summary
| File | Change |
|------|--------|
| **New**: `src/api/taskSequences.ts` | CRUD for sequences |
| **New**: `src/hooks/useTaskSequences.ts` | React Query hooks |
| **Edit**: `src/api/taskTemplates.ts` | Update `applyTaskTemplates` to accept `sequenceId`, fetch templates by sequence |
| **Edit**: `src/components/tasks/TaskTemplatesSection.tsx` | Redesign to sequence-based UI |
| **New**: `src/components/tasks/TaskSequenceCard.tsx` | Expandable card showing a sequence and its tasks |
| **New**: `src/components/tasks/AddTaskSequenceDialog.tsx` | Dialog to create/edit a sequence name |
| **Edit**: `src/pages/rep/RepDashboard.tsx` | Add sequence selector dropdown near submit button |
| **Edit**: `src/api/aiCallAnalysis/transcripts.ts` | Pass `sequenceId` to `applyTaskTemplates` |
| **Edit**: `src/api/aiCallAnalysis/types.ts` | Add `taskSequenceId` to `CreateCallTranscriptParams` |
