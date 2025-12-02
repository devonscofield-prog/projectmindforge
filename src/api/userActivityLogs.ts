import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { toUserActivityLog } from '@/lib/supabaseAdapters';
import type { Json } from '@/integrations/supabase/types';

const log = createLogger('activityLogs');

export type UserActivityType = 
  | 'login' 
  | 'logout' 
  | 'session_refresh'
  | 'user_invited'
  | 'user_profile_updated'
  | 'user_role_changed'
  | 'password_reset_requested'
  | 'user_deactivated'
  | 'user_reactivated';

interface ActivityLogEntry {
  user_id: string;
  activity_type: UserActivityType;
  ip_address?: string;
  user_agent?: string;
  metadata?: Json;
}

export async function logUserActivity(entry: ActivityLogEntry): Promise<void> {
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

  return (data || []).map(toUserActivityLog);
}

export interface UserActivityLogWithProfile extends UserActivityLog {
  user_name: string;
  user_email: string;
}

export async function fetchAdminAuditLogs(limit = 100): Promise<UserActivityLogWithProfile[]> {
  const adminActionTypes: UserActivityType[] = [
    'user_invited',
    'user_profile_updated', 
    'user_role_changed',
    'password_reset_requested',
    'user_deactivated',
    'user_reactivated'
  ];

  // Fetch admin action logs only
  const { data: logs, error: logsError } = await supabase
    .from('user_activity_logs')
    .select('*')
    .in('activity_type', adminActionTypes)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (logsError) {
    log.error('Failed to fetch all activity logs', { error: logsError });
    return [];
  }

  if (!logs || logs.length === 0) return [];

  // Get unique user IDs
  const userIds = [...new Set(logs.map(logEntry => logEntry.user_id))];

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

  // Map logs with actor (admin) profile info
  return logs.map((logEntry) => {
    const baseLog = toUserActivityLog(logEntry);
    return {
      ...baseLog,
      user_name: profileMap.get(logEntry.user_id)?.name || 'Unknown',
      user_email: profileMap.get(logEntry.user_id)?.email || '',
    };
  });
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
  const userIds = [...new Set(logs.map(logEntry => logEntry.user_id))];

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

  return logs.map((logEntry) => {
    const baseLog = toUserActivityLog(logEntry);
    return {
      ...baseLog,
      user_name: profileMap.get(logEntry.user_id)?.name || 'Unknown',
      user_email: profileMap.get(logEntry.user_id)?.email || '',
    };
  });
}
