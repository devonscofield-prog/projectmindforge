import { BarChart3, Target, MessageSquareQuote, Ear, Timer, GitBranch, MessageCircleWarning } from 'lucide-react';
import { TrendCard } from '@/components/coaching/TrendCard';
import { BehaviorTrendCard, createPatienceProps, createStrategicThreadingProps, createMonologueProps } from '@/components/coaching/BehaviorTrendCard';
import { CoachingTrendAnalysis, FrameworkTrend, PatienceTrend, StrategicThreadingTrend, MonologueTrend } from '@/api/aiCallAnalysis';

interface FrameworkTrendsSectionProps {
  analysis: CoachingTrendAnalysis;
}

// Default FrameworkTrend for backward compatibility when data is missing
const defaultTrend: FrameworkTrend = {
  trend: 'stable',
  startingAvg: 0,
  endingAvg: 0,
  keyInsight: 'No data available',
  evidence: [],
  recommendation: 'Submit more calls to generate insights',
};

// Default Analysis 2.0 trends
const defaultPatienceTrend: PatienceTrend = {
  trend: 'stable',
  startingAvg: 0,
  endingAvg: 0,
  avgInterruptions: 0,
  keyInsight: 'No patience data available',
  evidence: [],
  recommendation: 'Submit more calls to track patience trends',
};

const defaultStrategicThreadingTrend: StrategicThreadingTrend = {
  trend: 'stable',
  startingAvg: 0,
  endingAvg: 0,
  avgRelevanceRatio: 0,
  avgMissedOpportunities: 0,
  keyInsight: 'No strategic threading data available',
  evidence: [],
  recommendation: 'Submit more calls to track pain-to-pitch alignment',
};

const defaultMonologueTrend: MonologueTrend = {
  trend: 'stable',
  totalViolations: 0,
  avgPerCall: 0,
  avgLongestTurn: 0,
  keyInsight: 'No monologue data available',
  evidence: [],
  recommendation: 'Submit more calls to track talk time patterns',
};

export function FrameworkTrendsSection({ analysis }: FrameworkTrendsSectionProps) {
  // Use MEDDPICC as primary, fall back to BANT for legacy data, then default
  const primaryFramework = analysis.trendAnalysis.meddpicc ?? analysis.trendAnalysis.bant ?? defaultTrend;
  const primaryTitle = analysis.trendAnalysis.meddpicc ? 'MEDDPICC' : 'BANT';

  // Analysis 2.0 trends with defaults
  const patienceTrend = analysis.trendAnalysis.patience ?? defaultPatienceTrend;
  const strategicThreadingTrend = analysis.trendAnalysis.strategicThreading ?? defaultStrategicThreadingTrend;
  const monologueTrend = analysis.trendAnalysis.monologueViolations ?? defaultMonologueTrend;

  // Check if we have Analysis 2.0 data
  const hasAnalysis2Data = analysis.trendAnalysis.patience || analysis.trendAnalysis.strategicThreading || analysis.trendAnalysis.monologueViolations;

  return (
    <div className="space-y-6">
      {/* Analysis 2.0 Behavior Trends */}
      {hasAnalysis2Data && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Behavioral Trends
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <BehaviorTrendCard
              title="Patience"
              icon={<Timer className="h-4 w-4 text-blue-500" />}
              {...createPatienceProps(patienceTrend)}
            />
            <BehaviorTrendCard
              title="Strategic Threading"
              icon={<GitBranch className="h-4 w-4 text-purple-500" />}
              {...createStrategicThreadingProps(strategicThreadingTrend)}
            />
            <BehaviorTrendCard
              title="Monologue Discipline"
              icon={<MessageCircleWarning className="h-4 w-4 text-orange-500" />}
              {...createMonologueProps(monologueTrend)}
            />
          </div>
        </div>
      )}

      {/* Legacy Framework Trends */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Framework Trends
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <TrendCard
            title={primaryTitle}
            icon={<Target className="h-4 w-4 text-blue-500" />}
            trend={primaryFramework.trend}
            startingAvg={primaryFramework.startingAvg}
            endingAvg={primaryFramework.endingAvg}
            keyInsight={primaryFramework.keyInsight}
            evidence={primaryFramework.evidence}
            recommendation={primaryFramework.recommendation}
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
    </div>
  );
}
