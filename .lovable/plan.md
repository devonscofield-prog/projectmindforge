
# Filter Pending Follow-Ups Widget to Manual Tasks Only

## Overview

The "Pending Follow-Ups" widget on the Rep Dashboard currently shows all pending follow-ups (both AI-generated and manually-created). You want it to only display tasks that the rep intentionally scheduled themselves.

---

## Current Behavior

The widget calls `listAllPendingFollowUpsForRep(repId)` which fetches all follow-ups where:
- `rep_id = repId`
- `status = 'pending'`

This includes:
- **AI-generated suggestions** (`source = 'ai'`) that were accepted from the AI Advisor
- **Manual tasks** (`source = 'manual'`) that the rep created via "Add Custom Task"

---

## Proposed Change

Add a `source` filter to the API function and update the widget to only fetch manual tasks.

### Option A: Create New Function (Recommended)

Create a dedicated function `listManualPendingFollowUpsForRep` that only returns manual tasks. This keeps the existing function available for other use cases.

### Option B: Add Parameter to Existing Function

Add an optional `sourceFilter` parameter to `listAllPendingFollowUpsForRep`. Less intrusive but slightly more complex.

**Recommendation**: Option A is cleaner and more explicit.

---

## Implementation

### File: `src/api/accountFollowUps.ts`

Add a new function:

```typescript
/**
 * List pending follow-ups that the rep manually created (not AI-generated)
 */
export async function listManualPendingFollowUpsForRep(repId: string): Promise<AccountFollowUpWithProspect[]> {
  const { data: followUps, error } = await supabase
    .from('account_follow_ups')
    .select('*')
    .eq('rep_id', repId)
    .eq('status', 'pending')
    .eq('source', 'manual')  // Only manual tasks
    .order('created_at', { ascending: false });

  // ... rest of logic (same as listAllPendingFollowUpsForRep)
}
```

### File: `src/components/dashboard/PendingFollowUpsWidget.tsx`

1. Import the new function instead of `listAllPendingFollowUpsForRep`
2. Update the query key to reflect the filter (e.g., `['manual-follow-ups', repId]`)
3. Update the widget title/description to clarify these are "scheduled tasks"
4. Remove the "Personal" badge since all tasks are now personal by definition

---

## UI Copy Updates

| Current | Proposed |
|---------|----------|
| "Pending Follow-Ups" | "My Scheduled Tasks" |
| "{n} actions across your accounts" | "{n} task(s) you've scheduled" |
| "All caught up! No pending follow-ups." | "No scheduled tasks. Create one from any call analysis." |

---

## Files to Modify

| File | Change |
|------|--------|
| `src/api/accountFollowUps.ts` | Add `listManualPendingFollowUpsForRep` function |
| `src/components/dashboard/PendingFollowUpsWidget.tsx` | Use new function, update copy, remove "Personal" badge |

---

## Result

When the rep views the dashboard:
- They only see tasks they've intentionally created
- Each task represents a personal commitment/reminder
- AI-generated follow-ups remain visible on the Account Detail page (ProspectFollowUps section)
- Cleaner, more focused task list that serves as their personal accountability tool
