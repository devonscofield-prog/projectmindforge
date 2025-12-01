import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, TrendingUp, Users, Phone } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { HeatScoreBadge } from '@/components/ui/heat-score-badge';
import type { Prospect } from '@/api/prospects';

interface ProspectQuickStatsProps {
  prospect: Prospect;
  stakeholderCount: number;
  callCount: number;
}

export function ProspectQuickStats({ prospect, stakeholderCount, callCount }: ProspectQuickStatsProps) {
  // Use manual potential revenue from opportunity details, fallback to legacy field
  const opportunityDetails = prospect.opportunity_details || {};
  const potentialRevenue = opportunityDetails.potential_revenue ?? prospect.potential_revenue;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
      <HeatScoreBadge score={prospect.heat_score} variant="card" />
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Potential</p>
              <p className="text-base md:text-lg font-bold truncate">{formatCurrency(potentialRevenue)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-green-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Active</p>
              <p className="text-base md:text-lg font-bold truncate text-green-600">
                {formatCurrency(prospect.active_revenue)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">Stakeholders</p>
              <p className="text-base md:text-lg font-bold">{stakeholderCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">Total Calls</p>
              <p className="text-base md:text-lg font-bold">{callCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
