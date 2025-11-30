import { BarChart3, Target, MessageSquareQuote, Ear } from 'lucide-react';
import { TrendCard } from '@/components/coaching/TrendCard';
import { CoachingTrendAnalysis } from '@/api/aiCallAnalysis';

interface FrameworkTrendsSectionProps {
  analysis: CoachingTrendAnalysis;
}

export function FrameworkTrendsSection({ analysis }: FrameworkTrendsSectionProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        Framework Trends
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <TrendCard
          title="BANT"
          icon={<Target className="h-4 w-4 text-blue-500" />}
          trend={analysis.trendAnalysis.bant.trend}
          startingAvg={analysis.trendAnalysis.bant.startingAvg}
          endingAvg={analysis.trendAnalysis.bant.endingAvg}
          keyInsight={analysis.trendAnalysis.bant.keyInsight}
          evidence={analysis.trendAnalysis.bant.evidence}
          recommendation={analysis.trendAnalysis.bant.recommendation}
        />
        <TrendCard
          title="Gap Selling"
          icon={<MessageSquareQuote className="h-4 w-4 text-purple-500" />}
          trend={analysis.trendAnalysis.gapSelling.trend}
          startingAvg={analysis.trendAnalysis.gapSelling.startingAvg}
          endingAvg={analysis.trendAnalysis.gapSelling.endingAvg}
          keyInsight={analysis.trendAnalysis.gapSelling.keyInsight}
          evidence={analysis.trendAnalysis.gapSelling.evidence}
          recommendation={analysis.trendAnalysis.gapSelling.recommendation}
        />
        <TrendCard
          title="Active Listening"
          icon={<Ear className="h-4 w-4 text-teal-500" />}
          trend={analysis.trendAnalysis.activeListening.trend}
          startingAvg={analysis.trendAnalysis.activeListening.startingAvg}
          endingAvg={analysis.trendAnalysis.activeListening.endingAvg}
          keyInsight={analysis.trendAnalysis.activeListening.keyInsight}
          evidence={analysis.trendAnalysis.activeListening.evidence}
          recommendation={analysis.trendAnalysis.activeListening.recommendation}
        />
      </div>
    </div>
  );
}
