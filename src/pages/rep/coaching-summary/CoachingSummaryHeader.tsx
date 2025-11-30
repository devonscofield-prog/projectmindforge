import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, GitCompare, RefreshCw, History, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CoachingTrendAnalysis } from '@/api/aiCallAnalysis';

interface CoachingSummaryHeaderProps {
  isOwnSummary: boolean;
  repName?: string;
  generateRequested: boolean;
  loadedAnalysis: CoachingTrendAnalysis | null;
  displayAnalysis: CoachingTrendAnalysis | null;
  isComparisonMode: boolean;
  isAnyFetching: boolean;
  onComparisonToggle: (checked: boolean) => void;
  onRefresh: () => void;
  onShowHistory: () => void;
  onShowExport: () => void;
}

export function CoachingSummaryHeader({
  isOwnSummary,
  repName,
  generateRequested,
  loadedAnalysis,
  displayAnalysis,
  isComparisonMode,
  isAnyFetching,
  onComparisonToggle,
  onRefresh,
  onShowHistory,
  onShowExport,
}: CoachingSummaryHeaderProps) {
  const showActions = generateRequested || loadedAnalysis;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          {isOwnSummary ? 'My Coaching Trends' : `${repName || 'Rep'}'s Coaching Trends`}
        </h1>
        <p className="text-muted-foreground">
          AI-powered trend analysis of your sales calls
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        {showActions && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
            <GitCompare className="h-4 w-4 text-muted-foreground" />
            <Switch 
              id="comparison-mode"
              checked={isComparisonMode} 
              onCheckedChange={onComparisonToggle}
            />
            <Label htmlFor="comparison-mode" className="text-sm cursor-pointer">
              Compare Periods
            </Label>
          </div>
        )}
        
        {showActions && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onRefresh}
                  disabled={isAnyFetching}
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", isAnyFetching && "animate-spin")} />
                  Refresh
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Force refresh bypasses cache</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={onShowHistory}
        >
          <History className="h-4 w-4 mr-2" />
          History
        </Button>
        
        {displayAnalysis && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={onShowExport}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </div>
    </div>
  );
}
