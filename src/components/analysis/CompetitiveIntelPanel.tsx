import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Swords, 
  TrendingUp,
  TrendingDown,
  Minus,
  Copy,
  Check
} from 'lucide-react';
import type { StrategyAudit } from '@/utils/analysis-schemas';
import { cn } from '@/lib/utils';
import { useState } from 'react';

type CompetitorIntel = NonNullable<StrategyAudit['competitive_intel']>[number];

interface CompetitiveIntelPanelProps {
  data: CompetitorIntel[] | null | undefined;
}

function getThreatLevelStyles(level: 'High' | 'Medium' | 'Low') {
  switch (level) {
    case 'High':
      return 'bg-destructive text-destructive-foreground';
    case 'Medium':
      return 'bg-yellow-500 text-yellow-950';
    case 'Low':
      return 'bg-green-500 text-white';
  }
}

function getChurnRiskIcon(risk: 'High' | 'Medium' | 'Low') {
  switch (risk) {
    case 'High':
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'Medium':
      return <Minus className="h-4 w-4 text-yellow-500" />;
    case 'Low':
      return <TrendingDown className="h-4 w-4 text-destructive" />;
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
}

function CompetitorCard({ competitor }: CompetitorCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(competitor.silver_bullet_question);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 rounded-xl border bg-card space-y-4">
      {/* Header: Name + Status */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h4 className="font-bold text-lg">{competitor.competitor_name}</h4>
          <Badge 
            variant="outline" 
            className={cn("text-xs mt-1", getUsageStatusColor(competitor.usage_status))}
          >
            {competitor.usage_status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn("text-xs", getThreatLevelStyles(competitor.threat_level))}>
            {competitor.threat_level} Threat
          </Badge>
        </div>
      </div>

      {/* Churn Risk */}
      <div className="flex items-center gap-2 text-sm">
        {getChurnRiskIcon(competitor.churn_risk)}
        <span className="text-muted-foreground">Churn Likelihood:</span>
        <span className={cn(
          "font-medium",
          competitor.churn_risk === 'High' && "text-green-600 dark:text-green-400",
          competitor.churn_risk === 'Medium' && "text-yellow-600 dark:text-yellow-400",
          competitor.churn_risk === 'Low' && "text-destructive"
        )}>
          {competitor.churn_risk}
        </span>
      </div>

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

      {/* Silver Bullet Question */}
      <div 
        onClick={handleCopy}
        className={cn(
          "group relative p-3 rounded-lg cursor-pointer transition-all",
          "bg-primary/5 border border-primary/20 hover:border-primary/40 hover:bg-primary/10"
        )}
        title="Click to copy"
      >
        <div className="flex items-start gap-2">
          <span className="text-lg shrink-0">🎯</span>
          <div className="flex-1">
            <p className="text-xs font-medium text-primary mb-1">Trap-Setting Question</p>
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
  const highThreatCount = competitors.filter(c => c.threat_level === 'High').length;

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
          {highThreatCount > 0 && (
            <Badge variant="destructive">
              {highThreatCount} High Threat
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {competitors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Minus className="h-5 w-5 mb-2" />
            <p>No competitors detected in this call</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {competitors.map((comp, index) => (
              <CompetitorCard key={index} competitor={comp} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}