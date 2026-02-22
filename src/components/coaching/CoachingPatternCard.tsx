import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LucideIcon } from 'lucide-react';

interface PatternItem {
  item: string;
  count: number;
}

interface CoachingPatternCardProps {
  title: string;
  icon: LucideIcon;
  items: PatternItem[];
  variant?: 'default' | 'destructive' | 'success';
  emptyMessage?: string;
}

export const CoachingPatternCard = memo(function CoachingPatternCard({
  title,
  icon: Icon,
  items,
  variant = 'default',
  emptyMessage = 'No patterns found',
}: CoachingPatternCardProps) {
  const borderColorClass = {
    default: 'border-primary/20',
    destructive: 'border-destructive/20',
    success: 'border-green-500/20',
  }[variant];

  const bgColorClass = {
    default: 'bg-primary/5',
    destructive: 'bg-destructive/5',
    success: 'bg-green-500/5',
  }[variant];

  const iconColorClass = {
    default: 'text-primary',
    destructive: 'text-destructive',
    success: 'text-green-500',
  }[variant];

  const badgeVariant = {
    default: 'secondary' as const,
    destructive: 'destructive' as const,
    success: 'default' as const,
  }[variant];

  return (
    <Card className={`border ${borderColorClass} ${bgColorClass}`}>
      <CardHeader className="pb-3">
        <CardTitle className={`flex items-center gap-2 text-base ${iconColorClass}`}>
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="space-y-2">
            {items.slice(0, 5).map((item, i) => (
              <li key={i} className="flex items-start justify-between gap-2">
                <span className="text-sm flex-1 line-clamp-2 capitalize">
                  {item.item}
                </span>
                <Badge variant={badgeVariant} className="text-xs shrink-0">
                  {item.count}x
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
});
