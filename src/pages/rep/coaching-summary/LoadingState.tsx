import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Sparkles } from 'lucide-react';

interface LoadingStateProps {
  isComparisonMode: boolean;
  comparisonConfirmed: boolean;
}

export function LoadingState({ isComparisonMode, comparisonConfirmed }: LoadingStateProps) {
  return (
    <div className="space-y-6">
      <Card className="border-dashed">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <Sparkles className="h-5 w-5 text-primary absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium">
                {isComparisonMode && comparisonConfirmed ? 'Analyzing both periods...' : 'Analyzing your calls...'}
              </p>
              <p className="text-muted-foreground text-sm">
                Our AI is reviewing your call data to identify trends and patterns.
                <br />
                This may take 15-30 seconds{isComparisonMode && comparisonConfirmed ? ' per period' : ''}.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-32 mt-2" />
              <Skeleton className="h-20 w-full mt-4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
