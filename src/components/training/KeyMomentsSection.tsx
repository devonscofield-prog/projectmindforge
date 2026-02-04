import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  MessageSquareQuote
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface KeyMoment {
  moment: string;
  assessment: string;
  suggestion: string;
}

interface KeyMomentsSectionProps {
  keyMoments: KeyMoment[];
}

export function KeyMomentsSection({ keyMoments }: KeyMomentsSectionProps) {
  if (!keyMoments || keyMoments.length === 0) {
    return null;
  }

  // Determine if assessment is positive or negative based on keywords
  const isPositiveAssessment = (assessment: string): boolean => {
    const positiveKeywords = ['well', 'good', 'great', 'excellent', 'effective', 'strong', 'correctly', 'successfully', 'nice'];
    const lowerAssessment = assessment.toLowerCase();
    return positiveKeywords.some(kw => lowerAssessment.includes(kw));
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          Key Moments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {keyMoments.map((moment, idx) => {
          const isPositive = isPositiveAssessment(moment.assessment);
          
          return (
            <div 
              key={idx} 
              className={cn(
                "p-4 rounded-lg border-l-4",
                isPositive 
                  ? "bg-green-500/5 border-green-500" 
                  : "bg-amber-500/5 border-amber-500"
              )}
            >
              {/* Quote */}
              <div className="flex items-start gap-2 mb-3">
                <MessageSquareQuote className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-sm italic text-foreground">
                  "{moment.moment}"
                </p>
              </div>

              {/* Assessment */}
              <div className="flex items-start gap-2 mb-2">
                {isPositive ? (
                  <ThumbsUp className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <ThumbsDown className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                )}
                <div>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs mb-1",
                      isPositive ? "border-green-500/50 text-green-600" : "border-amber-500/50 text-amber-600"
                    )}
                  >
                    {isPositive ? 'Strength' : 'Opportunity'}
                  </Badge>
                  <p className="text-sm text-muted-foreground">{moment.assessment}</p>
                </div>
              </div>

              {/* Suggestion */}
              <div className="flex items-start gap-2 mt-3 pt-3 border-t border-border/50">
                <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm font-medium">{moment.suggestion}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
