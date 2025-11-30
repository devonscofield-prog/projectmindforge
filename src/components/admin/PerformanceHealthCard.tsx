import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, AlertTriangle, XCircle, LucideIcon } from 'lucide-react';

interface PerformanceHealthCardProps {
  title: string;
  value: string | number;
  unit?: string;
  status: 'healthy' | 'warning' | 'critical';
  subtitle?: string;
  icon?: LucideIcon;
}

const statusConfig = {
  healthy: {
    icon: CheckCircle,
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    textColor: 'text-emerald-500',
    label: 'Healthy',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    textColor: 'text-amber-500',
    label: 'Warning',
  },
  critical: {
    icon: XCircle,
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/20',
    textColor: 'text-destructive',
    label: 'Critical',
  },
};

export function PerformanceHealthCard({
  title,
  value,
  unit,
  status,
  subtitle,
  icon: CustomIcon,
}: PerformanceHealthCardProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const IconComponent = CustomIcon || StatusIcon;

  return (
    <Card className={cn('border', config.borderColor, config.bgColor)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-1">
              <span className={cn('text-2xl font-bold', config.textColor)}>
                {value}
              </span>
              {unit && (
                <span className="text-sm text-muted-foreground">{unit}</span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div
            className={cn(
              'rounded-full p-2',
              config.bgColor
            )}
          >
            <IconComponent className={cn('h-5 w-5', config.textColor)} />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <StatusIcon className={cn('h-3.5 w-3.5', config.textColor)} />
          <span className={cn('text-xs font-medium', config.textColor)}>
            {config.label}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
