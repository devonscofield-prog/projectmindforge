import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Swords, 
  Copy,
  Check,
  Quote,
  Target,
  Clock,
  Lightbulb,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type { StrategyAudit } from '@/utils/analysis-schemas';
import { cn } from '@/lib/utils';
import { useState } from 'react';

type CompetitorIntel = NonNullable<StrategyAudit['competitive_intel']>[number];

interface CompetitiveIntelPanelProps {
  data: CompetitorIntel[] | null | undefined;
}

function getCompetitivePositionStyles(position?: 'Winning' | 'Losing' | 'Neutral' | 'At Risk') {
  switch (position) {
    case 'Winning':
      return 'bg-green-500 text-white';
    case 'Losing':
      return 'bg-destructive text-destructive-foreground';
    case 'At Risk':
      return 'bg-yellow-500 text-yellow-950';
    case 'Neutral':
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getCompetitivePositionEmoji(position?: 'Winning' | 'Losing' | 'Neutral' | 'At Risk') {
  switch (position) {
    case 'Winning': return '✅';
    case 'Losing': return '❌';
    case 'At Risk': return '⚠️';
    case 'Neutral':
    default: return '➖';
  }
}

function getUsageStatusColor(status: string) {
  switch (status) {
    case 'Current Vendor':
      return 'bg-destructive/10 text-destructive border-destructive/30';
    case 'Past Vendor':
      return 'bg-muted text-muted-foreground border-muted-foreground/30';
    case 'Evaluating':
      return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30';
    case 'Mentioned':
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

interface CompetitorCardProps {
  competitor: CompetitorIntel;
  defaultExpanded?: boolean;
}

function CompetitorCard({ competitor, defaultExpanded = false }: CompetitorCardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(competitor.silver_bullet_question);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const position = competitor.competitive_position || 'Neutral';

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header - Always visible, clickable to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-start justify-between gap-3 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-bold text-lg">{competitor.competitor_name}</h4>
            <Badge 
              variant="outline" 
              className={cn("text-xs", getUsageStatusColor(competitor.usage_status))}
            >
              {competitor.usage_status}
            </Badge>
          </div>
          {/* Competitive Position - Primary indicator */}
          <div className="flex items-center gap-2 mt-2">
            <Badge className={cn("text-xs font-medium", getCompetitivePositionStyles(position))}>
              {getCompetitivePositionEmoji(position)} {position}
            </Badge>
          </div>
        </div>
        <div className="text-muted-foreground">
          {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t">
          {/* Evidence Quote */}
          {competitor.evidence_quote && (
            <div className="mt-4 p-3 rounded-lg bg-muted/50 border-l-4 border-primary">
              <div className="flex items-start gap-2">
                <Quote className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm italic text-muted-foreground">"{competitor.evidence_quote}"</p>
              </div>
            </div>
          )}

          {/* Positioning Strategy */}
          {competitor.positioning_strategy && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-primary mb-1">Positioning Strategy</p>
                  <p className="text-sm">{competitor.positioning_strategy}</p>
                </div>
              </div>
            </div>
          )}

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-2 gap-3">
            {/* Strengths */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Their Strengths</p>
              {competitor.strengths_mentioned.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">None mentioned</p>
              ) : (
                <ul className="space-y-1">
                  {competitor.strengths_mentioned.map((s, i) => (
                    <li key={i} className="text-sm flex items-start gap-1.5">
                      <span className="text-green-500 shrink-0">+</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Weaknesses */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Their Weaknesses</p>
              {competitor.weaknesses_mentioned.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">None mentioned</p>
              ) : (
                <ul className="space-y-1">
                  {competitor.weaknesses_mentioned.map((w, i) => (
                    <li key={i} className="text-sm flex items-start gap-1.5">
                      <span className="text-destructive shrink-0">−</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Silver Bullet Question with Timing */}
          <div 
            onClick={handleCopy}
            className={cn(
              "group relative p-3 rounded-lg cursor-pointer transition-all",
              "bg-amber-500/10 border border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/20"
            )}
            title="Click to copy"
          >
            <div className="flex items-start gap-2">
              <Target className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Trap-Setting Question</p>
                  {competitor.question_timing && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{competitor.question_timing}</span>
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium italic">"{competitor.silver_bullet_question}"</p>
              </div>
              <div className="flex items-center text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CompetitiveIntelPanel({ data }: CompetitiveIntelPanelProps) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5" />
            Competitive Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const competitors = Array.isArray(data) ? data : [];
  
  // Sort: Losing/At Risk first, then by usage status priority
  const sortedCompetitors = [...competitors].sort((a, b) => {
    const positionPriority = { 'Losing': 0, 'At Risk': 1, 'Neutral': 2, 'Winning': 3 };
    const aPos = positionPriority[a.competitive_position || 'Neutral'] ?? 2;
    const bPos = positionPriority[b.competitive_position || 'Neutral'] ?? 2;
    return aPos - bPos;
  });

  const threatenedCount = competitors.filter(c => 
    c.competitive_position === 'Losing' || c.competitive_position === 'At Risk'
  ).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5" />
              🕵️ Competitive Intelligence
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Competitors mentioned and de-positioning tactics
            </p>
          </div>
          {threatenedCount > 0 && (
            <Badge variant="destructive">
              {threatenedCount} Threatening
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {sortedCompetitors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Swords className="h-5 w-5 mb-2 opacity-50" />
            <p>No competitors detected in this call</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedCompetitors.map((comp, index) => (
              <CompetitorCard 
                key={index} 
                competitor={comp} 
                defaultExpanded={index === 0 && (comp.competitive_position === 'Losing' || comp.competitive_position === 'At Risk')}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}