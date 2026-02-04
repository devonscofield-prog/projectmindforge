import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('notificationPreferences');

export interface NotificationPreferences {
  id: string;
  user_id: string;
  email_enabled: boolean;
  reminder_time: string;
  timezone: string;
  notify_due_today: boolean;
  notify_due_tomorrow: boolean;
  notify_overdue: boolean;
  secondary_reminder_time: string | null;
  exclude_weekends: boolean;
  min_priority: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferencesUpdate {
  email_enabled?: boolean;
  reminder_time?: string;
  timezone?: string;
  notify_due_today?: boolean;
  notify_due_tomorrow?: boolean;
  notify_overdue?: boolean;
  secondary_reminder_time?: string | null;
  exclude_weekends?: boolean;
  min_priority?: string | null;
}

/**
 * Get notification preferences for the current user.
 * Auto-creates with sensible defaults if none exist.
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    log.error('Error fetching notification preferences', { error });
    throw error;
  }

  // Auto-create with defaults if no preferences exist
  if (!data) {
    log.info('No notification preferences found, creating defaults');
    const defaults: NotificationPreferencesUpdate = {
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

/**
 * Create or update notification preferences for the current user
 */
export async function upsertNotificationPreferences(
  prefs: NotificationPreferencesUpdate
): Promise<NotificationPreferences> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert({
      user_id: user.id,
      ...prefs,
    }, {
      onConflict: 'user_id',
    })
    .select()
    .single();

  if (error) {
    log.error('Error upserting notification preferences', { error });
    throw error;
  }

  return data as NotificationPreferences;
}

/**
 * Common timezones for the dropdown - organized by region
 */
export const COMMON_TIMEZONES = [
  // Americas
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HST)' },
  { value: 'America/Toronto', label: 'Toronto (ET)' },
  { value: 'America/Sao_Paulo', label: 'Sao Paulo (BRT)' },
  // Europe
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  // Middle East / Africa
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Africa/Johannesburg', label: 'South Africa (SAST)' },
  // Asia Pacific
  { value: 'Asia/Mumbai', label: 'India (IST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'Pacific/Auckland', label: 'New Zealand (NZST)' },
];

/**
 * Reminder time options (30-min intervals throughout the day)
 */
export const REMINDER_TIMES = [
  { value: '06:00', label: '6:00 AM' },
  { value: '06:30', label: '6:30 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '07:30', label: '7:30 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '08:30', label: '8:30 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '09:30', label: '9:30 AM' },
  { value: '10:00', label: '10:00 AM' },
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
  { value: '17:00', label: '5:00 PM' },
  { value: '17:30', label: '5:30 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '18:30', label: '6:30 PM' },
  { value: '19:00', label: '7:00 PM' },
  { value: '19:30', label: '7:30 PM' },
  { value: '20:00', label: '8:00 PM' },
];

/**
 * Priority filter options for digest emails
 * Note: 'all' maps to null in the database
 */
export const PRIORITY_FILTERS = [
  { value: 'all', label: 'All priorities' },
  { value: 'low', label: 'Low and above' },
  { value: 'medium', label: 'Medium and above' },
  { value: 'high', label: 'High priority only' },
];

/**
 * Send a test reminder email to the current user
 */
export async function sendTestReminderEmail(): Promise<{ success: boolean; message: string; sent?: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('send-task-reminders', {
    body: { test: true, userId: user.id },
  });

  if (error) {
    log.error('Error sending test email', { error });
    throw error;
  }

  return data;
}

/**
 * Detect the user's browser timezone
 */
export function detectBrowserTimezone(): string | null {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Only return if it's in our supported list
    if (COMMON_TIMEZONES.some(tz => tz.value === detected)) {
      return detected;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get the label for a timezone value
 */
export function getTimezoneLabel(value: string): string {
  const tz = COMMON_TIMEZONES.find(t => t.value === value);
  return tz?.label ?? value;
}
