import { useState } from 'react';
import { CheckCircle2, AlertTriangle, ChevronDown, Lightbulb, GraduationCap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { CoachingSynthesis } from '@/utils/analysis-schemas';

interface CoachingCardProps {
  data: CoachingSynthesis | null;
  className?: string;
}

const getGradeStyles = (grade: string) => {
  switch (grade) {
    case 'A+':
    case 'A':
      return {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-400',
        border: 'border-green-200 dark:border-green-800',
      };
    case 'B':
    case 'C':
      return {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        text: 'text-yellow-700 dark:text-yellow-400',
        border: 'border-yellow-200 dark:border-yellow-800',
      };
    case 'D':
    case 'F':
    default:
      return {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-200 dark:border-red-800',
      };
  }
};

export function CoachingCard({ data, className }: CoachingCardProps) {
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);

  if (!data) {
    return (
      <Card className={cn('overflow-hidden border-dashed border-2 border-muted-foreground/25', className)}>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-3 rounded-full bg-muted/50 mb-3">
            <GraduationCap className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Coaching synthesis will appear when analysis completes
          </p>
        </CardContent>
      </Card>
    );
  }

  const gradeStyles = getGradeStyles(data.overall_grade);

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Header Section */}
      <div className="flex items-center gap-6 p-6 border-b border-border bg-muted/30">
        <div
          className={cn(
            'flex items-center justify-center w-20 h-20 rounded-xl border-2 font-bold text-3xl',
            gradeStyles.bg,
            gradeStyles.text,
            gradeStyles.border
          )}
        >
          {data.overall_grade}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Primary Focus</span>
          </div>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {data.primary_focus_area}
          </Badge>
        </div>
      </div>

      <CardContent className="p-6 space-y-6">
        {/* The One Big Thing */}
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <span className="font-semibold text-primary">The One Big Thing</span>
          </div>
          <p className="text-foreground leading-relaxed">{data.coaching_prescription}</p>
        </div>

        {/* Executive Summary */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Executive Summary</h4>
          <p className="text-foreground leading-relaxed">{data.executive_summary}</p>
        </div>

        {/* Strengths & Improvements Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strengths */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Strengths</h4>
            <ul className="space-y-2">
              {data.top_3_strengths.map((strength, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 mt-0.5 shrink-0" />
                  <span className="text-foreground">{strength}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Areas for Improvement */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Areas for Improvement</h4>
            <ul className="space-y-2">
              {data.top_3_areas_for_improvement.map((improvement, index) => (
                <li key={index} className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                  <span className="text-foreground">{improvement}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Collapsible Grading Logic */}
        <Collapsible open={isReasoningOpen} onOpenChange={setIsReasoningOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full pt-4 border-t border-border">
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', isReasoningOpen && 'rotate-180')}
            />
            <span>{isReasoningOpen ? 'Hide' : 'Show'} Grading Logic</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <p className="text-sm text-muted-foreground leading-relaxed">{data.grade_reasoning}</p>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
