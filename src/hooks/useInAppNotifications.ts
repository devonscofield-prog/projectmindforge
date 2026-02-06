import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAsRead,
  markAllAsRead,
  fetchNotificationLog,
} from '@/api/inAppNotifications';

export function useNotifications(limit = 50) {
  return useQuery({
    queryKey: ['in-app-notifications', limit],
    queryFn: () => fetchNotifications(limit),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['in-app-notifications-unread-count'],
    queryFn: fetchUnreadCount,
    refetchInterval: 60_000, // fallback poll every 60s
  });
}

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['in-app-notifications'] });
      qc.invalidateQueries({ queryKey: ['in-app-notifications-unread-count'] });
    },
  });
}

export function useMarkAllAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['in-app-notifications'] });
      qc.invalidateQueries({ queryKey: ['in-app-notifications-unread-count'] });
    },
  });
}

export function useNotificationLog(limit = 50) {
  return useQuery({
    queryKey: ['notification-log', limit],
    queryFn: () => fetchNotificationLog(limit),
  });
}

/**
 * Subscribe to realtime INSERT events on in_app_notifications.
 * Shows a toast and invalidates caches on new notifications.
 */
export function useNotificationRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('in-app-notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as { title?: string; message?: string };
          toast.info(n.title || 'New notification', {
            description: n.message || undefined,
          });
          qc.invalidateQueries({ queryKey: ['in-app-notifications'] });
          qc.invalidateQueries({ queryKey: ['in-app-notifications-unread-count'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);
}
