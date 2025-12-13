import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle, Lightbulb, Target, Users, Calendar, Phone, Activity, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AccountHeatAnalysis {
  score: number;
  temperature: "Hot" | "Warm" | "Lukewarm" | "Cold";
  trend: "Heating Up" | "Cooling Down" | "Stagnant";
  confidence: "High" | "Medium" | "Low";
  momentum_narrative?: string;
  factors: {
    engagement: { score: number; weight: number; signals: string[] };
    relationship: { score: number; weight: number; signals: string[] };
    deal_progress: { score: number; weight: number; signals: string[] };
    call_quality: { score: number; weight: number; signals: string[] };
    timing: { score: number; weight: number; signals: string[] };
  };
  open_critical_gaps: { category: string; count?: number; evidence?: string }[];
  closed_gaps?: { category: string; how_resolved: string }[];
  competitors_active: string[];
  recommended_actions: string[];
  risk_factors: string[];
  calculated_at: string;
}

interface AccountHeatCardProps {
  prospectId: string;
  accountHeatScore: number | null;
  accountHeatAnalysis: AccountHeatAnalysis | null;
  accountHeatUpdatedAt: string | null;
  onRefresh?: () => void;
}

const factorIcons: Record<string, React.ReactNode> = {
  engagement: <Activity className="h-4 w-4" />,
  relationship: <Users className="h-4 w-4" />,
  deal_progress: <Target className="h-4 w-4" />,
  call_quality: <Phone className="h-4 w-4" />,
  timing: <Calendar className="h-4 w-4" />
};

const factorLabels: Record<string, string> = {
  engagement: "Engagement",
  relationship: "Relationship",
  deal_progress: "Deal Progress",
  call_quality: "Call Quality",
  timing: "Timing"
};

function getTemperatureColor(temp: string) {
  switch (temp) {
    case "Hot": return "bg-red-500 text-white";
    case "Warm": return "bg-orange-500 text-white";
    case "Lukewarm": return "bg-yellow-500 text-black";
    case "Cold": return "bg-blue-500 text-white";
    default: return "bg-muted text-muted-foreground";
  }
}

function getScoreColor(score: number) {
  if (score >= 70) return "text-red-600";
  if (score >= 50) return "text-orange-600";
  if (score >= 25) return "text-yellow-600";
  return "text-blue-600";
}

function getProgressColor(score: number) {
  if (score >= 70) return "bg-red-500";
  if (score >= 50) return "bg-orange-500";
  if (score >= 25) return "bg-yellow-500";
  return "bg-blue-500";
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case "Heating Up": return <TrendingUp className="h-4 w-4 text-green-600" />;
    case "Cooling Down": return <TrendingDown className="h-4 w-4 text-red-600" />;
    default: return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

export function AccountHeatCard({
  prospectId,
  accountHeatScore,
  accountHeatAnalysis,
  accountHeatUpdatedAt,
  onRefresh
}: AccountHeatCardProps) {
  const [isCalculating, setIsCalculating] = useState(false);

  const handleCalculate = async () => {
    setIsCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-account-heat', {
        body: { prospect_id: prospectId }
      });

      if (error) throw error;

      toast.success(`Account heat calculated: ${data.score} (${data.temperature})`);
      onRefresh?.();
    } catch (error) {
      console.error('Failed to calculate account heat:', error);
      toast.error('Failed to calculate account heat');
    } finally {
      setIsCalculating(false);
    }
  };

  // No data state
  if (!accountHeatAnalysis || accountHeatScore === null) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="h-5 w-5 text-orange-500" />
            Account Heat Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm mb-4">
              AI-powered analysis of all calls and account data to determine deal health and momentum.
            </p>
            <Button onClick={handleCalculate} disabled={isCalculating}>
              {isCalculating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing Calls...
                </>
              ) : (
                <>
                  <Flame className="h-4 w-4 mr-2" />
                  Calculate Account Heat
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const analysis = accountHeatAnalysis;
  const lastUpdated = accountHeatUpdatedAt 
    ? new Date(accountHeatUpdatedAt).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    : 'Unknown';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="h-5 w-5 text-orange-500" />
            Account Heat Score
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleCalculate}
            disabled={isCalculating}
            title="Recalculate"
          >
            <RefreshCw className={`h-4 w-4 ${isCalculating ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score display */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className={`text-4xl font-bold ${getScoreColor(accountHeatScore)}`}>
              {accountHeatScore}
            </div>
            <div className="text-xs text-muted-foreground">/ 100</div>
          </div>
          <div className="flex flex-col gap-1">
            <Badge className={getTemperatureColor(analysis.temperature)}>
              {analysis.temperature}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {getTrendIcon(analysis.trend)}
              <span>{analysis.trend}</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {analysis.confidence} confidence
            </Badge>
          </div>
        </div>

        {/* Momentum Narrative */}
        {analysis.momentum_narrative && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground italic">
            "{analysis.momentum_narrative}"
          </div>
        )}

        {/* Factor breakdown */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Factor Breakdown</h4>
          {Object.entries(analysis.factors).map(([key, factor]) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {factorIcons[key]}
                  <span>{factorLabels[key]}</span>
                  <span className="text-xs text-muted-foreground">({factor.weight}%)</span>
                </div>
                <span className={`font-medium ${getScoreColor(factor.score)}`}>
                  {factor.score}
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full transition-all ${getProgressColor(factor.score)}`}
                  style={{ width: `${factor.score}%` }}
                />
              </div>
              {factor.signals.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {factor.signals.slice(0, 2).join(' • ')}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Closed gaps (show success) */}
        {analysis.closed_gaps && analysis.closed_gaps.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Resolved Gaps
            </h4>
            <div className="space-y-1">
              {analysis.closed_gaps.map((gap, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium text-green-700">{gap.category}:</span>{' '}
                  <span className="text-muted-foreground">{gap.how_resolved}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Critical gaps */}
        {analysis.open_critical_gaps.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Open Critical Gaps
            </h4>
            <div className="space-y-2">
              {analysis.open_critical_gaps.map((gap, i) => (
                <div key={i} className="text-sm">
                  <Badge variant="outline" className="text-yellow-600 border-yellow-300 mr-2">
                    {gap.category}
                  </Badge>
                  {gap.evidence && (
                    <span className="text-muted-foreground text-xs">{gap.evidence}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk factors */}
        {analysis.risk_factors.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              Risk Factors
            </h4>
            <ul className="text-sm space-y-1">
              {analysis.risk_factors.map((risk, i) => (
                <li key={i} className="text-muted-foreground">• {risk}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommended actions */}
        {analysis.recommended_actions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-green-600">
              <Lightbulb className="h-4 w-4" />
              Recommended Actions
            </h4>
            <ul className="text-sm space-y-1">
              {analysis.recommended_actions.map((action, i) => (
                <li key={i} className="text-muted-foreground">• {action}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Competitors */}
        {analysis.competitors_active.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Active Competitors</h4>
            <div className="flex flex-wrap gap-2">
              {analysis.competitors_active.map((comp) => (
                <Badge key={comp} variant="secondary">{comp}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Last updated */}
        <p className="text-xs text-muted-foreground text-right">
          Last calculated: {lastUpdated}
        </p>
      </CardContent>
    </Card>
  );
}
