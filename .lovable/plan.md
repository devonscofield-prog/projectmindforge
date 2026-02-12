
# Fix Invite Email for SDR / SDR Manager Roles

## Problem
When a new user is invited, the edge function first calls `createUser` (which registers the email), then calls `generateLink` with `type: 'invite'`. The invite type fails with "A user with this email address has already been registered" because the user was just created moments earlier. This means no invite link is generated and no email is sent.

## Fix
In `supabase/functions/invite-user/index.ts` (line 180), change the `generateLink` call from `type: 'invite'` to `type: 'recovery'`. The recovery link type works for already-registered users and still allows the recipient to set their password when they click it.

This is a one-line change:

```
// Before
type: 'invite',

// After
type: 'recovery',
```

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/invite-user/index.ts` | Change `generateLink` type from `'invite'` to `'recovery'` on line 180 |

No other changes needed. The recovery link lands on the same auth page and lets the user set their password.
