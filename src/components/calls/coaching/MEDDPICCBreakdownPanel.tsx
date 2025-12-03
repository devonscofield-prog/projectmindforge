import { Target, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface MEDDPICCElement {
  score: number;
  justification?: string;
}

interface MEDDPICCScores {
  overall_score: number;
  summary?: string;
  metrics?: MEDDPICCElement;
  economic_buyer?: MEDDPICCElement;
  decision_criteria?: MEDDPICCElement;
  decision_process?: MEDDPICCElement;
  paper_process?: MEDDPICCElement;
  identify_pain?: MEDDPICCElement;
  champion?: MEDDPICCElement;
  competition?: MEDDPICCElement;
}

interface MEDDPICCBreakdownPanelProps {
  meddpicc: MEDDPICCScores;
}

const ELEMENT_LABELS: Record<string, { label: string; description: string }> = {
  metrics: { label: 'Metrics', description: 'Quantifiable business outcomes and success metrics' },
  economic_buyer: { label: 'Economic Buyer', description: 'Decision-maker with budget authority identified' },
  decision_criteria: { label: 'Decision Criteria', description: 'Evaluation criteria understood' },
  decision_process: { label: 'Decision Process', description: 'Buying process and timeline mapped' },
  paper_process: { label: 'Paper Process', description: 'Procurement, legal, and contract process' },
  identify_pain: { label: 'Identify Pain', description: 'Business pains and impact quantified' },
  champion: { label: 'Champion', description: 'Internal advocate actively selling for you' },
  competition: { label: 'Competition', description: 'Competitive landscape understood' },
};

const ELEMENT_KEYS = ['metrics', 'economic_buyer', 'decision_criteria', 'decision_process', 'paper_process', 'identify_pain', 'champion', 'competition'] as const;

export function MEDDPICCBreakdownPanel({ meddpicc }: MEDDPICCBreakdownPanelProps) {
  // Sort elements by score to highlight weakest areas
  const sortedElements = ELEMENT_KEYS
    .map(key => ({
      key,
      element: meddpicc[key],
      ...ELEMENT_LABELS[key],
    }))
    .filter(item => item.element && typeof item.element === 'object')
    .sort((a, b) => (a.element?.score ?? 0) - (b.element?.score ?? 0));

  const getScoreColor = (score: number) => {
    if (score >= 7) return 'bg-green-500';
    if (score >= 4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreTextColor = (score: number) => {
    if (score >= 7) return 'text-green-600 dark:text-green-400';
    if (score >= 4) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getStatusIcon = (score: number) => {
    if (score >= 7) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (score >= 4) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <AlertCircle className="h-4 w-4 text-red-500" />;
  };

  // Find lowest 2 scores for highlighting
  const lowestScores = sortedElements.slice(0, 2).map(e => e.key);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            MEDDPICC Breakdown
          </div>
          <Badge variant="outline" className="text-base">
            Overall: {meddpicc.overall_score}
          </Badge>
        </CardTitle>
        {meddpicc.summary && (
          <p className="text-sm text-muted-foreground">{meddpicc.summary}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <TooltipProvider>
          {sortedElements.map(({ key, element, label, description }) => {
            const score = element?.score ?? 0;
            const isLowest = lowestScores.includes(key);
            
            return (
              <div 
                key={key} 
                className={cn(
                  'rounded-lg p-3 transition-colors',
                  isLowest ? 'bg-destructive/5 border border-destructive/20' : 'bg-muted/30'
                )}
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(score)}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-medium text-sm cursor-help">{label}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p>{description}</p>
                        </TooltipContent>
                      </Tooltip>
                      {isLowest && (
                        <Badge variant="destructive" className="text-[10px] h-5">
                          Needs Work
                        </Badge>
                      )}
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={cn('h-full transition-all duration-500', getScoreColor(score))}
                          style={{ width: `${score * 10}%` }}
                        />
                      </div>
                      <span className={cn('text-sm font-bold w-8 text-right', getScoreTextColor(score))}>
                        {score}
                      </span>
                    </div>
                    
                    {/* Justification */}
                    {element?.justification && (
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                        {element.justification}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
