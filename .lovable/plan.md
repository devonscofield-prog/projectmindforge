
# Add SDR and SDR Manager Roles to User Invitation

## Problem
The invite flow (both the Edge Function and the frontend form) only supports three roles: `rep`, `manager`, and `admin`. The `sdr` and `sdr_manager` roles already exist in the database type system but are missing from the invite workflow.

## Changes Required

### 1. Edge Function: `supabase/functions/invite-user/index.ts`
- Update the role validation on line 92 from `['rep', 'manager', 'admin']` to `['rep', 'manager', 'admin', 'sdr', 'sdr_manager']`
- Update the error message on line 94 accordingly
- Add `sdr` and `sdr_manager` to the `roleDisplayName` map used in the invitation email (e.g., "SDR" and "SDR Manager")
- Update the `InviteRequest` interface `role` type to include `'sdr' | 'sdr_manager'`

### 2. Frontend: `src/pages/admin/AdminInviteUsers.tsx`
- Update the `formData.role` type from `'rep' | 'manager' | 'admin'` to `'rep' | 'manager' | 'admin' | 'sdr' | 'sdr_manager'`
- Add two new `SelectItem` entries in the role dropdown:
  - `sdr` -> "SDR"
  - `sdr_manager` -> "SDR Manager"
- Add role description text for the new roles:
  - SDR: "Can submit dialer transcripts, view call grades and coaching"
  - SDR Manager: "Can view SDR team performance, manage coaching prompts"
- Update the `onValueChange` type cast to include the new roles

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/invite-user/index.ts` | Add `sdr` and `sdr_manager` to validation, type, and email display name |
| `src/pages/admin/AdminInviteUsers.tsx` | Add SDR roles to the dropdown and type definitions |

No database changes needed -- the `sdr` and `sdr_manager` roles already exist in the system.
