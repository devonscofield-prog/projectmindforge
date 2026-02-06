import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { CheckCheck, AlertTriangle, CalendarClock, CalendarCheck2, Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
} from '@/hooks/useInAppNotifications';
import type { InAppNotification } from '@/api/inAppNotifications';

const typeIcons: Record<string, React.ElementType> = {
  task_overdue: AlertTriangle,
  task_due_today: CalendarClock,
  task_due_tomorrow: CalendarCheck2,
  system: Info,
};

function NotificationItem({
  notification,
  onRead,
}: {
  notification: InAppNotification;
  onRead: (id: string, link: string | null) => void;
}) {
  const Icon = typeIcons[notification.type] || Info;
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });

  return (
    <button
      onClick={() => onRead(notification.id, notification.link)}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50',
        !notification.is_read && 'bg-primary/5'
      )}
    >
      <div className="mt-0.5 shrink-0">
        <Icon
          className={cn(
            'h-4 w-4',
            notification.type === 'task_overdue' && 'text-destructive',
            notification.type === 'task_due_today' && 'text-warning',
            notification.type === 'task_due_tomorrow' && 'text-primary',
            notification.type === 'system' && 'text-muted-foreground'
          )}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn('text-sm truncate', !notification.is_read && 'font-semibold')}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
          )}
        </div>
        {notification.message && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{notification.message}</p>
        )}
        <p className="text-[11px] text-muted-foreground/70 mt-1">{timeAgo}</p>
      </div>
    </button>
  );
}

export function NotificationCenter() {
  const navigate = useNavigate();
  const { data: notifications, isLoading } = useNotifications();
  const markRead = useMarkAsRead();
  const markAllRead = useMarkAllAsRead();

  const hasUnread = notifications?.some((n) => !n.is_read);

  const handleRead = (id: string, link: string | null) => {
    markRead.mutate(id);
    if (link) navigate(link);
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Notifications</h3>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      <ScrollArea className="max-h-[400px]">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !notifications?.length ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Info className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onRead={handleRead} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
