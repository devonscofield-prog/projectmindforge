import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { GraduationCap, ChevronRight } from 'lucide-react';

interface CoachingSummaryCTAProps {
  className?: string;
}

export function CoachingSummaryCTA({ className }: CoachingSummaryCTAProps) {
  return (
    <Card className={className}>
      <CardContent className="py-4">
        <Link
          to="/rep/coaching-summary"
          className="flex items-center gap-3 group"
        >
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground group-hover:text-primary transition-colors">
              View Your Coaching Summary
            </p>
            <p className="text-sm text-muted-foreground">
              See personalized insights and improvement trends from your recent calls.
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        </Link>
      </CardContent>
    </Card>
  );
}
