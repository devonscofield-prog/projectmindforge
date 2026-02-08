
# Fix: Coach History Sessions Not Loading

## Root Cause

The `fetchAdminCoachSessions` API query tries to join `profiles` using a foreign key hint: `profiles!sales_coach_sessions_user_id_fkey(name, email)`. However, the `sales_coach_sessions` table has **no foreign key constraint** linking `user_id` to `profiles`. The only FK that exists is `sales_coach_sessions_prospect_id_fkey` (to `prospects`).

This causes the PostgREST query to fail entirely, and the error handler returns `{ sessions: [], total: 0 }` -- resulting in the empty "No conversations found" state.

The same missing FK issue also affects `fetchUsersWithCoachSessions` (the user filter dropdown) and `fetchCoachSessionStats`.

## Fix

### Step 1: Add the missing foreign key constraint

Create a database migration to add a foreign key from `sales_coach_sessions.user_id` to `profiles.id`.

```sql
ALTER TABLE public.sales_coach_sessions
  ADD CONSTRAINT sales_coach_sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id);
```

This makes the PostgREST join work as the code already expects.

### Step 2: Verify no orphaned data

Before adding the FK, confirm all `user_id` values in `sales_coach_sessions` have matching `profiles` entries. If any don't, those rows need cleanup first.

### Files modified

- **New migration SQL** -- adds the foreign key constraint
- No code changes needed -- the existing API code (`src/api/adminSalesCoachSessions.ts`) already references the correct constraint name
