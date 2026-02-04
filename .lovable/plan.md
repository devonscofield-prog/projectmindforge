

# Configure Custom Email Sender for Reminders

## Overview

Update the task reminder system to send emails from `reminders@mindforgenotifications.com` using your new Resend API key.

## Changes Required

### 1. Update RESEND_API_KEY Secret

Replace the existing `RESEND_API_KEY` with your new key:
- **New key:** `re_72EAVG7a_9yRXzqLzuo6o3vKj2NUPyLi2`

### 2. Update Edge Function Sender Address

Modify line 43 in `supabase/functions/send-task-reminders/index.ts`:

```text
Current:  from: "MindForge <onboarding@resend.dev>"
New:      from: "MindForge Reminders <reminders@mindforgenotifications.com>"
```

### 3. Deploy Updated Function

Redeploy the edge function to apply the new sender address.

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/send-task-reminders/index.ts` | Update `from` field to `reminders@mindforgenotifications.com` |

## Secrets to Update

| Secret | Action |
|--------|--------|
| `RESEND_API_KEY` | Update to new key |

---

## Verification Steps

After implementation:
1. Manually trigger the edge function to test email delivery
2. Confirm emails arrive from `reminders@mindforgenotifications.com`

