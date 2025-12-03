import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, AlertTriangle, Sparkles, Ear, Flame, 
  ChevronDown, ChevronRight, Target 
} from 'lucide-react';
import { listRecentAiAnalysisForRep, CallAnalysis, MEDDPICCScores } from '@/api/aiCallAnalysis';
import { cn } from '@/lib/utils';

interface AICoachingSnapshotProps {
  repId: string;
}

interface CoachAverages {
  meddpicc: {
    overall: number | null;
    metrics: number | null;
    economicBuyer: number | null;
    decisionCriteria: number | null;
    decisionProcess: number | null;
    paperProcess: number | null;
    identifyPain: number | null;
    champion: number | null;
    competition: number | null;
  };
  gapSelling: number | null;
  activeListening: number | null;
  heatSignature: number | null;
  callCount: number;
}

const MEDDPICC_LABELS: Record<string, { label: string; description: string }> = {
  metrics: { label: 'Metrics', description: 'Quantifiable business outcomes' },
  economic_buyer: { label: 'Economic Buyer', description: 'Budget authority identified' },
  decision_criteria: { label: 'Decision Criteria', description: 'Evaluation requirements' },
  decision_process: { label: 'Decision Process', description: 'Buying process mapped' },
  paper_process: { label: 'Paper Process', description: 'Contract/legal process' },
  identify_pain: { label: 'Identify Pain', description: 'Business pains uncovered' },
  champion: { label: 'Champion', description: 'Internal advocate' },
  competition: { label: 'Competition', description: 'Alternatives understood' },
};

function computeCoachAverages(analyses: CallAnalysis[]): CoachAverages {
  const analysesWithCoach = analyses.filter(a => a.coach_output);
  
  if (analysesWithCoach.length === 0) {
    return {
      meddpicc: {
        overall: null,
        metrics: null,
        economicBuyer: null,
        decisionCriteria: null,
        decisionProcess: null,
        paperProcess: null,
        identifyPain: null,
        champion: null,
        competition: null,
      },
      gapSelling: null,
      activeListening: null,
      heatSignature: null,
      callCount: 0,
    };
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  // Extract MEDDPICC scores
  const meddpiccData = analysesWithCoach
    .map(a => a.coach_output?.framework_scores?.meddpicc)
    .filter((m): m is MEDDPICCScores => !!m);

  const meddpiccOverall = avg(meddpiccData.map(m => m.overall_score).filter((v): v is number => typeof v === 'number'));
  const meddpiccMetrics = avg(meddpiccData.map(m => m.metrics?.score).filter((v): v is number => typeof v === 'number'));
  const meddpiccEconomicBuyer = avg(meddpiccData.map(m => m.economic_buyer?.score).filter((v): v is number => typeof v === 'number'));
  const meddpiccDecisionCriteria = avg(meddpiccData.map(m => m.decision_criteria?.score).filter((v): v is number => typeof v === 'number'));
  const meddpiccDecisionProcess = avg(meddpiccData.map(m => m.decision_process?.score).filter((v): v is number => typeof v === 'number'));
  const meddpiccPaperProcess = avg(meddpiccData.map(m => m.paper_process?.score).filter((v): v is number => typeof v === 'number'));
  const meddpiccIdentifyPain = avg(meddpiccData.map(m => m.identify_pain?.score).filter((v): v is number => typeof v === 'number'));
  const meddpiccChampion = avg(meddpiccData.map(m => m.champion?.score).filter((v): v is number => typeof v === 'number'));
  const meddpiccCompetition = avg(meddpiccData.map(m => m.competition?.score).filter((v): v is number => typeof v === 'number'));

  const gapSellingScores = analysesWithCoach
    .map(a => a.coach_output?.framework_scores?.gap_selling?.score)
    .filter((v): v is number => typeof v === 'number');
  
  const activeListeningScores = analysesWithCoach
    .map(a => a.coach_output?.framework_scores?.active_listening?.score)
    .filter((v): v is number => typeof v === 'number');
  
  const heatScores = analysesWithCoach
    .map(a => a.coach_output?.heat_signature?.score)
    .filter((v): v is number => typeof v === 'number');

  return {
    meddpicc: {
      overall: meddpiccOverall,
      metrics: meddpiccMetrics,
      economicBuyer: meddpiccEconomicBuyer,
      decisionCriteria: meddpiccDecisionCriteria,
      decisionProcess: meddpiccDecisionProcess,
      paperProcess: meddpiccPaperProcess,
      identifyPain: meddpiccIdentifyPain,
      champion: meddpiccChampion,
      competition: meddpiccCompetition,
    },
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

  const phraseCounts = new Map<string, number>();
  gapPhrases.forEach(phrase => {
    phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
  });

  return Array.from(phraseCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([phrase]) => phrase);
}

function ScoreBar({ label, value, compact = false }: { label: string; value: number | null; compact?: boolean }) {
  if (value === null) return null;
  
  const getColorClass = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className={cn("space-y-1", compact && "space-y-0.5")}>
      <div className={cn("flex justify-between", compact ? "text-[10px]" : "text-xs")}>
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{Math.round(value)}</span>
      </div>
      <div className={cn("bg-muted rounded-full overflow-hidden", compact ? "h-1.5" : "h-2")}>
        <div 
          className={`h-full rounded-full transition-all ${getColorClass(value)}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

function MEDDPICCBreakdown({ coachAverages }: { coachAverages: CoachAverages }) {
  const [expanded, setExpanded] = useState(false);
  
  const elements = [
    { key: 'metrics', value: coachAverages.meddpicc.metrics },
    { key: 'economic_buyer', value: coachAverages.meddpicc.economicBuyer },
    { key: 'decision_criteria', value: coachAverages.meddpicc.decisionCriteria },
    { key: 'decision_process', value: coachAverages.meddpicc.decisionProcess },
    { key: 'paper_process', value: coachAverages.meddpicc.paperProcess },
    { key: 'identify_pain', value: coachAverages.meddpicc.identifyPain },
    { key: 'champion', value: coachAverages.meddpicc.champion },
    { key: 'competition', value: coachAverages.meddpicc.competition },
  ];

  const hasData = elements.some(e => e.value !== null);

  if (!hasData) return null;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span>Element Breakdown</span>
      </button>
      
      {expanded && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pl-4 pt-1">
          {elements.map(({ key, value }) => (
            <ScoreBar 
              key={key} 
              label={MEDDPICC_LABELS[key].label} 
              value={value} 
              compact 
            />
          ))}
        </div>
      )}
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
      <CardContent>
        <div className="flex items-center justify-center h-24">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </CardContent>
    );
  }

  if (analyses.length === 0) {
    return (
      <CardContent>
        <p className="text-sm text-muted-foreground text-center py-4">
          No AI call analyses yet for this rep.
        </p>
      </CardContent>
    );
  }

  const coachAverages = computeCoachAverages(analyses);
  const topSkills = getTopSkillTags(analyses);
  const topGaps = getTopDealGaps(analyses);
  const hasCoachData = coachAverages.callCount > 0;

  return (
    <>
      <CardDescription className="px-6 pb-2">
        Based on {analyses.length} recent call{analyses.length !== 1 ? 's' : ''}
      </CardDescription>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
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

        {/* AI Coach Framework Scores */}
        {hasCoachData && (
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium flex items-center gap-1.5 mb-4">
              <Flame className="h-4 w-4 text-orange-500" />
              Framework Scores (Last {coachAverages.callCount} Call{coachAverages.callCount !== 1 ? 's' : ''})
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* MEDDPICC */}
              <div className="col-span-2 p-3 bg-muted rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-medium">MEDDPICC</span>
                  </div>
                  <span className="text-lg font-bold">
                    {coachAverages.meddpicc.overall !== null ? Math.round(coachAverages.meddpicc.overall) : '-'}
                  </span>
                </div>
                <MEDDPICCBreakdown coachAverages={coachAverages} />
              </div>

              {/* Gap Selling */}
              <div className="text-center p-3 bg-muted rounded-lg">
                <TrendingUp className="h-4 w-4 mx-auto mb-1 text-green-500" />
                <div className="text-lg font-bold">
                  {coachAverages.gapSelling !== null ? Math.round(coachAverages.gapSelling) : '-'}
                </div>
                <div className="text-xs text-muted-foreground">Gap Selling</div>
              </div>

              {/* Active Listening */}
              <div className="text-center p-3 bg-muted rounded-lg">
                <Ear className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                <div className="text-lg font-bold">
                  {coachAverages.activeListening !== null ? Math.round(coachAverages.activeListening) : '-'}
                </div>
                <div className="text-xs text-muted-foreground">Active Listening</div>
              </div>
            </div>

            {/* Heat Signature - separate row for emphasis */}
            <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                <span className="text-sm font-medium">Average Heat Score</span>
              </div>
              <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                {coachAverages.heatSignature !== null ? coachAverages.heatSignature.toFixed(1) : '-'}
                <span className="text-xs font-normal text-muted-foreground ml-1">/10</span>
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </>
  );
}
