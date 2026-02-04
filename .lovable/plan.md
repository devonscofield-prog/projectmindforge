

# Auto-Create Notification Preferences + Add "Send Test Email" Button

## Problem Summary

Two issues need to be addressed:

1. **Settings Page Crash**: The error `A <Select.Item /> must have a value prop that is not an empty string` is caused by `PRIORITY_FILTERS` having an empty string value (`''`) for the "All priorities" option. Radix UI's Select component doesn't allow empty string values.

2. **Missing Notification Preferences**: New users have no row in `notification_preferences`, so the reminder system skips them entirely. Users shouldn't have to manually create preferences.

3. **No Way to Test Emails**: There's no way to verify email deliverability without waiting for the cron job.

---

## Implementation Plan

### 1. Fix the Select.Item Empty Value Error

**File**: `src/api/notificationPreferences.ts`

Change `PRIORITY_FILTERS` to use a non-empty placeholder value:

```typescript
export const PRIORITY_FILTERS = [
  { value: 'all', label: 'All priorities' },  // Changed from '' to 'all'
  { value: 'low', label: 'Low and above' },
  { value: 'medium', label: 'Medium and above' },
  { value: 'high', label: 'High priority only' },
];
```

**File**: `src/components/settings/NotificationPreferences.tsx`

Update the handling of `min_priority`:
- When displaying: treat `null` as `'all'`
- When saving: convert `'all'` back to `null` for the database

---

### 2. Auto-Create Notification Preferences on First Load

**File**: `src/api/notificationPreferences.ts`

Modify `getNotificationPreferences()` to automatically create a row with sensible defaults if none exists:

```typescript
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;

  // Auto-create with defaults if no preferences exist
  if (!data) {
    const defaults = {
      email_enabled: true,
      reminder_time: '09:00',
      timezone: detectBrowserTimezone() || 'America/New_York',
      notify_due_today: true,
      notify_due_tomorrow: true,
      notify_overdue: true,
      secondary_reminder_time: null,
      exclude_weekends: false,
      min_priority: null,
    };
    return await upsertNotificationPreferences(defaults);
  }

  return data as NotificationPreferences;
}
```

**Benefits**:
- Users automatically have preferences without any action
- Email reminders work out-of-the-box
- Browser timezone is auto-detected on first creation

---

### 3. Add "Send Test Email" Button

**File**: `supabase/functions/send-task-reminders/index.ts`

Add support for a `test` mode that:
- Accepts an optional `userId` in the request body
- Skips time-window and day-of-week checks
- Sends to just that user immediately
- Returns detailed feedback about what was sent

```typescript
// At the start of handler, check for test mode
const body = await req.json().catch(() => ({}));
const isTestMode = body.test === true;
const testUserId = body.userId;

if (isTestMode && testUserId) {
  // Skip time matching - send immediately to this user
  // ... special test handling logic
}
```

**File**: `src/api/notificationPreferences.ts`

Add a new function:

```typescript
export async function sendTestReminderEmail(): Promise<{ success: boolean; message: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('send-task-reminders', {
    body: { test: true, userId: user.id },
  });

  if (error) throw error;
  return data;
}
```

**File**: `src/components/settings/NotificationPreferences.tsx`

Add a "Send Test Email" button to the card footer:

```tsx
<CardContent>
  {/* ...existing content... */}
  
  {emailEnabled && (
    <div className="pt-4 border-t">
      <Button 
        variant="outline" 
        onClick={handleSendTestEmail}
        disabled={testEmailMutation.isPending}
      >
        {testEmailMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Send Test Email
          </>
        )}
      </Button>
      <p className="text-sm text-muted-foreground mt-2">
        Sends a test reminder to your email address
      </p>
    </div>
  )}
</CardContent>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/api/notificationPreferences.ts` | Fix `PRIORITY_FILTERS` empty value, auto-create prefs, add `sendTestReminderEmail()` |
| `src/components/settings/NotificationPreferences.tsx` | Handle 'all' priority value, add test email button |
| `supabase/functions/send-task-reminders/index.ts` | Add test mode support |

---

## Result

1. **Settings page loads without errors** - the empty string Select.Item bug is fixed
2. **Users are automatically enrolled in reminders** - no manual setup required
3. **Test email button** allows verifying the email system works end-to-end

