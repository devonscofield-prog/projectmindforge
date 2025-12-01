import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, TrendingUp, Users, Phone, Flame } from 'lucide-react';
import { formatCurrency } from './constants';
import type { Prospect } from '@/api/prospects';

interface ProspectQuickStatsProps {
  prospect: Prospect;
  stakeholderCount: number;
  callCount: number;
}

function HeatScoreDisplay({ score }: { score: number | null }) {
  if (score === null) return null;

  let colorClass = 'text-muted-foreground bg-muted';
  if (score >= 8) colorClass = 'text-red-600 bg-red-100 dark:bg-red-900/30';
  else if (score >= 6) colorClass = 'text-orange-600 bg-orange-100 dark:bg-orange-900/30';
  else if (score >= 4) colorClass = 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
  else colorClass = 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';

  return (
    <div className={`flex items-center gap-2 px-3 py-2 md:py-3 rounded-lg ${colorClass}`}>
      <Flame className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
      <div>
        <p className="text-xs md:text-sm font-medium">Heat Score</p>
        <p className="text-base md:text-lg font-bold">{score}/10</p>
      </div>
    </div>
  );
}

export function ProspectQuickStats({ prospect, stakeholderCount, callCount }: ProspectQuickStatsProps) {
  // Calculate potential revenue from opportunity details if available
  const opportunityDetails = prospect.opportunity_details || {};
  const hasCounts = opportunityDetails.it_users_count || 
                     opportunityDetails.end_users_count || 
                     opportunityDetails.ai_users_count ||
                     opportunityDetails.compliance_users_count ||
                     opportunityDetails.security_awareness_count;

  let potentialRevenue = prospect.potential_revenue;
  
  // If user counts are provided, calculate estimated potential
  if (hasCounts) {
    const itRevenue = (opportunityDetails.it_users_count || 0) * 350;
    const endUserRevenue = (opportunityDetails.end_users_count || 0) * 150;
    const aiRevenue = (opportunityDetails.ai_users_count || 0) * 500;
    const complianceRevenue = (opportunityDetails.compliance_users_count || 0) * 120;
    const securityRevenue = (opportunityDetails.security_awareness_count || 0) * 100;
    potentialRevenue = itRevenue + endUserRevenue + aiRevenue + complianceRevenue + securityRevenue;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
      <HeatScoreDisplay score={prospect.heat_score} />
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Potential</p>
              <p className="text-base md:text-lg font-bold truncate">{formatCurrency(potentialRevenue)}</p>
              {hasCounts && <p className="text-xs text-muted-foreground">Estimated</p>}
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
