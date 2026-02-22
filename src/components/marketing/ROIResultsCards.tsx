import { Card, CardContent } from '@/components/ui/card';
import { Clock, TrendingUp, DollarSign, Zap } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/roiCalculations';

interface ROIResultsCardsProps {
  hoursSavedPerYear: number;
  winRateBoost: number;
  annualRevenue: number;
  roiPercentage: number;
}

export function ROIResultsCards({
  hoursSavedPerYear,
  winRateBoost,
  annualRevenue,
  roiPercentage,
}: ROIResultsCardsProps) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Hours Saved/Year</p>
              <p className="text-2xl font-bold">{formatNumber(hoursSavedPerYear)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Win Rate Boost</p>
              <p className="text-2xl font-bold">+{winRateBoost}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <DollarSign className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Annual Revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(annualRevenue)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Zap className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">ROI</p>
              <p className="text-2xl font-bold">{roiPercentage}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
