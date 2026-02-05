

# Application-Wide Audit: Findings and Fix Plan

## Summary

After a thorough review of the codebase, database schema, RLS policies, security scan results, runtime errors, and recently-added features, I identified **13 issues** across 4 categories: security, bugs, data integrity, and UX gaps.

---

## Critical Issues

### 1. Product Knowledge Tables Exposed to All Authenticated Users (SECURITY)
**Impact**: Any logged-in user (including trainees and reps) can read all 152 rows of proprietary training materials and 698 rows of AI-processed knowledge chunks. Competitors who gain access to any account could steal this intellectual property.

**Root cause**: RLS policies use `qual: true` for SELECT -- meaning any authenticated user can read everything.

**Fix**: Replace the overly-permissive SELECT policies with role-restricted ones. Only admins should have full access; reps/managers should access via edge functions that use the service role key.

```text
DROP POLICY "Authenticated users can view product knowledge" ON product_knowledge;
CREATE POLICY "Admins and managers can view product knowledge" ON product_knowledge
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

DROP POLICY "Authenticated users can view product knowledge chunks" ON product_knowledge_chunks;
CREATE POLICY "Admins and managers can view product knowledge chunks" ON product_knowledge_chunks
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
```

### 2. Runtime Error: "useAuth must be used within an AuthProvider" (BUG)
**Impact**: Application crashes on initial load when ProtectedRoute renders before AuthProvider is ready.

**Root cause**: In `App.tsx`, the `<Suspense>` boundary wraps routes inside `<AuthProvider>`, but if a lazy-loaded route component fails to load, the error boundary may re-render outside the AuthProvider context. The error trace shows ProtectedRoute calling useAuth and failing.

**Fix**: This is a transient race condition that appears during hot-reload or when the Suspense boundary catches. Add a safety check in `useAuth` to return a safe default instead of throwing when context is undefined, or wrap the error message with a redirect to `/auth`.

---

## High Priority Issues

### 3. Auto-Create Default is `true` Before User Opts In (UX/DATA)
**Impact**: The `getAutoCreateSetting` function returns `true` when no settings row exists (line 146 of taskTemplates.ts). This means if a rep creates even one template, it will auto-fire on EVERY call submission even if they never explicitly turned it on.

**Fix**: Change default from `true` to `false` so auto-creation is opt-in:
```typescript
// taskTemplates.ts line 146
return data?.auto_create_enabled ?? false;
```
Also update the Switch default in TaskTemplatesSection.tsx (line 38):
```typescript
checked={autoCreateEnabled ?? false}
```

### 4. No Input Length Validation on Task Templates (SECURITY)
**Impact**: Users can submit arbitrarily long titles and descriptions to `rep_task_templates` and `account_follow_ups`, potentially storing megabytes of data per row.

**Fix**: Add client-side validation with max lengths (title: 200 chars, description: 1000 chars) in `AddTaskTemplateDialog`, `EditTaskDialog`, and `StandaloneTaskDialog`. Also add database-level CHECK constraints.

### 5. No Pagination on Task Lists (PERFORMANCE)
**Impact**: `listManualPendingFollowUpsForRep` and `listAllFollowUpsForRepByStatus` fetch ALL tasks for a rep without any limit. A rep with hundreds of tasks will experience slow load times and hit the Supabase 1000-row default limit silently.

**Fix**: Add `.limit(100)` to queries and implement "Load More" or pagination in the RepTasks page. Also add `.limit(50)` to completed/dismissed tabs since historical data grows indefinitely.

### 6. Extension in Public Schema (SECURITY)
**Impact**: Database extensions installed in the `public` schema can be exploited by authenticated users.

**Fix**: Move the extension to a dedicated schema per Supabase best practices.

---

## Medium Priority Issues

### 7. Duplicate Code: Priority/Category Config (MAINTAINABILITY)
**Impact**: `priorityConfig` and `categoryLabels` are duplicated across `RepTasks.tsx`, `TaskTemplateRow.tsx`, and `PendingFollowUpsWidget.tsx`.

**Fix**: Extract into a shared `src/lib/taskConstants.ts` file and import everywhere.

### 8. No Edit Capability for Task Templates (UX GAP)
**Impact**: `TaskTemplateRow` only supports toggling active/inactive and deleting. There is no way to edit a template's title, priority, category, or due date offset after creation. Users must delete and recreate.

**Fix**: Add an edit button to `TaskTemplateRow` that opens a pre-populated dialog (reuse `AddTaskTemplateDialog` with edit mode).

### 9. Missing Delete Confirmation on Task Templates (UX)
**Impact**: Clicking the trash icon on a template row immediately deletes it with no confirmation. Accidental deletes are easy.

**Fix**: Add an `AlertDialog` confirmation before deletion, matching the pattern used for task dismissal in RepTasks.

### 10. StandaloneTaskDialog Doesn't Reset on Close via Overlay Click (BUG)
**Impact**: If a user partially fills the form, clicks outside to close, then reopens -- the stale data persists because `handleClose` resets form but `onOpenChange` from Dialog doesn't call it when closed via overlay.

**Fix**: The dialog passes `handleClose` to `onOpenChange` which should work, but the `useEffect` for `dueDate` (line 79-83) has a missing dependency and can cause unexpected state. Fix the dependency array and ensure form resets on dialog open.

### 11. Task Templates Not Visible to Managers/Admins (VISIBILITY GAP)
**Impact**: Managers and admins cannot see what auto-task templates their reps have configured. This limits coaching visibility.

**Fix**: This is a future enhancement -- add a read-only view of rep templates to the manager coaching detail page. For now, document as a known limitation.

---

## Low Priority / Informational

### 12. `listAllFollowUpsForRepByStatus` Makes Two Queries (PERFORMANCE)
**Impact**: The function first fetches follow-ups, then makes a separate query for prospect names. This could be a single query with a join or a `.select('*, prospects(prospect_name, account_name)')` syntax.

**Fix**: Use Supabase's foreign key join syntax to combine into one query.

### 13. Data Access Logs Missing Retention Policy (INFO)
**Impact**: The `data_access_logs` table will grow indefinitely without cleanup.

**Fix**: Add a pg_cron job to delete logs older than 1 year, or implement archival.

---

## Implementation Sequence

1. Fix #3 (auto-create default) -- 1 line change, high impact
2. Fix #2 (runtime error) -- defensive check in useAuth
3. Fix #1 (product knowledge RLS) -- database migration
4. Fix #4 (input validation) -- add max lengths to 3 dialog components
5. Fix #5 (pagination) -- add limits to queries
6. Fix #9 (delete confirmation) -- add AlertDialog to TaskTemplatesSection
7. Fix #8 (template editing) -- add edit mode to template dialog
8. Fix #7 (deduplicate constants) -- extract shared config
9. Fix #10 (form reset bug) -- fix useEffect dependency
10. Fix #6 (extension in public) -- database migration
11. Fix #12 (query optimization) -- use join syntax
12. Fix #13 (log retention) -- pg_cron job

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/api/taskTemplates.ts` | Fix default auto-create to `false` |
| `src/components/tasks/TaskTemplatesSection.tsx` | Fix default switch value, add delete confirmation, add edit button |
| `src/components/tasks/AddTaskTemplateDialog.tsx` | Add edit mode, input length limits |
| `src/components/tasks/EditTaskDialog.tsx` | Add input length limits |
| `src/components/tasks/StandaloneTaskDialog.tsx` | Add input length limits, fix form reset |
| `src/components/tasks/TaskTemplateRow.tsx` | Add edit button |
| `src/pages/rep/RepTasks.tsx` | Extract shared constants |
| `src/api/accountFollowUps.ts` | Add pagination limits, optimize joins |
| `src/lib/taskConstants.ts` | New shared constants file |
| Database migration | Fix product_knowledge RLS, extension schema |

