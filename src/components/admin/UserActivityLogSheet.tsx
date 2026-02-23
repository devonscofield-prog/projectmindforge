import { useQuery } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { fetchUserActivityLogs, type UserActivityLog as _UserActivityLog } from '@/api/userActivityLogs';
import { format, formatDistanceToNow } from 'date-fns';
import { LogIn, LogOut, RefreshCw, Clock, Monitor } from 'lucide-react';

interface UserActivityLogSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export function UserActivityLogSheet({ 
  open, 
  onOpenChange, 
  userId, 
  userName 
}: UserActivityLogSheetProps) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['user-activity-logs', userId],
    queryFn: () => fetchUserActivityLogs(userId),
    enabled: open && !!userId,
    staleTime: 30 * 1000, // 30 seconds
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'login':
        return <LogIn className="h-4 w-4 text-green-500" />;
      case 'logout':
        return <LogOut className="h-4 w-4 text-red-500" />;
      case 'session_refresh':
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityBadgeVariant = (type: string) => {
    switch (type) {
      case 'login':
        return 'default';
      case 'logout':
        return 'destructive';
      case 'session_refresh':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatUserAgent = (ua: string | null) => {
    if (!ua) return 'Unknown device';
    
    // Simple parsing for display
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Browser';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Activity Log</SheetTitle>
          <SheetDescription>
            Login and logout history for {userName}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)] mt-6 pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No activity logs found
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="mt-0.5">
                    {getActivityIcon(log.activity_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getActivityBadgeVariant(log.activity_type)} className="capitalize">
                        {log.activity_type.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(log.created_at), 'MMM d, yyyy · h:mm a')}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                      <Monitor className="h-3 w-3" />
                      {formatUserAgent(log.user_agent)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
