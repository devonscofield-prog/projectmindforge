import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Flame, Calendar, ChevronRight } from 'lucide-react';
import { ProspectStatus } from '@/api/prospects';

const statusLabels: Record<ProspectStatus, string> = {
  active: 'Active',
  won: 'Won',
  lost: 'Lost',
  dormant: 'Dormant',
};

const statusVariants: Record<ProspectStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  won: 'secondary',
  lost: 'destructive',
  dormant: 'outline',
};

interface MobileProspectCardProps {
  prospect: {
    id: string;
    account_name?: string | null;
    prospect_name: string;
    status: ProspectStatus;
    industry?: string | null;
    heat_score?: number | null;
    potential_revenue?: number | null;
    last_contact_date?: string | null;
  };
  stakeholderCount: number;
  callCount: number;
  onClick: () => void;
}

function HeatScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  
  let colorClass = 'text-muted-foreground';
  if (score >= 8) colorClass = 'text-red-500';
  else if (score >= 6) colorClass = 'text-orange-500';
  else if (score >= 4) colorClass = 'text-yellow-500';
  else colorClass = 'text-blue-500';

  return (
    <div className="flex items-center gap-1">
      <Flame className={`h-4 w-4 ${colorClass}`} />
      <span className={`text-sm font-medium ${colorClass}`}>{score}/10</span>
    </div>
  );
}

export function MobileProspectCard({ prospect, stakeholderCount, callCount, onClick }: MobileProspectCardProps) {
  const formatCurrency = (value: number | null | undefined): string | null => {
    if (value == null) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

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
              
              {formatCurrency(prospect.potential_revenue) && (
                <span className="text-green-600 font-medium">
                  {formatCurrency(prospect.potential_revenue)}
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
