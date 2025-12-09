import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Flame, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Plus,
  Loader2,
  AlertTriangle,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DealHeat } from '@/utils/analysis-schemas';
import type { BehaviorScore, StrategyAudit, CallMetadata } from '@/utils/analysis-schemas';

interface DealHeatCardProps {
  transcript: string;
  strategyData: StrategyAudit | null;
  behaviorData: BehaviorScore | null;
  metadataData: CallMetadata | null;
  existingHeatData?: DealHeat | null;
  callId: string;
  onHeatCalculated?: (heat: DealHeat) => void;
}

export function DealHeatCard({
  transcript,
  strategyData,
  behaviorData,
  metadataData,
  existingHeatData,
  callId,
  onHeatCalculated,
}: DealHeatCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCalculating, setIsCalculating] = useState(false);
  const [heatData, setHeatData] = useState<DealHeat | null>(existingHeatData || null);

  // Sync local state with prop changes (e.g., after tab switch remount)
  useEffect(() => {
    if (existingHeatData) {
      setHeatData(existingHeatData);
    }
  }, [existingHeatData]);

  const handleCalculateHeat = async () => {
    if (!strategyData || !behaviorData) {
      toast({
        title: 'Missing Analysis Data',
        description: 'Strategy and behavior analysis must be completed first.',
        variant: 'destructive',
      });
      return;
    }

    setIsCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-deal-heat', {
        body: {
          transcript,
          strategy_data: strategyData,
          behavior_data: behaviorData,
          metadata: metadataData,
          call_id: callId,
        },
      });

      if (error) throw error;

      // Extract deal_heat from response
      const result = data.deal_heat as DealHeat;
      const wasSaved = data.saved === true;
      
      setHeatData(result);
      onHeatCalculated?.(result);

      // Invalidate query cache to reflect persisted data
      queryClient.invalidateQueries({ queryKey: ['call-with-analysis', callId] });

      toast({
        title: wasSaved ? 'Deal Heat Calculated & Saved' : 'Deal Heat Calculated',
        description: wasSaved 
          ? `Score: ${result.heat_score}/100 (${result.temperature})`
          : `Score: ${result.heat_score}/100 - Note: Save failed, please recalculate`,
        variant: wasSaved ? 'default' : 'destructive',
      });
    } catch (err) {
      console.error('Error calculating deal heat:', err);
      toast({
        title: 'Calculation Failed',
        description: err instanceof Error ? err.message : 'Failed to calculate deal heat',
        variant: 'destructive',
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 71) return 'text-green-500';
    if (score >= 41) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 71) return 'bg-green-500';
    if (score >= 41) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTemperatureBadgeVariant = (temp: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (temp) {
      case 'Hot': return 'default';
      case 'Warm': return 'secondary';
      case 'Lukewarm': return 'outline';
      case 'Cold': return 'destructive';
      default: return 'outline';
    }
  };

  const TrendIcon = ({ trend }: { trend: string }) => {
    switch (trend) {
      case 'Heating Up':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'Cooling Down':
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      default:
        return <Minus className="h-5 w-5 text-muted-foreground" />;
    }
  };

  // Initial state - show calculate button
  if (!heatData) {
    return (
      <Card className="border-dashed border-2 border-muted-foreground/25 hover:border-primary/50 transition-colors">
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Flame className="h-8 w-8" />
              <span className="text-lg font-medium">Deal Heat Analysis</span>
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Calculate the probability of this deal closing based on conversation signals.
            </p>
            <Button 
              size="lg" 
              onClick={handleCalculateHeat} 
              disabled={isCalculating}
              className="gap-2"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Crunching the numbers...
                </>
              ) : (
                <>
                  <Flame className="h-5 w-5" />
                  Calculate Deal Heat
                </>
              )}
            </Button>
            {!isCalculating && (
              <p className="text-xs text-muted-foreground">Takes about 5-10 seconds</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Result state - show gauge and factors
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Flame className="h-5 w-5 text-orange-500" />
          Deal Heat Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score Gauge */}
        <div className="flex flex-col items-center gap-4">
          {/* Semi-circle gauge */}
          <div className="relative w-48 h-24 overflow-hidden">
            <svg viewBox="0 0 200 100" className="w-full h-full">
              {/* Background arc */}
              <path
                d="M 10 100 A 90 90 0 0 1 190 100"
                fill="none"
                stroke="currentColor"
                strokeWidth="16"
                className="text-muted/20"
                strokeLinecap="round"
              />
              {/* Progress arc */}
              <path
                d="M 10 100 A 90 90 0 0 1 190 100"
                fill="none"
                stroke="currentColor"
                strokeWidth="16"
                className={getScoreColor(heatData.heat_score)}
                strokeLinecap="round"
                strokeDasharray={`${(heatData.heat_score / 100) * 283} 283`}
              />
            </svg>
            {/* Score text */}
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
              <span className={cn("text-4xl font-bold", getScoreColor(heatData.heat_score))}>
                {heatData.heat_score}
              </span>
            </div>
          </div>

          {/* Temperature & Trend */}
          <div className="flex items-center gap-4">
            <Badge 
              variant={getTemperatureBadgeVariant(heatData.temperature)}
              className="text-sm px-3 py-1"
            >
              {heatData.temperature}
            </Badge>
            <div className="flex items-center gap-1 text-sm">
              <TrendIcon trend={heatData.trend} />
              <span className="text-muted-foreground">{heatData.trend}</span>
            </div>
          </div>

          {/* Win Probability */}
          <div className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Win Probability:</span>
            <span className="font-medium">{heatData.winning_probability}</span>
          </div>
        </div>

        {/* Key Factors */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Key Factors</h4>
          <div className="space-y-2">
            {heatData.key_factors.map((factor, index) => (
              <div 
                key={index}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border",
                  factor.impact === 'Positive' 
                    ? "bg-green-500/5 border-green-500/20" 
                    : "bg-red-500/5 border-red-500/20"
                )}
              >
                <div className={cn(
                  "mt-0.5 flex-shrink-0 rounded-full p-1",
                  factor.impact === 'Positive' ? "bg-green-500/20" : "bg-red-500/20"
                )}>
                  {factor.impact === 'Positive' ? (
                    <Plus className="h-3 w-3 text-green-600" />
                  ) : (
                    <Minus className="h-3 w-3 text-red-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium",
                    factor.impact === 'Positive' ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                  )}>
                    {factor.factor}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{factor.reasoning}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendation Banner */}
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-primary">Recommended Action</p>
              <p className="text-sm text-foreground mt-1">{heatData.recommended_action}</p>
            </div>
          </div>
        </div>

        {/* Recalculate button */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleCalculateHeat}
          disabled={isCalculating}
          className="w-full"
        >
          {isCalculating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Recalculating...
            </>
          ) : (
            'Recalculate Heat'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
