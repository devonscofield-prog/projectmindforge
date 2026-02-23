import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
// Tooltip imports removed - unused
import { 
  MessageSquare, 
  CheckCircle2, 
  AlertTriangle,
  XCircle,
  Lightbulb,
  Minus
} from 'lucide-react';
import type { ObjectionHandlingData } from '@/utils/analysis-schemas';
import { cn } from '@/lib/utils';

interface ObjectionHandlingPanelProps {
  data: ObjectionHandlingData | null | undefined;
}

function getRatingIcon(rating: 'Great' | 'Okay' | 'Bad') {
  switch (rating) {
    case 'Great':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'Okay':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'Bad':
      return <XCircle className="h-4 w-4 text-destructive" />;
  }
}

function getRatingStyles(rating: 'Great' | 'Okay' | 'Bad') {
  switch (rating) {
    case 'Great':
      return 'bg-green-500/10 border-green-500/50';
    case 'Okay':
      return 'bg-yellow-500/10 border-yellow-500/50';
    case 'Bad':
      return 'bg-destructive/10 border-destructive/50';
  }
}

function getCategoryColor(category: string) {
  switch (category) {
    case 'Price':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
    case 'Competitor':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300';
    case 'Authority':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300';
    case 'Need':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300';
    case 'Timing':
      return 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300';
    case 'Feature':
      return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

interface ObjectionCardProps {
  objection: string;
  category: string;
  repResponse: string;
  handlingRating: 'Great' | 'Okay' | 'Bad';
  coachingTip: string;
}

function ObjectionCard({ objection, category, repResponse, handlingRating, coachingTip }: ObjectionCardProps) {
  return (
    <div className={cn(
      "p-4 rounded-xl border-2 space-y-3",
      getRatingStyles(handlingRating)
    )}>
      {/* Header: Category + Rating */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Badge className={cn("text-xs font-medium", getCategoryColor(category))}>
          {category}
        </Badge>
        <div className="flex items-center gap-1.5">
          {getRatingIcon(handlingRating)}
          <span className={cn(
            "text-sm font-medium",
            handlingRating === 'Great' && "text-green-600 dark:text-green-400",
            handlingRating === 'Okay' && "text-yellow-600 dark:text-yellow-400",
            handlingRating === 'Bad' && "text-destructive"
          )}>
            {handlingRating}
          </span>
        </div>
      </div>

      {/* Objection Quote */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Prospect's Objection</p>
        <p className="text-sm italic text-foreground">"{objection}"</p>
      </div>

      {/* Rep Response */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Rep's Response</p>
        <p className="text-sm text-foreground">{repResponse}</p>
      </div>

      {/* Coaching Tip */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-background/50 border border-dashed">
        <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Coaching Tip</p>
          <p className="text-sm">{coachingTip}</p>
        </div>
      </div>
    </div>
  );
}

export function ObjectionHandlingPanel({ data }: ObjectionHandlingPanelProps) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Objection Handling
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const { score, grade, objections_detected = [] } = data;
  const isPassing = grade === 'Pass';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              🎯 Objection Handling
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              How effectively objections were addressed
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{score}</span>
            <Badge 
              variant={isPassing ? 'default' : 'destructive'}
              className={isPassing ? 'bg-green-500 hover:bg-green-600' : ''}
            >
              {grade}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {objections_detected.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Minus className="h-5 w-5 mb-2" />
            <p>No objections detected in this call</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {objections_detected.map((obj, index) => (
              <ObjectionCard
                key={index}
                objection={obj.objection}
                category={obj.category}
                repResponse={obj.rep_response}
                handlingRating={obj.handling_rating}
                coachingTip={obj.coaching_tip}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}