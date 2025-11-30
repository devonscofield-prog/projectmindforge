import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LogIn, LogOut, RefreshCw, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fetchAllRecentActivityLogs, UserActivityLogWithProfile, UserActivityType } from '@/api/userActivityLogs';

const activityIcons: Record<UserActivityType, typeof LogIn> = {
  login: LogIn,
  logout: LogOut,
  session_refresh: RefreshCw,
};

const activityColors: Record<UserActivityType, string> = {
  login: 'text-green-500',
  logout: 'text-red-500',
  session_refresh: 'text-blue-500',
};

const activityLabels: Record<UserActivityType, string> = {
  login: 'logged in',
  logout: 'logged out',
  session_refresh: 'session refreshed',
};

export function GlobalActivityFeed() {
  const [logs, setLogs] = useState<UserActivityLogWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      const data = await fetchAllRecentActivityLogs(15);
      setLogs(data);
      setLoading(false);
    };
    loadLogs();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Recent Activity
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
