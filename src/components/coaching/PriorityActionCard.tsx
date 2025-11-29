import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Priority {
  area: string;
  reason: string;
  actionItem: string;
}

interface PriorityActionCardProps {
  priorities: Priority[];
}

export function PriorityActionCard({ priorities }: PriorityActionCardProps) {
  const priorityColors = [
    'border-l-red-500 bg-red-500/5',
    'border-l-amber-500 bg-amber-500/5',
    'border-l-blue-500 bg-blue-500/5',
  ];

  const numberColors = [
    'bg-red-500',
    'bg-amber-500',
    'bg-blue-500',
  ];

  if (priorities.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Top Priorities This Period
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {priorities.slice(0, 3).map((priority, idx) => (
          <div
            key={idx}
            className={cn(
              'p-4 rounded-lg border-l-4 border',
              priorityColors[idx] || priorityColors[2]
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0',
                numberColors[idx] || numberColors[2]
              )}>
                {idx + 1}
              </div>
              <div className="space-y-2 flex-1">
                <h4 className="font-semibold text-sm uppercase tracking-wide">
                  {priority.area}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {priority.reason}
                </p>
                <div className="flex items-start gap-2 p-2.5 rounded-md bg-background/80 border text-sm">
                  <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span className="font-medium">{priority.actionItem}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
