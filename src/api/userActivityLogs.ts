import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { Json } from '@/integrations/supabase/types';

const log = createLogger('activityLogs');

export type UserActivityType = 'login' | 'logout' | 'session_refresh';

interface ActivityLogEntry {
  user_id: string;
  activity_type: UserActivityType;
  ip_address?: string;
  user_agent?: string;
  metadata?: Json;
}

export async function logUserActivity(entry: ActivityLogEntry) {
  const { error } = await supabase
    .from('user_activity_logs')
    .insert([{
      user_id: entry.user_id,
      activity_type: entry.activity_type,
      ip_address: entry.ip_address || null,
      user_agent: navigator.userAgent,
      metadata: entry.metadata ?? {},
    }]);

  if (error) {
    log.error('Failed to log user activity', { error });
  }
}

export interface UserActivityLog {
  id: string;
  user_id: string;
  activity_type: UserActivityType;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Json;
  created_at: string;
}

export async function fetchUserActivityLogs(userId: string, limit = 50): Promise<UserActivityLog[]> {
  const { data, error } = await supabase
    .from('user_activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    log.error('Failed to fetch user activity logs', { error });
    return [];
  }

  return (data || []) as unknown as UserActivityLog[];
}

export interface UserActivityLogWithProfile extends UserActivityLog {
  user_name: string;
  user_email: string;
}

export async function fetchAllRecentActivityLogs(limit = 20): Promise<UserActivityLogWithProfile[]> {
  // Fetch logs first
  const { data: logs, error: logsError } = await supabase
    .from('user_activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (logsError) {
    log.error('Failed to fetch all activity logs', { error: logsError });
    return [];
  }

  if (!logs || logs.length === 0) return [];

  // Get unique user IDs
  const userIds = [...new Set(logs.map(log => log.user_id))];

  // Fetch profiles for those users
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name, email')
    .in('id', userIds);

  if (profilesError) {
    log.error('Failed to fetch profiles', { error: profilesError });
  }

  // Create a map for quick lookup
  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  return logs.map((log) => ({
    ...log,
    user_name: profileMap.get(log.user_id)?.name || 'Unknown',
    user_email: profileMap.get(log.user_id)?.email || '',
  })) as UserActivityLogWithProfile[];
}
