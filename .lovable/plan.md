

# Notifications System Audit Report

## Executive Summary

I've completed a comprehensive audit of the new self-assigned follow-up tasks and notifications system (Phase 1 & 2). The implementation is **mostly solid** but has **3 critical issues** and **4 moderate issues** that need to be addressed before publishing.

---

## Critical Issues (Must Fix)

### 1. Missing Edge Function Configuration in `config.toml`

**Severity:** CRITICAL - Function will fail to deploy/run

The `send-task-reminders` edge function is created but **not registered** in `supabase/config.toml`. This means:
- The function may not deploy correctly
- JWT verification settings are not configured

**Fix Required:**
Add to `supabase/config.toml`:
```toml
[functions.send-task-reminders]
verify_jwt = false
```

Setting `verify_jwt = false` is correct here because this function is called by a cron job (no user JWT available).

---

### 2. Email Sender Domain Not Verified with Resend

**Severity:** CRITICAL - Emails will fail to send

The edge function uses:
```typescript
from: "MindForge <noreply@projectmindforge.lovable.app>"
```

However, Resend requires domain verification. Looking at existing working email functions like `send-performance-alert`, they use:
```typescript
from: "Performance Monitor <onboarding@resend.dev>"
```

The `projectmindforge.lovable.app` domain is unlikely to be verified with Resend.

**Fix Required:**
Either:
1. Verify `projectmindforge.lovable.app` domain in Resend dashboard, OR
2. Use Resend's test sender: `from: "MindForge <onboarding@resend.dev>"`

---

### 3. No Cron Job Scheduled

**Severity:** CRITICAL - Reminders will never be sent

The migration file creates the notification_preferences table, but **no cron job** was set up to call the `send-task-reminders` function hourly.

**Fix Required:**
Run this SQL via the insert tool (not migrations, since it contains project-specific data):
```sql
SELECT cron.schedule(
  'send-task-reminders-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wuquclmippzuejqbcksl.supabase.co/functions/v1/send-task-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cXVjbG1pcHB6dWVqcWJja3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMzUxMjUsImV4cCI6MjA3OTgxMTEyNX0.Aq-zlkfS6wpzpgpjO2zYPS5GMK_5iGRTbIyw_qRIQOI"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

---

## Moderate Issues (Should Fix)

### 4. Edge Function Missing Extended CORS Headers

**Severity:** MODERATE - May cause issues if called from browser

The current CORS headers:
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

Should include all standard headers:
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

This is less critical since the function is called by cron, not browser.

---

### 5. Nullable Type Mismatch in API Layer

**Severity:** MODERATE - Could cause TypeScript errors

In `src/api/accountFollowUps.ts`, the interface defines:
```typescript
source: FollowUpSource;  // Non-nullable
reminder_enabled: boolean;  // Non-nullable
```

But in `src/integrations/supabase/types.ts` (generated from DB):
```typescript
source: string | null
reminder_enabled: boolean | null
```

The database column defaults handle this, but TypeScript type casting could fail if the values are null.

**Fix:** The API interface should use optional/nullable types:
```typescript
source: FollowUpSource | null;
reminder_enabled: boolean | null;
```

Or add explicit null checks when consuming the data.

---

### 6. Missing RLS Policy for Edge Function Updates

**Severity:** MODERATE - Edge function uses service role, but worth noting

The `send-task-reminders` function updates `reminder_sent_at` using the service role key:
```typescript
const supabase = createClient(supabaseUrl, supabaseServiceKey);
```

This bypasses RLS (intentionally), but there's no explicit INSERT policy on `notification_preferences` for edge functions. The existing policies are:
- Users can view/insert/update/delete their own preferences

This is fine since the edge function only reads preferences and updates `account_follow_ups.reminder_sent_at`.

---

### 7. Potential Rate Limit on Resend API

**Severity:** LOW - Edge case

If many users have the same reminder time, the function could hit Resend's rate limits. The current implementation sends emails sequentially without rate limiting.

**Suggestion:** Add a small delay between emails:
```typescript
await new Promise(resolve => setTimeout(resolve, 100));
```

---

## Minor Issues / Improvements

### 8. Timezone Validation in Frontend

The `COMMON_TIMEZONES` list is hardcoded. If a user somehow has a timezone not in this list (from previous data), the Select component may show empty.

### 9. Missing Error Toast in NotificationPreferences

When the mutation fails, only a generic "Failed to save preferences" is shown. Consider including the error message.

### 10. Dashboard Link in Email

The email hardcodes `https://projectmindforge.lovable.app` which works for production but could be parameterized for different environments.

---

## Security Assessment

| Area | Status | Notes |
|------|--------|-------|
| RLS on notification_preferences | ✅ Good | Users can only access their own |
| RLS on account_follow_ups | ✅ Good | Existing policies apply |
| Edge function auth | ✅ Good | Uses service role for cron |
| Email injection | ✅ Good | Email comes from verified profile |
| XSS in email content | ✅ Good | Task titles are plain text in template |

---

## Database Schema Assessment

| Table | Status | Notes |
|-------|--------|-------|
| notification_preferences | ✅ Good | Proper constraints, RLS, indexes |
| account_follow_ups extensions | ✅ Good | New columns with defaults, index for reminders |

---

## Files Reviewed

| File | Status |
|------|--------|
| `supabase/functions/send-task-reminders/index.ts` | Needs CORS fix |
| `supabase/config.toml` | **Missing function config** |
| `src/api/notificationPreferences.ts` | ✅ Good |
| `src/api/accountFollowUps.ts` | Type mismatch (minor) |
| `src/components/settings/NotificationPreferences.tsx` | ✅ Good |
| `src/components/calls/PostCallTasksDialog.tsx` | ✅ Good |
| `src/pages/rep/RepDashboard.tsx` | ✅ Good |
| `src/components/dashboard/PendingFollowUpsWidget.tsx` | ✅ Good |
| `src/components/prospects/FollowUpItem.tsx` | ✅ Good |
| Migration for account_follow_ups | ✅ Good |
| Migration for notification_preferences | ✅ Good |

---

## Recommended Fix Order

1. **Add function to config.toml** (Critical)
2. **Fix email sender domain** (Critical)
3. **Schedule cron job** (Critical)
4. **Extend CORS headers** (Moderate)
5. **Fix nullable types** (Moderate)

---

## Deployment Checklist

Before publishing:
- [x] Add `send-task-reminders` to `config.toml`
- [x] Fix email sender to use verified domain or `onboarding@resend.dev`
- [x] Run cron.schedule SQL to set up hourly job
- [x] Deploy edge function
- [ ] Test notification preferences UI in settings
- [ ] Test post-call task dialog
- [ ] Verify email delivery (manual trigger of edge function)

