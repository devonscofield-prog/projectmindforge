import { memo } from 'react';
import { format } from 'date-fns';
import { parseDateOnly } from '@/lib/formatters';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Clock, ChevronRight, Flame, Users } from 'lucide-react';
import { CallType, callTypeLabels } from '@/constants/callTypes';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface MobileCallCardProps {
  call: {
    id: string;
    call_date: string;
    primary_stakeholder_name?: string | null;
    account_name?: string | null;
    call_type?: string | null;
    call_type_other?: string | null;
    potential_revenue?: number | null;
    analysis_status: string;
    heat_score?: number | null;
    coach_grade?: string | null;
    manager_id?: string | null;
    is_unqualified?: boolean;
  };
  onClick: () => void;
}

export const MobileCallCard = memo(function MobileCallCard({ call, onClick }: MobileCallCardProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="gap-1 text-xs"><CheckCircle className="h-3 w-3" /> Analyzed</Badge>;
      case 'processing':
        return <Badge variant="secondary" className="gap-1 text-xs"><Clock className="h-3 w-3" /> Processing</Badge>;
      case 'error':
        return <Badge variant="destructive" className="gap-1 text-xs"><AlertCircle className="h-3 w-3" /> Error</Badge>;
      default:
        return <Badge variant="outline" className="gap-1 text-xs"><Clock className="h-3 w-3" /> Pending</Badge>;
    }
  };

  const getCallTypeDisplay = () => {
    if (call.call_type === 'other' && call.call_type_other) {
      return call.call_type_other;
    }
    if (call.call_type) {
      return callTypeLabels[call.call_type as CallType] || call.call_type;
    }
    return '-';
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getGradeBadge = (grade: string | null | undefined) => {
    if (!grade) return null;
    
    const isA = grade.startsWith('A');
    const isBC = grade.startsWith('B') || grade.startsWith('C');
    const isDF = grade.startsWith('D') || grade.startsWith('F');
    
    return (
      <span className={cn(
        "font-bold text-xs px-1.5 py-0.5 rounded border",
        isA && "border-green-500 text-green-600 bg-green-50 dark:border-green-400 dark:text-green-400 dark:bg-green-950",
        isBC && "border-yellow-500 text-yellow-600 bg-yellow-50 dark:border-yellow-400 dark:text-yellow-400 dark:bg-yellow-950",
        isDF && "border-red-500 text-red-600 bg-red-50 dark:border-red-400 dark:text-red-400 dark:bg-red-950"
      )}>
        {grade}
      </span>
    );
  };

  return (
    <Card 
      variant="interactive"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium truncate">
                {call.account_name || call.primary_stakeholder_name || 'Unknown'}
              </p>
              {call.is_unqualified && (
                <Badge variant="outline" className="text-xs border-muted-foreground/50 text-muted-foreground gap-1">
                  🚫 Unqualified
                </Badge>
              )}
              {call.manager_id && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Users className="h-4 w-4 text-primary shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent>Manager was on this call</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {getStatusBadge(call.analysis_status)}
            </div>
            
            {call.account_name && call.primary_stakeholder_name && (
              <p className="text-sm text-muted-foreground truncate">
                {call.primary_stakeholder_name}
              </p>
            )}
            
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              <span>{format(parseDateOnly(call.call_date), 'MMM d, yyyy')}</span>
              <Badge variant="outline" className="text-xs">{getCallTypeDisplay()}</Badge>
              {getGradeBadge(call.coach_grade)}
              {call.heat_score != null && (
                <span className={cn(
                  "flex items-center gap-1 font-medium",
                  call.heat_score >= 70 && "text-orange-600 dark:text-orange-400",
                  call.heat_score >= 40 && call.heat_score < 70 && "text-yellow-600 dark:text-yellow-400",
                  call.heat_score < 40 && "text-blue-600 dark:text-blue-400"
                )}>
                  <Flame className="h-3 w-3" />
                  {call.heat_score}
                </span>
              )}
              {formatCurrency(call.potential_revenue) && (
                <span className="text-green-600">{formatCurrency(call.potential_revenue)}</span>
              )}
            </div>
          </div>
          
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
});
