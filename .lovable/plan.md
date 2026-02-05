

# Rep Task Management Page

## Overview
Create a dedicated task management page at `/rep/tasks` where reps can view, create, edit, complete, and manage all their manually-created follow-up tasks in one place. This extends the existing dashboard widget into a full-featured task management experience.

---

## What Reps Will Be Able to Do

- **View all tasks** organized by status tabs: Pending, Completed, Dismissed
- **Filter and sort** tasks by priority, category, due date, or account
- **Create new tasks** (standalone, not requiring a call link) with an adapted version of the existing Add Task dialog
- **Edit existing tasks** inline -- change title, description, priority, category, due date, and reminder settings
- **Complete / Dismiss / Restore** tasks with the same swipe and button interactions already used on the dashboard widget
- **See overdue tasks** highlighted prominently at the top
- **Navigate to the linked account** by clicking the account name on any task
- **Access the page** from a new "My Tasks" link in the left sidebar under "My Work"

---

## Navigation Changes

**Sidebar (AppLayout.tsx)** -- Add to `repNavGroups` under "My Work":
```
{ href: '/rep/tasks', label: 'My Tasks', icon: Target }
```

**Mobile Bottom Nav (MobileBottomNav.tsx)** -- Replace "History" with "Tasks" for reps (since tasks are higher-frequency):
```
{ href: '/rep/tasks', label: 'Tasks', icon: Target }
```

---

## Technical Details

### New Files

| File | Purpose |
|------|---------|
| `src/pages/rep/RepTasks.tsx` | Full task management page with tabs, filters, create/edit dialogs |
| `src/components/tasks/EditTaskDialog.tsx` | Dialog for editing an existing task's fields |
| `src/components/tasks/StandaloneTaskDialog.tsx` | Adapted create dialog that doesn't require a call ID (uses account picker instead) |

### API Layer Changes (`src/api/accountFollowUps.ts`)

Add two new functions:
- `updateFollowUp(id, fields)` -- General-purpose update for title, description, priority, category, due_date, reminder_enabled, reminder_time
- `listAllFollowUpsForRepByStatus(repId, status)` -- Fetch tasks filtered by status (for completed/dismissed tabs), with prospect details joined

### Mutation Hook (`src/hooks/useFollowUpMutations.ts`)

Add `useUpdateFollowUp()` hook with optimistic updates and cache invalidation for task edits.

### Router (`src/App.tsx`)

Add route:
```
<Route path="/rep/tasks" element={
  <ProtectedRoute allowedRoles={['rep']}>
    <RepTasks />
  </ProtectedRoute>
} />
```

### Page Structure (`RepTasks.tsx`)

- Wrapped in `AppLayout` for consistent navigation
- **Header**: Page title + "New Task" button
- **Stats bar**: Quick counts (overdue, due today, total pending)
- **Tabs**: Pending | Completed | Dismissed
- **Filter bar** (Pending tab): Priority dropdown, Category dropdown, Sort by (due date / priority / created date)
- **Task list**: Reuses the existing `FollowUpRow` pattern from `PendingFollowUpsWidget` with additions:
  - Edit button (pencil icon) opens `EditTaskDialog`
  - Account name is a clickable link
  - Overdue tasks get a red left border accent
- **Empty states**: Contextual messages per tab
- Mobile: swipe-to-complete and swipe-to-dismiss (reuses `SwipeableCard`)

### Edit Task Dialog (`EditTaskDialog.tsx`)

- Pre-populated form matching the create dialog layout (title, description, priority, category, due date, reminder)
- Uses the new `updateFollowUp` API function
- Invalidates relevant query caches on save

### Standalone Task Dialog (`StandaloneTaskDialog.tsx`)

- Adapted from `AddCustomTaskDialog` but replaces the `callId` + `prospectId` props with an account search/select dropdown
- Queries the rep's prospects list for the picker
- `sourceCallId` is optional/null for standalone tasks

### Dashboard Widget Link

Add a "View All" link in the `PendingFollowUpsWidget` header that navigates to `/rep/tasks`.

### Implementation Sequence

1. Add `updateFollowUp` and `listAllFollowUpsForRepByStatus` to API layer
2. Add `useUpdateFollowUp` mutation hook
3. Create `EditTaskDialog` component
4. Create `StandaloneTaskDialog` component  
5. Create `RepTasks` page
6. Add route in `App.tsx`
7. Add sidebar nav item and mobile nav update
8. Add "View All" link to dashboard widget

