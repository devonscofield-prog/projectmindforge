import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingDown, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface TraineeStats {
  trainee_id: string;
  trainee_name: string;
  trainee_email: string;
  total_sessions: number;
  completed_sessions: number;
  avg_grade: number | null;
  latest_grade: string | null;
  latest_session_date: string | null;
  total_practice_minutes: number;
  grade_trend?: 'improving' | 'stable' | 'declining';
}

interface TraineesNeedingAttentionProps {
  traineeStats: TraineeStats[];
}

const gradeToScore: Record<string, number> = {
  'A+': 98,
  'A': 90,
  'B': 77,
  'C': 62,
  'D': 47,
  'F': 30,
};

type AttentionReason = 'declining' | 'inactive' | 'low_grade' | 'no_sessions';

interface TraineeWithAttention extends TraineeStats {
  reasons: AttentionReason[];
  priority: number;
}

export function TraineesNeedingAttention({ traineeStats }: TraineesNeedingAttentionProps) {
  const navigate = useNavigate();

  const traineesNeedingAttention = useMemo(() => {
    const results: TraineeWithAttention[] = [];

    traineeStats.forEach(trainee => {
      const reasons: AttentionReason[] = [];
      let priority = 0;

      // Check for declining performance
      if (trainee.grade_trend === 'declining') {
        reasons.push('declining');
        priority += 3;
      }

      // Check for inactivity (no practice in 7+ days)
      if (trainee.latest_session_date) {
        const daysSinceLast = differenceInDays(new Date(), new Date(trainee.latest_session_date));
        if (daysSinceLast >= 7) {
          reasons.push('inactive');
          priority += 2;
        }
      } else if (trainee.total_sessions > 0) {
        reasons.push('inactive');
        priority += 2;
      }

      // Check for low grades
      if (trainee.latest_grade) {
        const score = gradeToScore[trainee.latest_grade];
        if (score && score < 60) {
          reasons.push('low_grade');
          priority += 2;
        }
      }

      // Check for no sessions at all
      if (trainee.total_sessions === 0) {
        reasons.push('no_sessions');
        priority += 1;
      }

      if (reasons.length > 0) {
        results.push({ ...trainee, reasons, priority });
      }
    });

    // Sort by priority (highest first)
    return results.sort((a, b) => b.priority - a.priority).slice(0, 5);
  }, [traineeStats]);

  if (traineesNeedingAttention.length === 0) {
    return null;
  }

  const getReasonIcon = (reason: AttentionReason) => {
    switch (reason) {
      case 'declining':
        return <TrendingDown className="h-3 w-3" />;
      case 'inactive':
        return <Clock className="h-3 w-3" />;
      case 'low_grade':
      case 'no_sessions':
        return <AlertTriangle className="h-3 w-3" />;
    }
  };

  const getReasonLabel = (reason: AttentionReason) => {
    switch (reason) {
      case 'declining':
        return 'Declining';
      case 'inactive':
        return 'Inactive';
      case 'low_grade':
        return 'Low Grade';
      case 'no_sessions':
        return 'No Practice';
    }
  };

  const getReasonColor = (reason: AttentionReason) => {
    switch (reason) {
      case 'declining':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'inactive':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low_grade':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'no_sessions':
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <Card className="mb-6 border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Trainees Needing Attention
        </CardTitle>
        <CardDescription>Team members who may benefit from coaching or encouragement</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {traineesNeedingAttention.map(trainee => (
            <div 
              key={trainee.trainee_id}
              className="flex items-center justify-between p-3 bg-background rounded-lg border"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{trainee.trainee_name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {trainee.reasons.map(reason => (
                    <Badge 
                      key={reason}
                      variant="outline"
                      className={cn("text-xs flex items-center gap-1", getReasonColor(reason))}
                    >
                      {getReasonIcon(reason)}
                      {getReasonLabel(reason)}
                    </Badge>
                  ))}
                  {trainee.latest_session_date && (
                    <span className="text-xs text-muted-foreground">
                      Last: {formatDistanceToNow(new Date(trainee.latest_session_date), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate(`/training/history?trainee=${trainee.trainee_id}`)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
