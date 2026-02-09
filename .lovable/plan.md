

# Remove the Trainee Role

Since no users currently have the `trainee` role assigned, this is a clean removal with no data migration needed.

## Changes

### 1. Database: Update the `user_role` enum
Remove `'trainee'` from the `user_role` enum type. This requires creating a new enum, migrating columns, and dropping the old one (standard Postgres enum removal pattern).

### 2. RLS Policies: Remove trainee-specific policies
The `roleplay_personas` table has a dedicated "Trainees can view active personas" RLS policy that needs to be dropped. The existing "Reps can view active personas" policy already covers rep access.

### 3. Frontend: Remove all trainee references

| File | Change |
|------|--------|
| `src/types/database.ts` | Remove `'trainee'` from `UserRole` type |
| `src/lib/routes.ts` | Remove `case 'trainee'` from `getDashboardUrl()` |
| `src/lib/routePreloader.ts` | Remove `trainee` route entry |
| `src/App.tsx` | Remove `'trainee'` from all `allowedRoles` arrays (training routes already include `'rep'`) |
| `src/components/layout/MobileBottomNav.tsx` | Remove the `role === 'trainee'` nav block (reps will use their existing nav with training accessible from sidebar) |
| `src/components/ProtectedRoute.tsx` | No change needed (generic) |
| `src/pages/Auth.tsx` | Fix the redirect to use `getDashboardUrl(role)` instead of hardcoded ternary (also fixes the existing bug where trainees went to `/rep`) |
| `src/pages/admin/AdminUserEdit.tsx` | Remove the `"trainee"` option from the role selector |
| `src/pages/admin/AdminInviteUsers.tsx` | No change needed (already doesn't offer trainee) |

### 4. Edge Functions: Remove trainee references

| Function | Change |
|----------|--------|
| `invite-user` | Remove `'trainee'` from the role type and role label map |

The `roleplay-session-manager`, `roleplay-grade-session`, `roleplay-abandon-session`, and `cleanup-stuck-sessions` edge functions use `trainee_id` as a **column name** in the `roleplay_sessions` table, not as a role. These do not need to change -- `trainee_id` is just the column that stores the user ID of whoever is doing the roleplay, regardless of their role.

## What stays the same
- The `roleplay_sessions.trainee_id` column name is kept as-is (renaming a column would require updating all queries, RLS policies, and edge functions for no functional benefit)
- All training routes remain accessible to reps (they already are)
- No data migration needed since zero users have the trainee role

