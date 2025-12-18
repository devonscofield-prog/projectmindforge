import { useState } from 'react';
import { CheckCircle2, AlertTriangle, ChevronDown, Lightbulb, GraduationCap, Target, Dumbbell, TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import type { CoachingSynthesis } from '@/utils/analysis-schemas';

interface CoachingCardProps {
  data: CoachingSynthesis | null;
  className?: string;
  isLoading?: boolean;
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
      return {
        bg: 'bg-lime-100 dark:bg-lime-900/30',
        text: 'text-lime-700 dark:text-lime-400',
        border: 'border-lime-200 dark:border-lime-800',
      };
    case 'C':
      return {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800',
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

export function CoachingCard({ data, className, isLoading = false }: CoachingCardProps) {
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);
  const [isDrillOpen, setIsDrillOpen] = useState(false);
  const [isCardOpen, setIsCardOpen] = useState(true);

  // Loading skeleton state
  if (isLoading) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <div className="flex items-center gap-6 p-6 border-b border-border bg-muted/30">
          <Skeleton className="w-20 h-20 rounded-xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-32" />
          </div>
        </div>
        <CardContent className="p-6 space-y-6">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

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
    <Collapsible open={isCardOpen} onOpenChange={setIsCardOpen}>
      <Card className={cn('overflow-hidden', className)}>
        {/* Header Section - Always visible, acts as trigger */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between gap-6 p-6 border-b border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-6">
              <div
                className={cn(
                  'flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-xl border-2 font-bold text-2xl md:text-3xl',
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
            <ChevronDown className={cn(
              'h-5 w-5 text-muted-foreground transition-transform shrink-0',
              isCardOpen && 'rotate-180'
            )} />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="p-6 space-y-6">
        {/* The One Big Thing - Punchy Headline */}
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <span className="font-semibold text-primary">The One Big Thing</span>
          </div>
          <p className="text-foreground leading-relaxed">{data.coaching_prescription}</p>
        </div>

        {/* Immediate Action - CTA Banner */}
        {data.immediate_action && (
          <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 p-4">
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-amber-700 dark:text-amber-300 text-sm">Immediate Action</span>
                <p className="text-amber-800 dark:text-amber-200 mt-1">{data.immediate_action}</p>
              </div>
            </div>
          </div>
        )}

        {/* Practice Drill - Collapsible with Markdown */}
        {data.coaching_drill && (
          <Collapsible open={isDrillOpen} onOpenChange={setIsDrillOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors w-full p-3 rounded-lg bg-muted/50 hover:bg-muted">
              <Dumbbell className="h-4 w-4" />
              <span>Practice Drill</span>
              <ChevronDown
                className={cn('h-4 w-4 ml-auto transition-transform', isDrillOpen && 'rotate-180')}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="rounded-lg border border-border bg-muted/30 p-4 prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h4 className="text-base font-semibold mb-2">{children}</h4>,
                    h2: ({ children }) => <h5 className="text-sm font-semibold mb-2">{children}</h5>,
                    p: ({ children }) => <p className="mb-2 text-foreground">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                    ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2">{children}</ol>,
                    ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2">{children}</ul>,
                    li: ({ children }) => <li className="text-foreground">{children}</li>,
                  }}
                >
                  {data.coaching_drill}
                </ReactMarkdown>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Executive Summary */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Executive Summary</h4>
          <p className="text-foreground leading-relaxed">{data.executive_summary}</p>
        </div>

        {/* Deal Progression - Only shown when account history exists */}
        {data.deal_progression && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Deal Progression
              </h4>
              <div className="flex items-center gap-3">
                {/* Momentum Badge */}
                <Badge 
                  variant="outline" 
                  className={cn(
                    'capitalize',
                    data.deal_progression.momentum === 'accelerating' && 'border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
                    data.deal_progression.momentum === 'steady' && 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
                    data.deal_progression.momentum === 'stalling' && 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
                    data.deal_progression.momentum === 'regressing' && 'border-red-500 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                  )}
                >
                  {data.deal_progression.momentum === 'accelerating' && <TrendingUp className="h-3 w-3 mr-1" />}
                  {data.deal_progression.momentum === 'steady' && <Minus className="h-3 w-3 mr-1" />}
                  {data.deal_progression.momentum === 'stalling' && <TrendingDown className="h-3 w-3 mr-1" />}
                  {data.deal_progression.momentum === 'regressing' && <TrendingDown className="h-3 w-3 mr-1" />}
                  {data.deal_progression.momentum}
                </Badge>
                
                {/* Heat Trend Indicator */}
                {data.deal_progression.heat_trend && (
                  <div className={cn(
                    'flex items-center gap-1 text-sm font-medium',
                    data.deal_progression.heat_trend === 'up' && 'text-green-600 dark:text-green-400',
                    data.deal_progression.heat_trend === 'down' && 'text-red-600 dark:text-red-400',
                    data.deal_progression.heat_trend === 'flat' && 'text-muted-foreground'
                  )}>
                    {data.deal_progression.heat_trend === 'up' && <ArrowUpRight className="h-4 w-4" />}
                    {data.deal_progression.heat_trend === 'down' && <ArrowDownRight className="h-4 w-4" />}
                    {data.deal_progression.heat_trend === 'flat' && <ArrowRight className="h-4 w-4" />}
                    <span className="text-xs">Heat</span>
                  </div>
                )}
              </div>
            </div>

            {/* Gaps Closed */}
            {data.deal_progression.gaps_closed && data.deal_progression.gaps_closed.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-muted-foreground mb-2">Gaps Closed This Call</h5>
                <ul className="space-y-1">
                  {data.deal_progression.gaps_closed.map((gap, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500 mt-0.5 shrink-0" />
                      <span className="text-foreground">{gap}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* New Gaps Opened */}
            {data.deal_progression.new_gaps_opened && data.deal_progression.new_gaps_opened.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-muted-foreground mb-2">New Gaps Identified</h5>
                <ul className="space-y-1">
                  {data.deal_progression.new_gaps_opened.map((gap, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                      <span className="text-foreground">{gap}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Promised Follow-ups Addressed */}
            {data.deal_progression.promised_followups_addressed !== undefined && (
              <div className="flex items-center gap-2 text-sm">
                {data.deal_progression.promised_followups_addressed ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
                    <span className="text-foreground">Previous follow-up commitments addressed</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                    <span className="text-foreground">Previous follow-up commitments not addressed</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

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
      </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
