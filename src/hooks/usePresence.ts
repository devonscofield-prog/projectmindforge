import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PresencePayload {
  user_id: string;
  online_at: string;
}

// NOTE: usePresenceTracker was removed — AuthContext handles presence tracking
// for admin/manager roles directly. This file only exports useOnlineUsers.

export function useOnlineUsers(): Set<string> {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const presenceChannel = supabase.channel('online-users');

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState<PresencePayload>();
        const userIds = new Set<string>();
        
        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            if (presence.user_id) {
              userIds.add(presence.user_id);
            }
          });
        });
        
        setOnlineUsers(userIds);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        setOnlineUsers((prev) => {
          const updated = new Set(prev);
          newPresences.forEach((presence) => {
            const userId = (presence as Record<string, unknown>).user_id;
            if (typeof userId === 'string') {
              updated.add(userId);
            }
          });
          return updated;
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        setOnlineUsers((prev) => {
          const updated = new Set(prev);
          leftPresences.forEach((presence) => {
            const userId = (presence as Record<string, unknown>).user_id;
            if (typeof userId === 'string') {
              updated.delete(userId);
            }
          });
          return updated;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, []);

  return onlineUsers;
}
