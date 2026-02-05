import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Users, MessagesSquare, TrendingUp } from 'lucide-react';
import { useCoachSessionStats } from '@/hooks/useAdminCoachSessions';
import { Skeleton } from '@/components/ui/skeleton';

export function CoachSessionStatsCard() {
  const { data: stats, isLoading } = useCoachSessionStats();

  const statItems = [
    {
      label: 'Total Sessions',
      value: stats?.totalSessions ?? 0,
      icon: MessageSquare,
      color: 'text-blue-500',
    },
    {
      label: 'Active Sessions',
      value: stats?.activeSessions ?? 0,
      icon: TrendingUp,
      color: 'text-green-500',
    },
    {
      label: 'Unique Users',
      value: stats?.uniqueUsers ?? 0,
      icon: Users,
      color: 'text-purple-500',
    },
    {
      label: 'Total Messages',
      value: stats?.totalMessages ?? 0,
      icon: MessagesSquare,
      color: 'text-orange-500',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {statItems.map(item => {
        const Icon = item.icon;
        return (
          <Card key={item.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Icon className={`h-4 w-4 ${item.color}`} />
                <span className="text-sm">{item.label}</span>
              </div>
              <p className="text-2xl font-bold">{item.value.toLocaleString()}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
