

# In-App Notifications, Notification History, and Cron Fix

## Overview

Three deliverables:
1. **In-app notification system** with bell icon badge, notification center dropdown, and toast alerts for new notifications
2. **Notification history log** so users can review past sent notifications
3. **Fix trigger-pending-analyses 404** by redeploying the edge function

---

## 1. Fix trigger-pending-analyses (Quick Fix)

The edge function code exists at `supabase/functions/trigger-pending-analyses/index.ts` and is configured in `supabase/config.toml`, but it is not currently deployed. The pg_cron job (job 3) calls it every minute and gets a 404.

**Action:** Deploy the edge function. No code changes needed -- the function just needs to be deployed to resolve the 404s that fire every minute.

---

## 2. Database: notifications table + notification_log table

### New table: `in_app_notifications`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| user_id | uuid | references auth.users, NOT NULL |
| type | text | 'task_due_today', 'task_overdue', 'task_due_tomorrow', 'system' |
| title | text | NOT NULL |
| message | text | nullable |
| link | text | nullable, in-app route to navigate to |
| is_read | boolean | default false |
| created_at | timestamptz | default now() |
| related_entity_id | uuid | nullable, e.g. follow-up ID |

RLS: Users can only SELECT/UPDATE their own notifications.

### New table: `notification_log`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| user_id | uuid | NOT NULL |
| channel | text | 'email' or 'in_app' |
| notification_type | text | 'task_due_today', 'task_overdue', etc. |
| title | text | NOT NULL |
| summary | text | nullable, e.g. "3 tasks due today" |
| task_count | integer | default 0 |
| sent_at | timestamptz | default now() |

RLS: Users can only SELECT their own logs.

---

## 3. Update send-task-reminders Edge Function

Modify `supabase/functions/send-task-reminders/index.ts` to:

1. **Write in-app notifications** -- For each task in a user's reminder batch, insert a row into `in_app_notifications` with type, title, message (task title + account name), and link (`/rep/tasks`).
2. **Write notification log entries** -- After sending email and/or creating in-app notifications, insert a summary row into `notification_log` recording channel, type, task count, and timestamp.
3. Both happen alongside the existing email send logic (not replacing it).

---

## 4. Frontend: Notification Bell + Center

### New files

| File | Purpose |
|------|---------|
| `src/api/inAppNotifications.ts` | CRUD: fetch unread count, fetch all, mark as read, mark all read |
| `src/hooks/useInAppNotifications.ts` | React Query hooks + realtime subscription for live badge updates |
| `src/components/notifications/NotificationBell.tsx` | Bell icon with unread count badge |
| `src/components/notifications/NotificationCenter.tsx` | Popover dropdown listing recent notifications with mark-as-read |
| `src/components/notifications/NotificationHistorySection.tsx` | Full log view for Settings page |

### NotificationBell

- Bell icon from lucide-react
- Red badge with unread count (hidden when 0)
- Clicking opens NotificationCenter popover
- On new notification arrival via realtime subscription, show a sonner toast with the notification title

### NotificationCenter (Popover)

- Header: "Notifications" + "Mark all read" button
- Scrollable list of recent notifications (last 50)
- Each item shows: type icon, title, message, relative time ("2h ago")
- Unread items have a subtle highlight/dot indicator
- Clicking an item marks it read and navigates to its `link` if present
- Empty state: "No notifications yet"

### Integration points

**`src/components/layout/AppLayout.tsx`** -- Add `NotificationBell` to the `DesktopSidebarToggle` bar (right side, next to the collapse button).

**`src/components/layout/MobileHeader.tsx`** -- Add `NotificationBell` between the primary action button and ThemeToggle.

**`src/hooks/useInAppNotifications.ts`** -- Subscribe to `postgres_changes` on `in_app_notifications` table for the current user. On INSERT event, show a sonner toast and invalidate the query cache.

### Notification History (Settings)

**`src/components/notifications/NotificationHistorySection.tsx`** -- A card for the Settings page showing:
- Table/list of past notification log entries from `notification_log`
- Columns: Date/Time, Channel (Email/In-App badge), Type, Summary, Task Count
- Paginated or limited to last 30 days
- Empty state when no history exists

Integrate into the Settings page below the existing NotificationPreferences component.

---

## 5. Realtime Setup

Enable realtime on the `in_app_notifications` table so the frontend subscription works:

```text
ALTER PUBLICATION supabase_realtime ADD TABLE public.in_app_notifications;
```

---

## Modified Files Summary

| File | Changes |
|------|---------|
| `supabase/functions/send-task-reminders/index.ts` | Add in-app notification + log writes |
| `src/components/layout/AppLayout.tsx` | Add NotificationBell to desktop header |
| `src/components/layout/MobileHeader.tsx` | Add NotificationBell to mobile header |
| Settings page | Add NotificationHistorySection |

## New Files

| File | Purpose |
|------|---------|
| `src/api/inAppNotifications.ts` | API layer for notifications CRUD |
| `src/hooks/useInAppNotifications.ts` | Query hooks + realtime subscription |
| `src/components/notifications/NotificationBell.tsx` | Bell icon with badge |
| `src/components/notifications/NotificationCenter.tsx` | Dropdown notification list |
| `src/components/notifications/NotificationHistorySection.tsx` | History log for Settings |

## Implementation Sequence

1. Deploy trigger-pending-analyses edge function (immediate fix)
2. Create `in_app_notifications` and `notification_log` tables with RLS + enable realtime
3. Update `send-task-reminders` to write in-app notifications and log entries
4. Create `src/api/inAppNotifications.ts` and `src/hooks/useInAppNotifications.ts`
5. Build NotificationBell and NotificationCenter components
6. Integrate bell into AppLayout and MobileHeader
7. Build NotificationHistorySection and add to Settings page
8. Deploy updated edge function

