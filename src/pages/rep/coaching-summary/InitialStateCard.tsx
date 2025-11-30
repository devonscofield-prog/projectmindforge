import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, Zap, Layers, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisTier, DIRECT_ANALYSIS_MAX, SAMPLING_MAX } from '@/api/aiCallAnalysis';

interface InitialStateCardProps {
  callCountPreview: number | null | undefined;
  isLoadingCallCount: boolean;
  previewTier: AnalysisTier | null;
  onGenerate: () => void;
}

export function InitialStateCard({
  callCountPreview,
  isLoadingCallCount,
  previewTier,
  onGenerate,
}: InitialStateCardProps) {
  return (
    <Card className="border-dashed border-2">
      <CardContent className="py-12">
        <div className="flex flex-col items-center justify-center gap-6 max-w-lg mx-auto text-center">
          <div className="relative">
            <div className="p-4 bg-primary/10 rounded-full">
              <Sparkles className="h-12 w-12 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">AI-Powered Coaching Trends</h3>
            <p className="text-muted-foreground">
              Get personalized insights from your sales calls. Our AI will analyze your calls 
              to identify patterns, strengths, and areas for improvement.
            </p>
          </div>
          
          {/* Call Count Preview with Tier Badge */}
          <div className="flex flex-col items-center gap-2">
            {isLoadingCallCount ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Checking available calls...</span>
              </div>
            ) : callCountPreview !== null && callCountPreview !== undefined ? (
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  {callCountPreview} {callCountPreview === 1 ? 'call' : 'calls'} in period
                </Badge>
                
                {/* Tier indicator */}
                {previewTier && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs gap-1",
                            previewTier === 'direct' && "border-green-500/50 text-green-600 bg-green-500/5",
                            previewTier === 'sampled' && "border-amber-500/50 text-amber-600 bg-amber-500/5",
                            previewTier === 'hierarchical' && "border-orange-500/50 text-orange-600 bg-orange-500/5"
                          )}
                        >
                          {previewTier === 'direct' && <Zap className="h-3 w-3" />}
                          {previewTier === 'sampled' && <Layers className="h-3 w-3" />}
                          {previewTier === 'hierarchical' && <Layers className="h-3 w-3" />}
                          {previewTier === 'direct' ? 'Direct' : 
                           previewTier === 'sampled' ? 'Sampled' : 'Two-Stage'}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {previewTier === 'direct' && (
                          <p>All calls will be analyzed directly for optimal quality (≤{DIRECT_ANALYSIS_MAX} calls).</p>
                        )}
                        {previewTier === 'sampled' && (
                          <p>Stratified sampling will be used for efficient analysis ({DIRECT_ANALYSIS_MAX+1}-{SAMPLING_MAX} calls).</p>
                        )}
                        {previewTier === 'hierarchical' && (
                          <p>Very large dataset ({callCountPreview} calls). Analysis will use a two-stage hierarchical approach for comprehensive insights.</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            ) : null}
            
            <Button 
              size="lg" 
              onClick={onGenerate}
              className="mt-2"
              disabled={callCountPreview === 0}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Trends
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              {callCountPreview === 0 
                ? 'Submit calls to generate trends' 
                : previewTier === 'hierarchical' 
                  ? 'Two-stage analysis may take 1-2 minutes'
                  : 'Analysis takes 15-30 seconds'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
