import { supabase } from '@/integrations/supabase/client';

export interface InAppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
  related_entity_id: string | null;
}

export interface NotificationLogEntry {
  id: string;
  user_id: string;
  channel: string;
  notification_type: string;
  title: string;
  summary: string | null;
  task_count: number;
  sent_at: string;
}

export async function fetchNotifications(limit = 50): Promise<InAppNotification[]> {
  const { data, error } = await supabase
    .from('in_app_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as unknown as InAppNotification[];
}

export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('in_app_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false);

  if (error) throw error;
  return count || 0;
}

export async function markAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('in_app_notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) throw error;
}

export async function markAllAsRead(): Promise<void> {
  const { error } = await supabase
    .from('in_app_notifications')
    .update({ is_read: true })
    .eq('is_read', false);

  if (error) throw error;
}

export async function fetchNotificationLog(limit = 50): Promise<NotificationLogEntry[]> {
  const { data, error } = await supabase
    .from('notification_log')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as unknown as NotificationLogEntry[];
}
