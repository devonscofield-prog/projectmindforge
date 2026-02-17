import { supabase } from '@/integrations/supabase/client';

export interface EmailDeliveryUser {
  userId: string;
  name: string;
  email: string;
  emailEnabled: boolean | null;
  reminderTime: string | null;
  timezone: string | null;
  hasPreferences: boolean;
  pendingTaskCount: number;
  totalEmailsSent: number;
  lastSentAt: string | null;
  status: 'active' | 'pending' | 'configured' | 'disabled' | 'no_tasks';
}

function computeStatus(
  hasPrefs: boolean,
  emailEnabled: boolean | null,
  totalSent: number,
  pendingTasks: number
): EmailDeliveryUser['status'] {
  if (hasPrefs && emailEnabled === false) return 'disabled';
  if (hasPrefs && emailEnabled && totalSent > 0) return 'active';
  if (hasPrefs && pendingTasks === 0) return 'configured';
  if (!hasPrefs && pendingTasks > 0) return 'pending';
  return 'no_tasks';
}

export async function fetchEmailDeliveryStatus(): Promise<EmailDeliveryUser[]> {
  // 1. Get all active profiles
  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('id, name, email')
    .eq('is_active', true);

  if (profilesErr) throw profilesErr;
  if (!profiles?.length) return [];

  const userIds = profiles.map(p => p.id);

  // 2-4. Fetch prefs, logs, and tasks in parallel
  const [prefsResult, logsResult, tasksResult] = await Promise.all([
    supabase
      .from('notification_preferences')
      .select('user_id, email_enabled, reminder_time, timezone')
      .in('user_id', userIds),
    supabase
      .from('notification_log')
      .select('user_id, sent_at')
      .eq('notification_type', 'task_reminder')
      .in('user_id', userIds),
    supabase
      .from('account_follow_ups')
      .select('rep_id, id')
      .in('rep_id', userIds)
      .is('completed_at', null)
      .eq('reminder_enabled', true),
  ]);

  if (prefsResult.error) throw prefsResult.error;
  if (logsResult.error) throw logsResult.error;
  if (tasksResult.error) throw tasksResult.error;

  // Build lookup maps
  const prefsMap = new Map(
    (prefsResult.data || []).map(p => [p.user_id, p])
  );

  const logsByUser = new Map<string, { count: number; lastSent: string | null }>();
  for (const log of logsResult.data || []) {
    const existing = logsByUser.get(log.user_id);
    if (!existing) {
      logsByUser.set(log.user_id, { count: 1, lastSent: log.sent_at });
    } else {
      existing.count++;
      if (!existing.lastSent || log.sent_at > existing.lastSent) {
        existing.lastSent = log.sent_at;
      }
    }
  }

  const taskCountMap = new Map<string, number>();
  for (const task of tasksResult.data || []) {
    taskCountMap.set(task.rep_id, (taskCountMap.get(task.rep_id) || 0) + 1);
  }

  // Assemble results
  return profiles.map(profile => {
    const prefs = prefsMap.get(profile.id);
    const logs = logsByUser.get(profile.id);
    const pendingTasks = taskCountMap.get(profile.id) || 0;
    const totalSent = logs?.count || 0;
    const hasPrefs = !!prefs;

    return {
      userId: profile.id,
      name: profile.name,
      email: profile.email,
      emailEnabled: prefs?.email_enabled ?? null,
      reminderTime: prefs?.reminder_time ?? null,
      timezone: prefs?.timezone ?? null,
      hasPreferences: hasPrefs,
      pendingTaskCount: pendingTasks,
      totalEmailsSent: totalSent,
      lastSentAt: logs?.lastSent ?? null,
      status: computeStatus(hasPrefs, prefs?.email_enabled ?? null, totalSent, pendingTasks),
    };
  });
}
