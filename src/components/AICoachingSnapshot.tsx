import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Brain, TrendingUp, AlertTriangle, Sparkles, Target, Ear, Flame } from 'lucide-react';
import { listRecentAiAnalysisForRep, CallAnalysis } from '@/api/aiCallAnalysis';

interface AICoachingSnapshotProps {
  repId: string;
}

interface AverageScores {
  discovery: number | null;
  objectionHandling: number | null;
  rapportCommunication: number | null;
  productKnowledge: number | null;
  dealAdvancement: number | null;
  callEffectiveness: number | null;
}

interface CoachAverages {
  bant: number | null;
  gapSelling: number | null;
  activeListening: number | null;
  heatSignature: number | null;
  callCount: number;
}

function computeAverages(analyses: CallAnalysis[]): AverageScores {
  if (analyses.length === 0) {
    return {
      discovery: null,
      objectionHandling: null,
      rapportCommunication: null,
      productKnowledge: null,
      dealAdvancement: null,
      callEffectiveness: null,
    };
  }

  const sum = (key: keyof CallAnalysis) => {
    const values = analyses.map(a => a[key]).filter((v): v is number => typeof v === 'number');
    return values.length > 0 ? values.reduce((acc, v) => acc + v, 0) / values.length : null;
  };

  return {
    discovery: sum('discovery_score'),
    objectionHandling: sum('objection_handling_score'),
    rapportCommunication: sum('rapport_communication_score'),
    productKnowledge: sum('product_knowledge_score'),
    dealAdvancement: sum('deal_advancement_score'),
    callEffectiveness: sum('call_effectiveness_score'),
  };
}

function computeCoachAverages(analyses: CallAnalysis[]): CoachAverages {
  const analysesWithCoach = analyses.filter(a => a.coach_output);
  
  if (analysesWithCoach.length === 0) {
    return {
      bant: null,
      gapSelling: null,
      activeListening: null,
      heatSignature: null,
      callCount: 0,
    };
  }

  const bantScores = analysesWithCoach
    .map(a => a.coach_output?.framework_scores?.bant?.score)
    .filter((v): v is number => typeof v === 'number');
  
  const gapSellingScores = analysesWithCoach
    .map(a => a.coach_output?.framework_scores?.gap_selling?.score)
    .filter((v): v is number => typeof v === 'number');
  
  const activeListeningScores = analysesWithCoach
    .map(a => a.coach_output?.framework_scores?.active_listening?.score)
    .filter((v): v is number => typeof v === 'number');
  
  const heatScores = analysesWithCoach
    .map(a => a.coach_output?.heat_signature?.score)
    .filter((v): v is number => typeof v === 'number');

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  return {
    bant: avg(bantScores),
    gapSelling: avg(gapSellingScores),
    activeListening: avg(activeListeningScores),
    heatSignature: avg(heatScores),
    callCount: analysesWithCoach.length,
  };
}

function getTopSkillTags(analyses: CallAnalysis[], limit: number = 3): string[] {
  const tagCounts = new Map<string, number>();
  
  analyses.forEach(analysis => {
    if (analysis.skill_tags) {
      analysis.skill_tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    }
  });

  return Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

function getTopDealGaps(analyses: CallAnalysis[], limit: number = 2): string[] {
  const gapPhrases: string[] = [];

  analyses.forEach(analysis => {
    if (analysis.deal_gaps && typeof analysis.deal_gaps === 'object') {
      const gaps = analysis.deal_gaps as Record<string, unknown>;
      
      // Extract from critical_missing_info
      if (Array.isArray(gaps.critical_missing_info)) {
        gaps.critical_missing_info.forEach((item: unknown) => {
          if (typeof item === 'string') {
            gapPhrases.push(item);
          } else if (typeof item === 'object' && item !== null) {
            const obj = item as Record<string, unknown>;
            if (typeof obj.info === 'string') gapPhrases.push(obj.info);
            else if (typeof obj.description === 'string') gapPhrases.push(obj.description);
          }
        });
      }
      
      // Extract from unresolved_objections
      if (Array.isArray(gaps.unresolved_objections)) {
        gaps.unresolved_objections.forEach((item: unknown) => {
          if (typeof item === 'string') {
            gapPhrases.push(item);
          } else if (typeof item === 'object' && item !== null) {
            const obj = item as Record<string, unknown>;
            if (typeof obj.objection === 'string') gapPhrases.push(obj.objection);
            else if (typeof obj.description === 'string') gapPhrases.push(obj.description);
          }
        });
      }
    }
  });

  // Count frequency and return top phrases
  const phraseCounts = new Map<string, number>();
  gapPhrases.forEach(phrase => {
    phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
  });

  return Array.from(phraseCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([phrase]) => phrase);
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  
  const getColorClass = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{Math.round(value)}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${getColorClass(value)}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function AICoachingSnapshot({ repId }: AICoachingSnapshotProps) {
  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ['ai-snapshot', repId],
    queryFn: () => listRecentAiAnalysisForRep(repId, 5),
    enabled: !!repId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Coaching Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-24">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (analyses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Coaching Snapshot
          </CardTitle>
          <CardDescription>
            Summary of recent AI call analyses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No AI call analyses yet for this rep. Run an analysis from the Call Coaching (AI) tab.
          </p>
        </CardContent>
      </Card>
    );
  }

  const averages = computeAverages(analyses);
  const coachAverages = computeCoachAverages(analyses);
  const topSkills = getTopSkillTags(analyses);
  const topGaps = getTopDealGaps(analyses);

  const scoreData = [
    { label: 'Discovery', value: averages.discovery },
    { label: 'Objection Handling', value: averages.objectionHandling },
    { label: 'Rapport', value: averages.rapportCommunication },
    { label: 'Product Knowledge', value: averages.productKnowledge },
    { label: 'Deal Advancement', value: averages.dealAdvancement },
    { label: 'Effectiveness', value: averages.callEffectiveness },
  ].filter(s => s.value !== null);

  const hasCoachData = coachAverages.callCount > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          AI Coaching Snapshot
        </CardTitle>
        <CardDescription>
          Based on {analyses.length} recent call{analyses.length !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Average Scores */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Average Scores
            </h4>
            <div className="space-y-2">
              {scoreData.map(({ label, value }) => (
                <ScoreBar key={label} label={label} value={value} />
              ))}
            </div>
          </div>

          {/* Common Strengths / Skills */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              Common Strengths
            </h4>
            {topSkills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {topSkills.map((skill, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No skill tags identified yet</p>
            )}
          </div>

          {/* Common Gaps */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Common Gaps
            </h4>
            {topGaps.length > 0 ? (
              <ul className="space-y-1.5">
                {topGaps.map((gap, idx) => (
                  <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-amber-500 mt-0.5">•</span>
                    <span className="line-clamp-2">{gap}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No deal gaps identified</p>
            )}
          </div>
        </div>

        {/* AI Coach Insights Section */}
        {hasCoachData && (
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium flex items-center gap-1.5 mb-4">
              <Flame className="h-4 w-4 text-orange-500" />
              AI Coach Insights (Last {coachAverages.callCount} Call{coachAverages.callCount !== 1 ? 's' : ''})
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* BANT */}
              <div className="text-center p-3 bg-muted rounded-lg">
                <Target className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                <div className="text-lg font-bold">
                  {coachAverages.bant !== null ? Math.round(coachAverages.bant) : '-'}
                </div>
                <div className="text-xs text-muted-foreground">Avg BANT</div>
              </div>

              {/* Gap Selling */}
              <div className="text-center p-3 bg-muted rounded-lg">
                <TrendingUp className="h-4 w-4 mx-auto mb-1 text-green-500" />
                <div className="text-lg font-bold">
                  {coachAverages.gapSelling !== null ? Math.round(coachAverages.gapSelling) : '-'}
                </div>
                <div className="text-xs text-muted-foreground">Avg Gap Selling</div>
              </div>

              {/* Active Listening */}
              <div className="text-center p-3 bg-muted rounded-lg">
                <Ear className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                <div className="text-lg font-bold">
                  {coachAverages.activeListening !== null ? Math.round(coachAverages.activeListening) : '-'}
                </div>
                <div className="text-xs text-muted-foreground">Avg Listening</div>
              </div>

              {/* Heat Signature */}
              <div className="text-center p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <Flame className="h-4 w-4 mx-auto mb-1 text-orange-500" />
                <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                  {coachAverages.heatSignature !== null ? coachAverages.heatSignature.toFixed(1) : '-'}
                </div>
                <div className="text-xs text-muted-foreground">Avg Heat (1-10)</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
