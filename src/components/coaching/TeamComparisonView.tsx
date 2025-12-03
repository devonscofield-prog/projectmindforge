import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { generateAggregateCoachingTrends, CoachingTrendAnalysis } from '@/api/aiCallAnalysis';
import { useDateRangeSelector } from '@/hooks/useDateRangeSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import {
  Building2,
  Loader2,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Flame,
  Target,
  MessageSquareQuote,
  Ear,
  BarChart3,
  X,
  CalendarIcon,
} from 'lucide-react';

interface TeamComparisonViewProps {
  dateRange: { from: Date; to: Date };
  onClose?: () => void;
}

interface TeamAnalysisResult {
  teamId: string;
  teamName: string;
  analysis: CoachingTrendAnalysis | null;
  loading: boolean;
  error: string | null;
}

export function TeamComparisonView({ dateRange, onClose }: TeamComparisonViewProps) {
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [teamAnalyses, setTeamAnalyses] = useState<Map<string, TeamAnalysisResult>>(new Map());
  const [isComparing, setIsComparing] = useState(false);
  
  // Local date range hook for independent control
  const {
    dateRange: localDateRange,
    selectedPreset,
    presets: TIME_PRESETS,
    handlePresetChange: onPresetChange,
    handleFromDateChange,
    handleToDateChange,
  } = useDateRangeSelector({
    initialPreset: '30',
    onChange: () => {
      if (teamAnalyses.size > 0) {
        setTeamAnalyses(new Map());
      }
    },
  });

  // Fetch all teams
  const { data: teams } = useQuery({
    queryKey: ['comparison-teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const handlePresetChange = (value: string) => {
    onPresetChange(value as any);
  };

  const handleAddTeam = (teamId: string) => {
    if (selectedTeams.length < 3 && !selectedTeams.includes(teamId)) {
      setSelectedTeams(prev => [...prev, teamId]);
    }
  };

  const handleRemoveTeam = (teamId: string) => {
    setSelectedTeams(prev => prev.filter(id => id !== teamId));
    setTeamAnalyses(prev => {
      const next = new Map(prev);
      next.delete(teamId);
      return next;
    });
  };

  const handleCompare = async () => {
    if (selectedTeams.length < 2) return;
    
    setIsComparing(true);
    
    // Initialize all teams as loading
    const initialResults = new Map<string, TeamAnalysisResult>();
    selectedTeams.forEach(teamId => {
      const team = teams?.find(t => t.id === teamId);
      initialResults.set(teamId, {
        teamId,
        teamName: team?.name ?? 'Unknown Team',
        analysis: null,
        loading: true,
        error: null,
      });
    });
    setTeamAnalyses(initialResults);

    // Fetch analyses in parallel using localDateRange
    await Promise.all(
      selectedTeams.map(async (teamId) => {
        try {
          const result = await generateAggregateCoachingTrends({
            scope: 'team',
            teamId,
            dateRange: localDateRange,
          });
          
          setTeamAnalyses(prev => {
            const next = new Map(prev);
            const existing = next.get(teamId);
            if (existing) {
              next.set(teamId, {
                ...existing,
                analysis: result.analysis,
                loading: false,
              });
            }
            return next;
          });
        } catch (error) {
          setTeamAnalyses(prev => {
            const next = new Map(prev);
            const existing = next.get(teamId);
            if (existing) {
              next.set(teamId, {
                ...existing,
                loading: false,
                error: error instanceof Error ? error.message : 'Analysis failed',
              });
            }
            return next;
          });
        }
      })
    );
    
    setIsComparing(false);
  };

  const getTrendIcon = (trend: 'improving' | 'declining' | 'stable') => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = (trend: 'improving' | 'declining' | 'stable') => {
    switch (trend) {
      case 'improving': return 'text-green-600';
      case 'declining': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const availableTeams = useMemo(() => 
    teams?.filter(t => !selectedTeams.includes(t.id)) || [],
    [teams, selectedTeams]
  );

  const resultsArray = useMemo(() => 
    Array.from(teamAnalyses.values()),
    [teamAnalyses]
  );

  const hasResults = resultsArray.some(r => r.analysis !== null);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" />
            Team Comparison
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Compare coaching trends between 2-3 teams side-by-side
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Time Period Selection */}
        <div className="p-3 bg-muted/50 rounded-lg space-y-3">
          <Label className="text-sm font-medium">Time Period</Label>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px]">
              <Select value={selectedPreset as string} onValueChange={(v) => handlePresetChange(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_PRESETS.map(preset => (
                    <SelectItem key={preset.value} value={preset.value as string}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Custom date pickers */}
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "justify-start text-left font-normal w-[130px]",
                      !localDateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(localDateRange.from, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={localDateRange.from}
                    onSelect={handleFromDateChange}
                    disabled={(date) => date > localDateRange.to || date > new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              
              <span className="text-sm text-muted-foreground">to</span>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "justify-start text-left font-normal w-[130px]",
                      !localDateRange.to && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(localDateRange.to, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={localDateRange.to}
                    onSelect={handleToDateChange}
                    disabled={(date) => date < localDateRange.from || date > new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Team Selection */}
        <div className="flex flex-wrap items-center gap-3">
          {selectedTeams.map((teamId, idx) => {
            const team = teams?.find(t => t.id === teamId);
            return (
              <div key={teamId} className="flex items-center gap-2">
                {idx > 0 && <span className="text-muted-foreground text-sm">vs</span>}
                <Badge variant="secondary" className="gap-1 pr-1">
                  <Building2 className="h-3 w-3" />
                  {team?.name ?? 'Unknown'}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-1 hover:bg-destructive/20"
                    onClick={() => handleRemoveTeam(teamId)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              </div>
            );
          })}
          
          {selectedTeams.length < 3 && availableTeams.length > 0 && (
            <Select onValueChange={handleAddTeam}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Add team..." />
              </SelectTrigger>
              <SelectContent>
                {availableTeams.map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Date range indicator */}
        <div className="text-xs text-muted-foreground">
          Comparing data from {format(localDateRange.from, 'MMM d, yyyy')} to {format(localDateRange.to, 'MMM d, yyyy')}
        </div>

        {/* Compare Button */}
        {selectedTeams.length >= 2 && !hasResults && (
          <Button 
            onClick={handleCompare} 
            disabled={isComparing}
            className="w-full"
          >
            {isComparing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing teams...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Compare {selectedTeams.length} Teams
              </>
            )}
          </Button>
        )}

        {/* Comparison Results */}
        {hasResults && (
          <div className="space-y-6 pt-4 border-t">
            {/* Summary Comparison */}
            <div className={cn(
              "grid gap-4",
              resultsArray.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"
            )}>
              {resultsArray.map(result => (
                <Card key={result.teamId} className={cn(
                  "border-2",
                  result.loading && "animate-pulse",
                  result.error && "border-destructive/50"
                )}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      {result.teamName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {result.loading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    ) : result.error ? (
                      <p className="text-sm text-destructive">{result.error}</p>
                    ) : result.analysis ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Flame className="h-4 w-4 text-orange-500" />
                            <span className="text-2xl font-bold">
                              {result.analysis.periodAnalysis.averageHeatScore?.toFixed(1) || 'N/A'}
                            </span>
                            <span className="text-sm text-muted-foreground">/10</span>
                          </div>
                          {getTrendIcon(result.analysis.periodAnalysis.heatScoreTrend)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <BarChart3 className="h-3 w-3" />
                          {result.analysis.periodAnalysis.totalCalls} calls
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Framework Comparison */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Framework Performance Comparison
              </h3>
              
              {/* MEDDPICC */}
              <ComparisonRow
                label="MEDDPICC Qualification"
                icon={<Target className="h-4 w-4 text-blue-500" />}
                results={resultsArray}
                getScore={(a) => a?.trendAnalysis.meddpicc?.endingAvg ?? a?.trendAnalysis.bant?.endingAvg}
                getTrend={(a) => a?.trendAnalysis.meddpicc?.trend ?? a?.trendAnalysis.bant?.trend}
                getTrendIcon={getTrendIcon}
                getTrendColor={getTrendColor}
              />
              
              {/* Gap Selling */}
              <ComparisonRow
                label="Gap Selling"
                icon={<MessageSquareQuote className="h-4 w-4 text-purple-500" />}
                results={resultsArray}
                getScore={(a) => a?.trendAnalysis.gapSelling.endingAvg}
                getTrend={(a) => a?.trendAnalysis.gapSelling.trend}
                getTrendIcon={getTrendIcon}
                getTrendColor={getTrendColor}
              />
              
              {/* Active Listening */}
              <ComparisonRow
                label="Active Listening"
                icon={<Ear className="h-4 w-4 text-teal-500" />}
                results={resultsArray}
                getScore={(a) => a?.trendAnalysis.activeListening.endingAvg}
                getTrend={(a) => a?.trendAnalysis.activeListening.trend}
                getTrendIcon={getTrendIcon}
                getTrendColor={getTrendColor}
              />
            </div>

            {/* Priority Summary */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Top Priority per Team</h3>
              <div className={cn(
                "grid gap-3",
                resultsArray.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"
              )}>
                {resultsArray.map(result => (
                  <div 
                    key={result.teamId}
                    className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg"
                  >
                    <div className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                      {result.teamName}
                    </div>
                    {result.analysis?.topPriorities[0] ? (
                      <>
                        <div className="text-sm font-medium text-amber-900 dark:text-amber-100">
                          {result.analysis.topPriorities[0].area}
                        </div>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 line-clamp-2">
                          {result.analysis.topPriorities[0].actionItem}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">No data</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Re-compare button */}
            <Button 
              variant="outline" 
              onClick={() => {
                setTeamAnalyses(new Map());
              }}
              className="w-full"
            >
              Adjust Teams & Re-compare
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper component for comparison rows
interface ComparisonRowProps {
  label: string;
  icon: React.ReactNode;
  results: TeamAnalysisResult[];
  getScore: (analysis: CoachingTrendAnalysis | null) => number | undefined | null;
  getTrend: (analysis: CoachingTrendAnalysis | null) => 'improving' | 'declining' | 'stable' | undefined;
  getTrendIcon: (trend: 'improving' | 'declining' | 'stable') => React.ReactNode;
  getTrendColor: (trend: 'improving' | 'declining' | 'stable') => string;
}

function ComparisonRow({ 
  label, 
  icon, 
  results, 
  getScore, 
  getTrend,
  getTrendIcon,
  getTrendColor,
}: ComparisonRowProps) {
  const scores = results.map(r => ({
    teamName: r.teamName,
    score: getScore(r.analysis),
    trend: getTrend(r.analysis),
    loading: r.loading,
  }));

  const validScores = scores.filter(s => s.score !== undefined && s.score !== null);
  const maxScore = validScores.length > 0 ? Math.max(...validScores.map(s => s.score as number)) : 0;

  return (
    <div className="py-3 border-b last:border-b-0">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className={cn(
        "grid gap-3",
        results.length === 2 ? "grid-cols-2" : "grid-cols-3"
      )}>
        {scores.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {item.loading ? (
                <Skeleton className="h-6 w-12" />
              ) : (
                <span className={cn(
                  "text-lg font-semibold",
                  item.score === maxScore && validScores.length > 1 && "text-primary"
                )}>
                  {item.score?.toFixed(1) || 'N/A'}
                </span>
              )}
              <span className="text-xs text-muted-foreground">/10</span>
            </div>
            {!item.loading && item.trend && (
              <div className={cn("flex items-center gap-1", getTrendColor(item.trend))}>
                {getTrendIcon(item.trend)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
