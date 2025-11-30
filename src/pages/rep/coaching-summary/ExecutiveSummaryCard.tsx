import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Sparkles, 
  BarChart3, 
  Flame, 
  Database, 
  History, 
  Zap, 
  Layers,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CoachingTrendAnalysis, AnalysisMetadata } from '@/api/aiCallAnalysis';

interface ExecutiveSummaryCardProps {
  analysis: CoachingTrendAnalysis;
  metadata: AnalysisMetadata | null;
  dataUpdatedAt: number | undefined;
  loadedAnalysis: CoachingTrendAnalysis | null;
}

function getTrendIcon(trend: 'improving' | 'declining' | 'stable') {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'declining':
      return <TrendingDown className="h-4 w-4 text-destructive" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

export function ExecutiveSummaryCard({
  analysis,
  metadata,
  dataUpdatedAt,
  loadedAnalysis,
}: ExecutiveSummaryCardProps) {
  return (
    <Card className="bg-gradient-to-br from-primary/5 via-background to-background border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Executive Summary
          </CardTitle>
          {dataUpdatedAt && !loadedAnalysis && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-xs gap-1">
                    <Database className="h-3 w-3" />
                    Cached
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Last updated: {format(new Date(dataUpdatedAt), 'MMM d, h:mm a')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {loadedAnalysis && (
            <Badge variant="secondary" className="text-xs gap-1">
              <History className="h-3 w-3" />
              From History
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-base leading-relaxed">{analysis.summary}</p>
        
        {/* Period Stats */}
        <div className="flex flex-wrap items-center gap-6 mt-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Calls Analyzed:</span>
            <span className="font-semibold">{analysis.periodAnalysis.totalCalls}</span>
          </div>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-muted-foreground">Avg Heat Score:</span>
            <span className="font-semibold">{analysis.periodAnalysis.averageHeatScore?.toFixed(1) || 'N/A'}/10</span>
            {getTrendIcon(analysis.periodAnalysis.heatScoreTrend)}
          </div>
        </div>
        
        {/* Analysis Metadata */}
        {metadata && (
          <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-dashed">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs gap-1",
                      metadata.tier === 'direct' && "border-green-500/50 text-green-600 bg-green-500/5",
                      metadata.tier === 'sampled' && "border-amber-500/50 text-amber-600 bg-amber-500/5",
                      metadata.tier === 'hierarchical' && "border-orange-500/50 text-orange-600 bg-orange-500/5"
                    )}
                  >
                    {metadata.tier === 'direct' && <Zap className="h-3 w-3" />}
                    {metadata.tier === 'sampled' && <Layers className="h-3 w-3" />}
                    {metadata.tier === 'hierarchical' && <Layers className="h-3 w-3" />}
                    {metadata.tier === 'direct' ? 'Direct Analysis' : 
                     metadata.tier === 'sampled' ? 'Smart Sampling' : 'Two-Stage Analysis'}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {metadata.tier === 'direct' && (
                    <p>All {metadata.totalCalls} calls were analyzed directly for optimal quality.</p>
                  )}
                  {metadata.tier === 'sampled' && (
                    <p>Used stratified sampling to analyze a representative subset of calls.</p>
                  )}
                  {metadata.tier === 'hierarchical' && (
                    <p>Used two-stage hierarchical analysis to process this large dataset comprehensively.</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {metadata.samplingInfo && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {metadata.samplingInfo.sampledCount}
                </span>
                <span>of</span>
                <span className="font-medium text-foreground">
                  {metadata.samplingInfo.originalCount}
                </span>
                <span>calls sampled</span>
              </div>
            )}
            
            {metadata.hierarchicalInfo && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-help">
                      <span className="font-medium text-foreground">
                        {metadata.hierarchicalInfo.chunksAnalyzed}
                      </span>
                      <span>chunks analyzed</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <div className="space-y-1">
                      <p className="font-medium">Calls per chunk:</p>
                      <div className="flex flex-wrap gap-1">
                        {metadata.hierarchicalInfo.callsPerChunk.map((count, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            Chunk {idx + 1}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
