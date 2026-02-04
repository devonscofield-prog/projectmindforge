

# Fix Invite Flow to Prompt Password Creation

## Problem

Currently, when a new user clicks their invite link:
1. They get logged in immediately (via magic link)
2. They go straight to MFA enrollment
3. **They never get to set their own password** - the account has a random UUID as the password

This happens because the invite function generates a `magiclink` instead of an `invite` or `recovery` link.

---

## Solution

Change the link type from `magiclink` to `invite`. Supabase's invite link type is specifically designed for new user onboarding and will prompt the user to set a password when they click it.

---

## Implementation

### File: `supabase/functions/invite-user/index.ts`

**1. Change link type from `magiclink` to `invite`**

```typescript
// Before (line 179-185):
const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
  type: 'magiclink',
  email,
  options: {
    redirectTo: redirectTo || undefined
  }
});

// After:
const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
  type: 'invite',
  email,
  options: {
    redirectTo: redirectTo || `https://projectmindforge.lovable.app/auth`
  }
});
```

**2. Update the email copy to match the new flow**

The "What's next?" section should reflect that users will set their password first, then set up MFA:

```html
<div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
  <p style="margin: 0; font-size: 14px; color: #666;">
    <strong>What's next?</strong><br>
    1. Click the link to create your password<br>
    2. Set up two-factor authentication (2FA) for security<br>
    Have an authenticator app ready (like Google Authenticator or Authy).
  </p>
</div>
```

---

## Technical Details

**Why `type: 'invite'` works:**
- Supabase's invite link type is designed for admin-created users
- When clicked, it triggers a password recovery flow that lets users set their password
- After setting the password, they're logged in and will proceed to MFA enrollment
- The existing Auth.tsx already handles the `PASSWORD_RECOVERY` event properly

**Flow after fix:**
1. Admin invites user → user created with random password
2. User receives email with invite link
3. User clicks link → **prompted to set password**
4. User sets password → logged in
5. MFA enrollment screen appears
6. User sets up 2FA → done!

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/invite-user/index.ts` | Change `type: 'magiclink'` to `type: 'invite'`, update email copy to reflect password creation step |

---

## Result

1. **Complete onboarding flow** - Users set their own password before MFA
2. **Secure accounts** - No random UUID passwords left on accounts
3. **Clear instructions** - Email explains the 2-step process (password → MFA)
4. **Works with existing code** - Auth.tsx already handles password recovery events

