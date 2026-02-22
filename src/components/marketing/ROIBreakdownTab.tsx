import { Clock, TrendingUp, DollarSign, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/roiCalculations';
import type { calculateROI } from '@/lib/roiCalculations';

type ROIResults = ReturnType<typeof calculateROI>;

interface ROIBreakdownTabProps {
  results: ROIResults;
}

export function ROIBreakdownTab({ results }: ROIBreakdownTabProps) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Time Savings */}
      <div className="space-y-4">
        <h4 className="font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" />
          Time Savings
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Hours saved per rep/month</span>
            <span className="font-medium">{results.timeSavings.hoursPerRepPerMonth}h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total team hours/month</span>
            <span className="font-medium">{results.timeSavings.totalMonthlyHours}h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">FTE equivalent freed</span>
            <span className="font-medium">{results.timeSavings.fteEquivalent}</span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="font-medium">Annual value</span>
            <span className="font-bold text-blue-500">{formatCurrency(results.timeSavings.annualValueSaved)}</span>
          </div>
        </div>
      </div>

      {/* Win Rate Improvement */}
      <div className="space-y-4">
        <h4 className="font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-500" />
          Win Rate Improvement
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Win rate increase</span>
            <span className="font-medium">+{results.winRateImprovement.percentageIncrease}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">New win rate</span>
            <span className="font-medium">{results.winRateImprovement.newWinRate}%</span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="font-medium">Additional deals/month</span>
            <span className="font-bold text-green-500">{results.winRateImprovement.additionalDealsPerMonth}</span>
          </div>
        </div>
      </div>

      {/* Revenue Impact */}
      <div className="space-y-4">
        <h4 className="font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-purple-500" />
          Revenue Impact
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Additional monthly revenue</span>
            <span className="font-medium">{formatCurrency(results.revenueImpact.additionalMonthlyRevenue)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="font-medium">Annual revenue impact</span>
            <span className="font-bold text-purple-500">{formatCurrency(results.revenueImpact.annualRevenueImpact)}</span>
          </div>
        </div>
      </div>

      {/* Coaching Efficiency */}
      <div className="space-y-4">
        <h4 className="font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-amber-500" />
          Coaching Efficiency
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Manager hours freed/month</span>
            <span className="font-medium">{results.coachingEfficiency.managerHoursFreed}h</span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="font-medium">Coaching scalability</span>
            <span className="font-bold text-amber-500">{results.coachingEfficiency.scalabilityMultiplier}x</span>
          </div>
        </div>
      </div>
    </div>
  );
}
