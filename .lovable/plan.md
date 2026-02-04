

# Enhance Custom Task Creation: More Visible, Time Selection, Default Reminder

## Overview

This plan will make the "Add Custom Task" option more prominent, add time-of-day selection for reminders, and default the email reminder to ON.

---

## Changes Summary

### 1. Make "Add Custom Task" More Prominent

**Current State**: The button is at the bottom of the suggestions list, styled as `variant="outline"` with a simple icon.

**New Design**:
- Move the button to the card header area, next to "Accept All" and "Dismiss All"
- Also keep a secondary "Add your own" link at the bottom for discoverability
- Use a more eye-catching style (dashed border card or highlighted button)

### 2. Add Reminder Time Selection

**Current State**: Users can only pick a date. The reminder time comes from their global notification preferences.

**New Design**:
- Add a time dropdown (using the existing `REMINDER_TIMES` from `notificationPreferences.ts`)
- When a due date is selected, show a time picker below it
- If no time is selected, default to the user's global preference (or 9:00 AM)
- Store the selected time in a new `reminder_time` column on `account_follow_ups`

### 3. Default Email Reminder to ON

**Current State**: `reminderEnabled` defaults to `false`

**New State**: `reminderEnabled` defaults to `true` when a due date is selected

---

## Technical Implementation

### Database Migration

Add a `reminder_time` column to `account_follow_ups`:

```sql
ALTER TABLE public.account_follow_ups 
ADD COLUMN reminder_time time without time zone DEFAULT '09:00'::time;

COMMENT ON COLUMN public.account_follow_ups.reminder_time IS 
  'Per-task reminder time override. Falls back to user notification_preferences if null.';
```

### API Changes

**File**: `src/api/accountFollowUps.ts`

- Add `reminderTime?: string` to `CreateManualFollowUpParams`
- Update `createManualFollowUp` to accept and save `reminder_time`
- Update `AccountFollowUp` interface to include `reminder_time: string | null`

### UI Changes

**File**: `src/components/calls/suggestions/AddCustomTaskDialog.tsx`

1. Add state for `reminderTime` (default: '09:00')
2. Change `reminderEnabled` default from `false` to `true`
3. Add time selector dropdown after the date picker (only shows when date is selected)
4. Move the "Send email reminder" checkbox higher and make it checked by default
5. Pass `reminderTime` to `createManualFollowUp`

**File**: `src/components/calls/suggestions/PostCallSuggestionsPanel.tsx`

1. Add a prominent "Add Custom Task" button in the card header (next to Accept All)
2. Style it with a primary variant or dashed border to make it stand out
3. Keep a subtle "or add your own" text at the bottom as a secondary entry point

### Backend Update (if needed)

**File**: `supabase/functions/send-task-reminders/index.ts`

- When sending reminders, check if the task has a custom `reminder_time`
- If so, use that instead of the user's global `notification_preferences.reminder_time`

---

## UI Mockup

### Card Header (After)

```
[Sparkles icon] Suggested Follow-Up Actions
                                    [+ Add Task] [Dismiss All] [Accept All]
```

### Add Custom Task Dialog (After)

```
Add Custom Follow-Up Task
Create a manual task for Acme Corp

Task Title *
[Schedule follow-up demo with IT team          ]

Description (optional)
[Add any additional context...                 ]

Priority                    Category
[Medium  v]                 [Discovery  v]

Due Date & Reminder Time
[Jan 15, 2026        v]     [9:00 AM  v]

[x] Send email reminder at this time
    (You'll receive an email at 9:00 AM on Jan 15)

                        [Cancel]  [Create Task]
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/calls/suggestions/PostCallSuggestionsPanel.tsx` | Add prominent "Add Task" button to header |
| `src/components/calls/suggestions/AddCustomTaskDialog.tsx` | Add time picker, default reminder to ON, reorganize layout |
| `src/api/accountFollowUps.ts` | Add `reminderTime` parameter and update types |
| Database migration | Add `reminder_time` column to `account_follow_ups` |

---

## Edge Cases

1. **No date selected**: Time picker hidden, reminder checkbox disabled
2. **Date selected but no time**: Use default 9:00 AM
3. **Existing tasks without reminder_time**: Backend falls back to user's global preference
4. **User hasn't configured notification preferences**: Still works with defaults (9:00 AM ET)

