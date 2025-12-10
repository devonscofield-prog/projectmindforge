import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { HeatScoreBadge } from '@/components/ui/heat-score-badge';
import { Phone, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { parseDateOnly } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { CallRecord } from '@/hooks/prospect/types';

interface ProspectCallHistoryProps {
  calls: CallRecord[];
}

function getGradeBadge(grade: string | null) {
  if (!grade) return null;
  
  const isA = grade.startsWith('A');
  const isBC = grade.startsWith('B') || grade.startsWith('C');
  const isDF = grade.startsWith('D') || grade.startsWith('F');
  
  return (
    <Badge 
      variant="outline"
      className={cn(
        "font-bold min-w-[2rem] justify-center text-xs",
        isA && "border-green-500 text-green-600 bg-green-50 dark:border-green-400 dark:text-green-400 dark:bg-green-950",
        isBC && "border-yellow-500 text-yellow-600 bg-yellow-50 dark:border-yellow-400 dark:text-yellow-400 dark:bg-yellow-950",
        isDF && "border-red-500 text-red-600 bg-red-50 dark:border-red-400 dark:text-red-400 dark:bg-red-950"
      )}
    >
      {grade}
    </Badge>
  );
}

function formatCallType(callType: string | null): string {
  if (!callType) return 'Call';
  return callType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function CallRow({ call }: { call: CallRecord }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasInsights = call.critical_gaps_count !== null && call.critical_gaps_count > 0;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div 
        className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {hasInsights ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <Phone className="h-4 w-4 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">
              {call.primary_stakeholder_name 
                ? `${call.primary_stakeholder_name} - ${formatCallType(call.call_type)}`
                : formatCallType(call.call_type)
              }
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{format(parseDateOnly(call.call_date), 'MMM d, yyyy')}</span>
              {call.detected_call_type && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {formatCallType(call.detected_call_type)}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {call.heat_score !== null && (
            <HeatScoreBadge score={call.heat_score} variant="default" />
          )}
          {getGradeBadge(call.coach_grade)}
          <Badge variant={call.analysis_status === 'completed' ? 'secondary' : 'outline'}>
            {call.analysis_status}
          </Badge>
        </div>
      </div>
      
      {isExpanded && hasInsights && (
        <div className="px-3 pb-3 pt-1 border-t bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">
              {call.critical_gaps_count} Critical Gap{call.critical_gaps_count !== 1 ? 's' : ''} Identified
            </span>
          </div>
          <Link
            to={`/calls/${call.id}`}
            className="text-xs text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            View Full Analysis →
          </Link>
        </div>
      )}
    </div>
  );
}

export function ProspectCallHistory({ calls }: ProspectCallHistoryProps) {
  return (
    <CollapsibleSection
      title="Call History"
      description="All calls with this account"
      icon={<Phone className="h-5 w-5 text-primary" />}
    >
      {calls.length === 0 ? (
        <p className="text-sm text-muted-foreground">No calls recorded yet</p>
      ) : (
        <div className="space-y-2">
          {calls.map((call) => (
            <CallRow key={call.id} call={call} />
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
