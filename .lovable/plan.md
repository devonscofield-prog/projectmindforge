

# Improve User Invitation System with Resend

## Overview

Update the invite-user edge function to use the same verified Resend domain that the reminder system uses (`mindforgenotifications.com`), update branding to "MindForge", and ensure users can seamlessly accept invitations and set up their accounts.

---

## Current State

The existing `invite-user` function already:
- Creates users with admin service role
- Generates a magic link for password setup
- Has Resend integration code

**Issues to fix:**
1. Uses `onboarding@resend.dev` (sandbox domain - limited to your own email)
2. Branding says "Stormwind Studios" instead of "MindForge"
3. Email template doesn't match the polished reminder email style

---

## Implementation

### File: `supabase/functions/invite-user/index.ts`

**1. Update Resend Email Sender**

Change from sandbox domain to verified domain:

```typescript
// Before
from: 'Stormwind Studios <onboarding@resend.dev>',

// After  
from: 'MindForge <invitations@mindforgenotifications.com>',
```

**2. Update Email Branding**

Replace all "Stormwind Studios" references with "MindForge":
- Email subject: `"You've been invited to join MindForge"`
- Email body header: `"Welcome to MindForge!"`
- Email copy: `"You've been invited to join MindForge as a..."`

**3. Improve Email Template Styling**

Match the professional styling from the reminder emails:
- Use consistent gradient colors (`#6366f1` primary purple)
- Match button styling 
- Update the CTA link styling
- Add MindForge branding colors

**4. Update Login URL in Email**

The invite link should point to the production URL for easy access:
- Add a "Login to MindForge" link at the bottom of the email for returning users

---

## Updated Email Template

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to MindForge!</h1>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 18px; margin-top: 0;">Hi <strong>${name}</strong>,</p>
    
    <p>You've been invited to join <strong>MindForge</strong> as a <strong>${roleDisplayName}</strong>.</p>
    
    <p>Click the button below to set up your account and get started:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Accept Invitation
      </a>
    </div>
    
    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #666;">
        <strong>What's next?</strong><br>
        After clicking the link, you'll be logged in and asked to set up two-factor authentication (2FA) for security. Have an authenticator app ready (like Google Authenticator or Authy).
      </p>
    </div>
    
    <p style="color: #666; font-size: 13px; margin-bottom: 0;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${inviteLink}" style="color: #6366f1; word-break: break-all;">${inviteLink}</a>
    </p>
    
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;">
    
    <p style="color: #999; font-size: 12px; margin-bottom: 0;">
      This invitation link will expire in 24 hours. If you didn't expect this invitation, you can safely ignore this email.
    </p>
  </div>
</body>
</html>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/invite-user/index.ts` | Update sender domain to `mindforgenotifications.com`, update branding to "MindForge", improve email template styling to match reminder emails |

---

## User Flow After Changes

1. **Admin invites user** via `/admin/users/invite`
2. **Email sent** from `invitations@mindforgenotifications.com` with MindForge branding
3. **User clicks "Accept Invitation"** in email
4. **Magic link logs them in** and redirects to the app
5. **MFA enrollment triggers** (existing behavior) for 2FA setup
6. **User is ready to go** with their assigned role and team

---

## Technical Notes

- The verified domain `mindforgenotifications.com` is already configured in Resend (used by task reminders)
- Using `invitations@mindforgenotifications.com` as the sender for invite emails keeps email types organized
- No changes needed to the Auth page - the existing magic link handling already works correctly
- The RESEND_API_KEY secret is already configured

