
# Fix: Users Not Receiving Reminder Emails

## Root Cause

The reminder system only sends emails to users who have a row in the `notification_preferences` table. Currently, only **5 out of ~15+ users** have this row. Preference rows are only created when a user manually visits the Notification Settings page — most users never do this.

As a result, 6 users with eligible tasks (due today/tomorrow/overdue with reminders enabled) are completely invisible to the hourly cron job and never receive emails.

## Evidence

- **5 users** have notification_preferences rows (Devon test, Melisa, Devon Scofield, Grant, Danae)
- **6 users** currently have eligible reminder tasks (Sebastian, Christopher, Katelyn, Andrew, Devon test, Devon Farnsworth)
- Only **1 user** (Devon test) overlaps between both groups -- and that user IS receiving emails correctly
- The remaining 5 users with tasks are silently skipped

## Solution

Modify the edge function to auto-provision default preferences for any user who has reminder-eligible tasks but no preferences row. This ensures all users receive emails without needing to visit the settings page first.

## Technical Changes

### 1. Edge Function Update (`supabase/functions/send-task-reminders/index.ts`)

In the `sendRemindersToUsers` function, after fetching follow-ups and identifying unique `rep_id` values:

- Cross-reference user IDs from follow-ups against existing notification_preferences rows
- For any user with eligible tasks but NO preferences row, auto-insert a default row:
  - `email_enabled: true`
  - `reminder_time: '09:00'`
  - `timezone: 'America/Phoenix'` (matching the org's primary timezone)
  - All notification types enabled, no weekend exclusion, no priority filter
- Include these newly created users in the notification loop

Alternatively (simpler approach): move the user-discovery logic to start from **users who have pending reminder-eligible tasks**, then left-join their preferences (using defaults for missing rows), rather than starting from the preferences table.

### 2. Approach Details

The cleaner fix is to restructure the query flow:

```text
Current flow (broken for new users):
  1. Query notification_preferences where email_enabled = true  -->  5 users
  2. Filter by time window  -->  subset
  3. Query follow-ups for those users  -->  misses everyone else

Fixed flow:
  1. Query account_follow_ups that are pending + reminder_enabled + due soon  -->  all eligible tasks
  2. Get unique rep_ids from those tasks
  3. Query notification_preferences for those rep_ids (may return fewer rows)
  4. For users WITHOUT a preferences row, use sensible defaults
  5. Apply time-window filtering using actual or default preferences
  6. Send emails
```

This ensures any user who creates a task with reminders enabled will automatically receive notifications, even if they never configured preferences.

### 3. Auto-Provision Preferences Row

After identifying users missing preferences, insert default rows into `notification_preferences` so they appear in future runs without repeating this logic. This also means users can later customize their settings.

## Files Modified

- `supabase/functions/send-task-reminders/index.ts` -- restructure query flow and add auto-provisioning
