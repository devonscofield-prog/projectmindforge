import { Target, TrendingUp, Ear, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CoachOutput } from '@/api/aiCallAnalysis/types';

interface PrioritizedActionsPanelProps {
  coachOutput: CoachOutput;
}

interface ActionItem {
  text: string;
  source: 'meddpicc' | 'gap_selling' | 'active_listening';
  priority: number;
}

const SOURCE_CONFIG = {
  meddpicc: {
    icon: Target,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    label: 'MEDDPICC',
  },
  gap_selling: {
    icon: TrendingUp,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    label: 'Gap Selling',
  },
  active_listening: {
    icon: Ear,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    label: 'Listening',
  },
};

export function PrioritizedActionsPanel({ coachOutput }: PrioritizedActionsPanelProps) {
  // Gather all improvements
  const meddpiccImprovements = coachOutput.meddpicc_improvements || coachOutput.bant_improvements || [];
  const gapSellingImprovements = coachOutput.gap_selling_improvements || [];
  const activeListeningImprovements = coachOutput.active_listening_improvements || [];

  // Create prioritized list (MEDDPICC first as it's the primary framework)
  const allActions: ActionItem[] = [
    ...meddpiccImprovements.map((text, i) => ({ 
      text, 
      source: 'meddpicc' as const, 
      priority: i 
    })),
    ...gapSellingImprovements.map((text, i) => ({ 
      text, 
      source: 'gap_selling' as const, 
      priority: meddpiccImprovements.length + i 
    })),
    ...activeListeningImprovements.map((text, i) => ({ 
      text, 
      source: 'active_listening' as const, 
      priority: meddpiccImprovements.length + gapSellingImprovements.length + i 
    })),
  ];

  if (allActions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          Improvement Actions
          <Badge variant="secondary" className="ml-auto">
            {allActions.length} items
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {allActions.map((action, index) => {
            const config = SOURCE_CONFIG[action.source];
            const Icon = config.icon;
            
            return (
              <div 
                key={index}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg transition-colors',
                  config.bgColor
                )}
              >
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold text-muted-foreground w-5">
                    {index + 1}.
                  </span>
                  <Icon className={cn('h-4 w-4', config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{action.text}</p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {config.label}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
