
# Self-Assigned Follow-Up Tasks with Notifications

## Overview

This plan adds the ability for sales reps to create personal accountability tasks immediately after submitting a call, with optional email reminders. These complement the existing AI-generated follow-ups by giving reps direct control over their commitments.

## Key User Experience

After submitting a call, reps see a new step in the success flow:

```text
┌─────────────────────────────────────────────────┐
│ ✅ Call submitted successfully!                 │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📝 Add Follow-Up Reminders (optional)       │ │
│ │                                             │ │
│ │ What do you need to do next?                │ │
│ │ ┌─────────────────────────────────────────┐ │ │
│ │ │ Send proposal by Friday              [x] │ │ │
│ │ │ Due: [Feb 7, 2026 ▼]  ⏰ Email reminder │ │ │
│ │ └─────────────────────────────────────────┘ │ │
│ │                                             │ │
│ │ [+ Add another task]                        │ │
│ │                                             │ │
│ │ [Skip]            [Save & View Call]        │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Implementation Approach

### Option A: Extend Existing Follow-Ups (Recommended)
Enhance the existing `account_follow_ups` table with manual task capabilities:
- Add `source` field: `'ai'` or `'manual'`
- Add `due_date` for time-sensitive tasks
- Add `reminder_enabled` flag
- Add `reminder_sent_at` timestamp

**Pros:** 
- Single unified view of all follow-ups
- Existing UI components work with minimal changes
- Dashboard widget shows both AI and manual tasks

### Option B: Separate Tasks Table
Create a new `rep_tasks` table specifically for self-assigned work.

**Cons:**
- Duplicates functionality
- Two places to track follow-ups
- More UI complexity

---

## Database Changes

### Extend `account_follow_ups` Table

```sql
ALTER TABLE account_follow_ups 
  ADD COLUMN source TEXT DEFAULT 'ai' CHECK (source IN ('ai', 'manual')),
  ADD COLUMN due_date DATE,
  ADD COLUMN reminder_enabled BOOLEAN DEFAULT false,
  ADD COLUMN reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN source_call_id UUID REFERENCES call_transcripts(id);

-- Index for reminder scheduling
CREATE INDEX idx_follow_ups_due_reminders 
  ON account_follow_ups(due_date, reminder_enabled) 
  WHERE status = 'pending' AND reminder_enabled = true AND reminder_sent_at IS NULL;
```

### New Table: `notification_preferences`

Store user preferences for notification delivery:

```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Notification channels
  email_enabled BOOLEAN DEFAULT true,
  
  -- Timing preferences  
  reminder_time TIME DEFAULT '09:00',  -- When to send daily reminders
  timezone TEXT DEFAULT 'America/New_York',
  
  -- What to notify about
  notify_due_today BOOLEAN DEFAULT true,
  notify_due_tomorrow BOOLEAN DEFAULT true,
  notify_overdue BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_user_prefs UNIQUE(user_id)
);

-- RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
  ON notification_preferences FOR ALL
  USING (auth.uid() = user_id);
```

---

## Backend Functions

### 1. `send-task-reminders` Edge Function

Scheduled to run daily, sends email reminders for due tasks:

```text
Trigger: Scheduled (daily at each user's preferred time)
Logic:
├── Query users with notification_preferences.email_enabled = true
├── For each user, find follow-ups where:
│   ├── due_date = today OR due_date < today (overdue)
│   ├── reminder_enabled = true
│   ├── reminder_sent_at IS NULL (not already sent today)
│   └── status = 'pending'
├── Group by user and send single digest email
└── Update reminder_sent_at to prevent duplicate sends
```

Email template example:
```text
Subject: 📋 MindForge: 3 follow-ups due today

Hi Sarah,

You have 3 follow-up tasks due today:

🔴 HIGH: Send proposal to Acme Corp
   Account: Acme Corporation
   Due: Today
   
🟡 MED: Schedule demo with Beta Inc CFO
   Account: Beta Inc
   Due: Today

🔵 LOW: Send case study link
   Account: Gamma LLC
   Due: Yesterday (overdue)

[View All Tasks →]

---
Manage notification preferences in Settings
```

### 2. Enhance Existing Call Submission Flow

After successful call creation, the frontend presents the task creation dialog.

---

## Frontend Changes

### 1. Post-Submission Task Dialog

New component: `src/components/calls/PostCallTasksDialog.tsx`

```text
Props:
├── callId: string
├── prospectId: string
├── accountName: string
├── onClose: () => void
└── onComplete: () => void

Features:
├── Add up to 5 tasks
├── Each task has: title, due date, reminder toggle
├── Quick-add suggestions based on call type
└── Skip option to proceed without tasks
```

### 2. Settings: Notification Preferences

Add to `src/pages/UserSettings.tsx`:

```text
┌─────────────────────────────────────────────────┐
│ 🔔 Notification Preferences                    │
├─────────────────────────────────────────────────┤
│                                                 │
│ Email Reminders                                 │
│ ○ Enabled  ● Disabled                          │
│                                                 │
│ Remind me about:                                │
│ ☑ Tasks due today                              │
│ ☑ Tasks due tomorrow                           │
│ ☑ Overdue tasks                                │
│                                                 │
│ Preferred reminder time: [9:00 AM ▼]            │
│ Timezone: [America/New_York ▼]                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 3. Dashboard Widget Enhancement

Update `PendingFollowUpsWidget` to:
- Show due dates when present
- Highlight overdue tasks
- Differentiate AI vs manual tasks (subtle visual cue)

### 4. Prospect Detail Enhancement

Update `ProspectFollowUps` component to:
- Allow adding manual tasks inline
- Show due dates
- Sort by due date when present

---

## API Layer

### New Functions in `src/api/accountFollowUps.ts`

```typescript
// Create a manual follow-up task
export async function createManualFollowUp(params: {
  prospectId: string;
  title: string;
  description?: string;
  priority?: FollowUpPriority;
  dueDate?: string;
  reminderEnabled?: boolean;
  sourceCallId?: string;
}): Promise<AccountFollowUp>

// Update due date and reminder settings
export async function updateFollowUpReminder(
  followUpId: string, 
  dueDate: string | null,
  reminderEnabled: boolean
): Promise<AccountFollowUp>

// Get user's notification preferences
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences | null>

// Update notification preferences
export async function updateNotificationPreferences(
  userId: string,
  prefs: Partial<NotificationPreferences>
): Promise<NotificationPreferences>
```

---

## Technical Details

### Email Delivery

Uses the existing Resend integration (`RESEND_API_KEY` is already configured):
- Leverages patterns from `send-performance-alert` function
- Professional HTML email template matching existing MindForge branding

### Scheduling

Two approaches for the daily reminder job:

**Option 1: Supabase pg_cron (Simpler)**
```sql
SELECT cron.schedule(
  'send-task-reminders',
  '0 * * * *',  -- Run every hour, function checks user timezones
  $$SELECT net.http_post(
    'https://[project].supabase.co/functions/v1/send-task-reminders',
    headers := '{"Authorization": "Bearer [service_key]"}'
  )$$
);
```

**Option 2: External Scheduler**
Use an external service to trigger the edge function at specific times per timezone.

### Performance Considerations

- Indexed query for finding due reminders
- Batch email sends (one digest per user, not per task)
- `reminder_sent_at` prevents duplicate sends

---

## Implementation Phases

### Phase 1: Core Task Creation (Week 1)
- [ ] Database migration: extend `account_follow_ups` table
- [ ] API functions for creating manual follow-ups
- [ ] Post-call task dialog component
- [ ] Integration with RepDashboard submission flow

### Phase 2: Notification Infrastructure (Week 2)
- [ ] Create `notification_preferences` table
- [ ] Build `send-task-reminders` edge function
- [ ] Add notification settings to UserSettings page
- [ ] Schedule daily reminder job

### Phase 3: UI Enhancements (Week 3)
- [ ] Update PendingFollowUpsWidget with due dates
- [ ] Update ProspectFollowUps with inline task creation
- [ ] Add overdue indicators and sorting
- [ ] Mobile-responsive task entry

### Phase 4: Polish (Week 4)
- [ ] Email template refinement
- [ ] Quick-add suggestions based on call type
- [ ] Keyboard shortcuts for rapid task entry
- [ ] Analytics: track task completion rates

---

## Files to Create/Modify

### New Files
- `src/components/calls/PostCallTasksDialog.tsx` - Task creation after call submission
- `src/components/settings/NotificationPreferences.tsx` - Settings section
- `src/api/notificationPreferences.ts` - Preferences API
- `supabase/functions/send-task-reminders/index.ts` - Email reminder function

### Modified Files
- `src/api/accountFollowUps.ts` - Add manual task creation functions
- `src/pages/rep/RepDashboard.tsx` - Show post-call dialog after submission
- `src/pages/UserSettings.tsx` - Add notification preferences section
- `src/components/dashboard/PendingFollowUpsWidget.tsx` - Show due dates
- `src/components/prospects/detail/ProspectFollowUps.tsx` - Inline task creation
- `src/hooks/prospect/useProspectFollowUps.ts` - Add manual task mutations

---

## Security Considerations

- RLS policies ensure users only see/edit their own tasks and preferences
- Email reminders only sent to verified user emails from profiles table
- Rate limiting on task creation (max 20 tasks per prospect)
- Timezone validation to prevent injection

---

## Future Enhancements

- Push notifications (browser/mobile)
- Slack integration for reminders
- Manager visibility into team task completion
- Recurring tasks for regular check-ins
- Calendar sync (ties into planned MS Graph integration)
