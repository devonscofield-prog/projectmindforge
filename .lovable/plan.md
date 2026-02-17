

# Add Reminder Email Delivery Status Page

## Overview

Create a new admin page at `/admin/email-delivery` that shows per-user reminder email delivery status, including preferences configuration, pending task counts, and latest delivery attempt details.

## What You'll See

A table showing every active user with columns for:
- **User name and email**
- **Email status**: Whether reminders are enabled, configured, or not set up
- **Reminder schedule**: Time and timezone
- **Pending tasks**: Count of reminder-eligible tasks
- **Total emails sent**: Lifetime count
- **Last delivery**: When the most recent reminder was sent (with relative time)
- **Status indicator**: Visual badge showing Active (receiving emails), Configured (set up but no tasks), Not configured (no preferences row), or Disabled

A search/filter bar to quickly find specific users.

## Technical Details

### New Files

1. **`src/pages/admin/AdminEmailDelivery.tsx`**
   - Admin-only page using `AppLayout`, `PageBreadcrumb`, and the existing table/card UI components
   - Uses a single `useQuery` hook calling a new API function
   - Displays a searchable, sortable table of all active users with their delivery status
   - Shows summary stats at the top (total users configured, emails sent today, users with pending tasks)

2. **`src/api/emailDeliveryStatus.ts`**
   - `fetchEmailDeliveryStatus()` function that queries:
     - `profiles` (all active users)
     - `notification_preferences` (left join for email config)
     - `notification_log` (aggregate counts and latest sent_at for task_reminder type)
     - `account_follow_ups` (count of pending reminder-eligible tasks)
   - Returns a typed array with per-user delivery status

### Modified Files

3. **`src/App.tsx`**
   - Add lazy import for `AdminEmailDelivery`
   - Add route `/admin/email-delivery` wrapped in `ProtectedRoute` with `allowedRoles={['admin']}`

4. **`src/lib/breadcrumbConfig.ts`**
   - Add `'emailDelivery'` to the `getAdminPageBreadcrumb` union type
   - Add label `'Email Delivery Status'`

### Data Source

All data is already available in existing tables -- no database changes needed. The page will query:
- `profiles` for user identity
- `notification_preferences` for email config (left join, may be null)
- `notification_log` for delivery history (aggregated)
- `account_follow_ups` for pending task count (aggregated)

### Status Logic

Each user gets a visual status badge:
- **Active** (green): `email_enabled = true` AND has received at least one email
- **Pending** (yellow): Has pending tasks but no preferences configured yet (will be auto-provisioned on next cron run)
- **Configured** (blue): Preferences set up but no pending tasks
- **Disabled** (gray): `email_enabled = false`
- **No Tasks** (neutral): No preferences and no pending tasks

