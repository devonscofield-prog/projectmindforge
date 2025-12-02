import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Users, Phone } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { HeatScoreBadge } from '@/components/ui/heat-score-badge';
import type { Prospect } from '@/api/prospects';

interface ProspectQuickStatsProps {
  prospect: Prospect;
  stakeholderCount: number;
  callCount: number;
}

export function ProspectQuickStats({ prospect, stakeholderCount, callCount }: ProspectQuickStatsProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-6">
          <HeatScoreBadge score={prospect.heat_score} />
          
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Current Opportunity</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(prospect.active_revenue)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Stakeholders</p>
              <p className="text-lg font-bold">{stakeholderCount}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total Calls</p>
              <p className="text-lg font-bold">{callCount}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
