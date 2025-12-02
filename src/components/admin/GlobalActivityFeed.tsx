import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LogIn, LogOut, RefreshCw, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { createLogger } from '@/lib/logger';
import { fetchAllRecentActivityLogs, UserActivityLogWithProfile, UserActivityType } from '@/api/userActivityLogs';
import { supabase } from '@/integrations/supabase/client';

const log = createLogger('GlobalActivityFeed');

const activityIcons: Record<UserActivityType, typeof LogIn> = {
  login: LogIn,
  logout: LogOut,
  session_refresh: RefreshCw,
  user_invited: Activity,
  user_profile_updated: Activity,
  user_role_changed: Activity,
  password_reset_requested: Activity,
  user_deactivated: Activity,
  user_reactivated: Activity,
};

const activityColors: Record<UserActivityType, string> = {
  login: 'text-green-500',
  logout: 'text-red-500',
  session_refresh: 'text-blue-500',
  user_invited: 'text-purple-500',
  user_profile_updated: 'text-blue-500',
  user_role_changed: 'text-orange-500',
  password_reset_requested: 'text-yellow-500',
  user_deactivated: 'text-red-500',
  user_reactivated: 'text-green-500',
};

const activityLabels: Record<UserActivityType, string> = {
  login: 'logged in',
  logout: 'logged out',
  session_refresh: 'session refreshed',
  user_invited: 'invited user',
  user_profile_updated: 'updated profile',
  user_role_changed: 'changed role',
  password_reset_requested: 'reset password',
  user_deactivated: 'deactivated user',
  user_reactivated: 'reactivated user',
};

export function GlobalActivityFeed() {
  const [logs, setLogs] = useState<UserActivityLogWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadLogs = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchAllRecentActivityLogs(15);
      setLogs(data);
    } catch (err) {
      log.error('Error loading activity logs', { error: err });
      setError(err instanceof Error ? err : new Error('Failed to load activity'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('user-activity-feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_activity_logs',
        },
        () => {
          // Refresh the logs when a new activity is inserted
          loadLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadLogs]);

  // Re-throw error for error boundary to catch
  if (error) {
    throw error;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Recent Activity
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No activity recorded yet</p>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {logs.map((log) => {
                const Icon = activityIcons[log.activity_type];
                const colorClass = activityColors[log.activity_type];
                const label = activityLabels[log.activity_type];

                return (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
                  >
                    <div className={`p-1.5 rounded-full bg-muted ${colorClass}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{log.user_name}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
