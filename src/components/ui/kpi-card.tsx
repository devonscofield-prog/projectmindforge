import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressBar } from './progress-bar';
import { StatusBadge, getPerformanceStatus } from './status-badge';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number;
  goal: number;
  icon?: LucideIcon;
  format?: 'number' | 'currency' | 'percentage';
  className?: string;
}

export const KPICard = memo(function KPICard({ title, value, goal, icon: Icon, format = 'number', className }: KPICardProps) {
  const status = getPerformanceStatus(value, goal);
  const percentage = goal > 0 ? Math.round((value / goal) * 100) : 0;

  const formatValue = (val: number) => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
      case 'percentage':
        return `${val}%`;
      default:
        return val.toLocaleString();
    }
  };

  return (
    <Card variant="elevated" className={cn("relative overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-2xl font-bold">{formatValue(value)}</span>
          <span className="text-sm text-muted-foreground">/ {formatValue(goal)}</span>
        </div>
        <ProgressBar value={value} goal={goal} showLabel={false} size="lg" />
        <div className="flex items-center justify-between mt-3">
          <StatusBadge status={status}>
            {status === 'on-track' ? 'On Track' : status === 'at-risk' ? 'At Risk' : 'Off Track'}
          </StatusBadge>
          <span className="text-sm text-muted-foreground">{percentage}% complete</span>
        </div>
      </CardContent>
    </Card>
  );
});
