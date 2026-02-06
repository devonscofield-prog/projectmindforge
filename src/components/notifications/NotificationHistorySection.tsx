import { format } from 'date-fns';
import { Mail, Bell, Loader2, History } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNotificationLog } from '@/hooks/useInAppNotifications';

export function NotificationHistorySection() {
  const { data: logs, isLoading } = useNotificationLog(50);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Notification History
        </CardTitle>
        <CardDescription>Past email and in-app notifications sent to you</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !logs?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">No notification history yet</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
              >
                <div className="shrink-0">
                  {log.channel === 'email' ? (
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Bell className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{log.title}</p>
                  {log.summary && (
                    <p className="text-xs text-muted-foreground truncate">{log.summary}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {log.task_count > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {log.task_count} task{log.task_count !== 1 ? 's' : ''}
                    </Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.sent_at), 'MMM d, h:mm a')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
