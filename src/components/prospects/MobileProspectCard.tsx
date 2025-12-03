import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Calendar, ChevronRight } from 'lucide-react';
import { ProspectStatus } from '@/api/prospects';
import { statusLabels, statusVariants } from '@/constants/prospects';
import { formatCurrency } from '@/lib/formatters';
import { HeatScoreBadge } from '@/components/ui/heat-score-badge';

interface MobileProspectCardProps {
  prospect: {
    id: string;
    account_name?: string | null;
    prospect_name: string;
    status: ProspectStatus;
    industry?: string | null;
    heat_score?: number | null;
    active_revenue?: number | null;
    last_contact_date?: string | null;
  };
  stakeholderCount: number;
  callCount: number;
  onClick: () => void;
}

export function MobileProspectCard({ prospect, stakeholderCount, callCount, onClick }: MobileProspectCardProps) {
  return (
    <Card 
      variant="interactive"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header row */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {prospect.account_name || prospect.prospect_name}
                </p>
                {prospect.account_name && prospect.prospect_name && (
                  <p className="text-xs text-muted-foreground truncate">
                    Primary: {prospect.prospect_name}
                  </p>
                )}
              </div>
              <Badge variant={statusVariants[prospect.status]} className="flex-shrink-0">
                {statusLabels[prospect.status]}
              </Badge>
            </div>
            
            {/* Stats row */}
            <div className="flex items-center gap-4 text-sm">
              <HeatScoreBadge score={prospect.heat_score ?? null} />
              
              {formatCurrency(prospect.active_revenue) && (
                <span className="text-green-600 font-medium">
                  {formatCurrency(prospect.active_revenue)}
                </span>
              )}
              
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{stakeholderCount}</span>
              </div>
              
              <span className="text-muted-foreground">
                {callCount} call{callCount !== 1 ? 's' : ''}
              </span>
            </div>
            
            {/* Footer row */}
            {prospect.last_contact_date && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Last contact: {format(new Date(prospect.last_contact_date), 'MMM d, yyyy')}</span>
              </div>
            )}
          </div>
          
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}
