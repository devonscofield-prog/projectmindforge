import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

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
    console.error('Failed to log user activity:', error);
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
    console.error('Failed to fetch user activity logs:', error);
    return [];
  }

  return (data || []) as unknown as UserActivityLog[];
}
