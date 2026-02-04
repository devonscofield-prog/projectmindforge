

# Enhanced Notification Preferences Implementation

## Overview

Add comprehensive flexibility to the notification system with expanded time slots, secondary reminder times, browser timezone detection, and priority-based filtering for digest emails.

---

## Changes Summary

### 1. Database Schema Update

Add new columns to `notification_preferences` table:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `secondary_reminder_time` | `time` | `NULL` | Optional second daily reminder |
| `exclude_weekends` | `boolean` | `false` | Skip reminders on Sat/Sun |
| `min_priority` | `text` | `NULL` | Only notify for this priority or higher (NULL = all) |

---

### 2. API Layer Updates

**File: `src/api/notificationPreferences.ts`**

**Expand REMINDER_TIMES** (add 11:00 AM - 4:30 PM):
```typescript
{ value: '10:30', label: '10:30 AM' },
{ value: '11:00', label: '11:00 AM' },
{ value: '11:30', label: '11:30 AM' },
{ value: '12:00', label: '12:00 PM' },
{ value: '12:30', label: '12:30 PM' },
{ value: '13:00', label: '1:00 PM' },
{ value: '13:30', label: '1:30 PM' },
{ value: '14:00', label: '2:00 PM' },
{ value: '14:30', label: '2:30 PM' },
{ value: '15:00', label: '3:00 PM' },
{ value: '15:30', label: '3:30 PM' },
{ value: '16:00', label: '4:00 PM' },
{ value: '16:30', label: '4:30 PM' },
```

**Expand COMMON_TIMEZONES** (add 7 more):
```typescript
{ value: 'America/Toronto', label: 'Toronto (ET)' },
{ value: 'America/Sao_Paulo', label: 'Sao Paulo (BRT)' },
{ value: 'Europe/Berlin', label: 'Berlin (CET)' },
{ value: 'Asia/Dubai', label: 'Dubai (GST)' },
{ value: 'Asia/Mumbai', label: 'India (IST)' },
{ value: 'Africa/Johannesburg', label: 'South Africa (SAST)' },
{ value: 'Pacific/Auckland', label: 'New Zealand (NZST)' },
```

**Add priority options constant:**
```typescript
export const PRIORITY_FILTERS = [
  { value: '', label: 'All priorities' },
  { value: 'low', label: 'Low and above' },
  { value: 'medium', label: 'Medium and above' },
  { value: 'high', label: 'High priority only' },
];
```

**Update interfaces** to include new fields.

---

### 3. UI Component Updates

**File: `src/components/settings/NotificationPreferences.tsx`**

**Add browser timezone detection** on component mount:
```typescript
useEffect(() => {
  if (!prefs && !isLoading) {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (COMMON_TIMEZONES.find(tz => tz.value === detected)) {
      setDetectedTimezone(detected);
    }
  }
}, [prefs, isLoading]);
```

**Add new UI sections:**

1. **Secondary Reminder Time** (optional toggle + time select)
   - Switch to enable/disable
   - Time dropdown (same options as primary)

2. **Exclude Weekends** toggle
   - Simple switch with descriptive label

3. **Priority Filter** dropdown
   - Select minimum priority level for notifications

4. **Timezone detection banner**
   - Show when detected timezone differs from saved
   - "Use detected timezone" button

---

### 4. Edge Function Updates

**File: `supabase/functions/send-task-reminders/index.ts`**

**Add weekend check:**
```typescript
const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

if (pref.exclude_weekends && isWeekend) {
  continue; // Skip this user
}
```

**Add secondary reminder time matching:**
```typescript
// Check if current hour matches primary OR secondary time
const primaryHour = parseInt(pref.reminder_time.split(":")[0], 10);
const secondaryHour = pref.secondary_reminder_time 
  ? parseInt(pref.secondary_reminder_time.split(":")[0], 10)
  : null;

if (userHour === primaryHour || userHour === secondaryHour) {
  usersToNotify.push(pref.user_id);
}
```

**Add priority filtering:**
```typescript
const PRIORITY_ORDER = { high: 3, medium: 2, low: 1 };

// Filter follow-ups by minimum priority
if (userPrefs.min_priority) {
  const minLevel = PRIORITY_ORDER[userPrefs.min_priority] || 0;
  if (PRIORITY_ORDER[followUp.priority] < minLevel) {
    continue; // Skip this follow-up
  }
}
```

**Add direct settings link to email:**
```typescript
<p style="margin-top: 32px; color: #666; font-size: 12px;">
  <a href="https://projectmindforge.lovable.app/settings" style="color: #6366f1;">
    Manage notification preferences
  </a>
</p>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/api/notificationPreferences.ts` | Expand time/timezone arrays, add priority filter constant, update interfaces |
| `src/components/settings/NotificationPreferences.tsx` | Add timezone detection, secondary time, weekend toggle, priority filter UI |
| `supabase/functions/send-task-reminders/index.ts` | Support secondary time, weekend exclusion, priority filtering, settings link |
| Database migration | Add 3 new columns to `notification_preferences` |

---

## New UI Layout

```text
┌─────────────────────────────────────────────────────────────┐
│ 🔔 Notification Preferences                                │
│ Configure how and when you receive follow-up task reminders│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 📧 Email Reminders                              [Toggle ON] │
│ Receive daily digest of due and overdue tasks               │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ 🕐 Primary Reminder Time        [▼ 9:00 AM              ]  │
│                                                             │
│ 🕐 Secondary Reminder Time                      [Toggle OFF]│
│    Get a second daily reminder (optional)                   │
│    [▼ 5:00 PM              ] (shown when enabled)          │
│                                                             │
│ 🌍 Timezone                     [▼ Eastern Time (ET)    ]  │
│    ┌──────────────────────────────────────────────────┐    │
│    │ 💡 Detected: Pacific Time (PT). Use this instead?│    │
│    │                              [Use Detected]       │    │
│    └──────────────────────────────────────────────────┘    │
│                                                             │
│ 📅 Exclude Weekends                             [Toggle OFF]│
│    Don't send reminders on Saturday/Sunday                  │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ Remind me about:                                            │
│ ☑ Overdue tasks                                             │
│ ☑ Tasks due today                                           │
│ ☑ Tasks due tomorrow                                        │
│                                                             │
│ 🎯 Minimum Priority             [▼ All priorities       ]  │
│    Only notify for tasks at or above this priority          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Notes

### Timezone Detection Logic

```typescript
const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
// Only suggest if it's in our supported list
const isSupported = COMMON_TIMEZONES.some(tz => tz.value === detectedTimezone);
```

### Priority Filtering Order

| min_priority | Includes |
|--------------|----------|
| `null` | All (high, medium, low) |
| `low` | All (high, medium, low) |
| `medium` | High and medium only |
| `high` | High only |

### Edge Function Time Matching

The function runs hourly and checks:
1. Is it the user's primary reminder hour? OR
2. Is it the user's secondary reminder hour?
3. If either matches AND not a weekend (if excluded), send email

---

## Migration SQL

```sql
ALTER TABLE notification_preferences
ADD COLUMN secondary_reminder_time TIME DEFAULT NULL,
ADD COLUMN exclude_weekends BOOLEAN DEFAULT FALSE,
ADD COLUMN min_priority TEXT DEFAULT NULL;

COMMENT ON COLUMN notification_preferences.secondary_reminder_time 
  IS 'Optional second daily reminder time';
COMMENT ON COLUMN notification_preferences.exclude_weekends 
  IS 'Skip reminders on Saturday and Sunday';
COMMENT ON COLUMN notification_preferences.min_priority 
  IS 'Minimum priority level to include (null = all, low/medium/high)';
```

