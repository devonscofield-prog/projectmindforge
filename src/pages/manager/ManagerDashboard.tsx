import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Profile, CoachingSession } from '@/types/database';
import { Users, TrendingUp, AlertTriangle, Brain, Phone } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { getLatestAiAnalysisForReps, getCallCountsLast30DaysForReps, CallAnalysis } from '@/api/aiCallAnalysis';

interface RepWithData extends Profile {
  lastCoaching?: CoachingSession;
}

interface RepWithRisk extends RepWithData {
  riskStatus: string;
  isAtRisk: boolean;
  latestAiAnalysis?: CallAnalysis | null;
  hasAiGaps: boolean;
  callsLast30Days: number;
}

type FilterType = 'all' | 'at-risk' | 'on-track' | 'ai-gaps';
type SortType = 'risk' | 'calls' | 'coaching' | 'ai-score';

function computeRiskStatus(rep: RepWithData): { riskStatus: string; isAtRisk: boolean } {
  const now = new Date();
  
  const daysSinceCoaching = rep.lastCoaching
    ? differenceInDays(now, new Date(rep.lastCoaching.session_date))
    : null;
  
  const risks: string[] = [];
  
  // Check no recent coaching: no session in last 14 days
  if (daysSinceCoaching === null || daysSinceCoaching > 14) {
    risks.push('No Recent Coaching');
  }
  
  const isAtRisk = risks.length > 0;
  const riskStatus = isAtRisk ? `At Risk: ${risks.join(', ')}` : 'On Track';
  
  return { riskStatus, isAtRisk };
}

// Helper to check if a rep has AI gaps
function hasAiGapsFromAnalysis(analysis: CallAnalysis | null | undefined): boolean {
  if (!analysis || !analysis.deal_gaps) return false;
  const gaps = analysis.deal_gaps as { critical_missing_info?: unknown[]; unresolved_objections?: unknown[] };
  const hasCritical = Array.isArray(gaps.critical_missing_info) && gaps.critical_missing_info.length > 0;
  const hasUnresolved = Array.isArray(gaps.unresolved_objections) && gaps.unresolved_objections.length > 0;
  return hasCritical || hasUnresolved;
}

export default function ManagerDashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [reps, setReps] = useState<RepWithData[]>([]);
  const [aiAnalysisMap, setAiAnalysisMap] = useState<Map<string, CallAnalysis | null>>(new Map());
  const [callCountsMap, setCallCountsMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('risk');

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      let repProfiles: Profile[] | null = null;

      if (role === 'admin') {
        // Admins can see all reps - get all profiles that have 'rep' role
        const { data: repRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'rep');

        if (repRoles && repRoles.length > 0) {
          const repUserIds = repRoles.map((r) => r.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', repUserIds)
            .eq('is_active', true);
          repProfiles = profiles;
        }
      } else {
        // Managers only see their team's reps
        const { data: teams } = await supabase
          .from('teams')
          .select('id')
          .eq('manager_id', user.id);

        if (!teams || teams.length === 0) {
          setLoading(false);
          return;
        }

        const teamIds = teams.map((t) => t.id);

        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('team_id', teamIds)
          .eq('is_active', true);
        repProfiles = profiles;
      }

      if (!repProfiles || repProfiles.length === 0) {
        setLoading(false);
        return;
      }

      const repIds = repProfiles.map((r) => r.id);

      // Get latest coaching sessions for all reps
      const { data: coachingSessions } = await supabase
        .from('coaching_sessions')
        .select('*')
        .in('rep_id', repIds)
        .order('session_date', { ascending: false });

      // Combine data
      const repsWithData: RepWithData[] = repProfiles.map((rep) => {
        const coaching = coachingSessions?.find((c) => c.rep_id === rep.id);

        return {
          ...rep,
          lastCoaching: coaching as unknown as CoachingSession,
        } as RepWithData;
      });

      setReps(repsWithData);

      // Fetch AI analysis and call counts in parallel
      if (repProfiles.length > 0) {
        try {
          const [analysisMap, callCounts] = await Promise.all([
            getLatestAiAnalysisForReps(repIds),
            getCallCountsLast30DaysForReps(repIds)
          ]);
          setAiAnalysisMap(analysisMap);
          setCallCountsMap(callCounts);
        } catch (err) {
          console.error('Failed to fetch AI analyses or call counts:', err);
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [user, role]);

  // Compute risk status for all reps
  const processedReps: RepWithRisk[] = useMemo(() => {
    return reps.map((rep) => {
      const { riskStatus, isAtRisk } = computeRiskStatus(rep);
      const latestAiAnalysis = aiAnalysisMap.get(rep.id) || null;
      const hasAiGaps = hasAiGapsFromAnalysis(latestAiAnalysis);
      const callsLast30Days = callCountsMap[rep.id] ?? 0;
      return {
        ...rep,
        riskStatus,
        isAtRisk,
        latestAiAnalysis,
        hasAiGaps,
        callsLast30Days,
      };
    });
  }, [reps, aiAnalysisMap, callCountsMap]);

  // Calculate summary stats
  const { atRiskCount, onTrackCount, recentlyCoached, aiGapsCount, totalCalls } = useMemo(() => {
    const atRisk = processedReps.filter((rep) => rep.isAtRisk).length;
    const onTrack = processedReps.length - atRisk;
    const aiGaps = processedReps.filter((rep) => rep.hasAiGaps).length;
    const total = processedReps.reduce((sum, rep) => sum + rep.callsLast30Days, 0);
    
    const coached = processedReps.filter((rep) => {
      if (!rep.lastCoaching) return false;
      const daysSince = differenceInDays(new Date(), new Date(rep.lastCoaching.session_date));
      return daysSince <= 14;
    }).length;

    return { atRiskCount: atRisk, onTrackCount: onTrack, recentlyCoached: coached, aiGapsCount: aiGaps, totalCalls: total };
  }, [processedReps]);

  // Filter and sort reps based on selection
  const filteredReps = useMemo(() => {
    let result = [...processedReps];
    
    if (filter === 'at-risk') {
      result = result.filter((rep) => rep.isAtRisk);
    } else if (filter === 'on-track') {
      result = result.filter((rep) => !rep.isAtRisk);
    } else if (filter === 'ai-gaps') {
      result = result.filter((rep) => rep.hasAiGaps);
    }
    
    result.sort((a, b) => {
      switch (sortBy) {
        case 'risk':
          if (a.isAtRisk && !b.isAtRisk) return -1;
          if (!a.isAtRisk && b.isAtRisk) return 1;
          return a.name.localeCompare(b.name);
        case 'calls':
          return b.callsLast30Days - a.callsLast30Days;
        case 'coaching': {
          const aDate = a.lastCoaching ? new Date(a.lastCoaching.session_date).getTime() : 0;
          const bDate = b.lastCoaching ? new Date(b.lastCoaching.session_date).getTime() : 0;
          return bDate - aDate;
        }
        case 'ai-score': {
          const aScore = a.latestAiAnalysis?.call_effectiveness_score ?? -1;
          const bScore = b.latestAiAnalysis?.call_effectiveness_score ?? -1;
          return bScore - aScore;
        }
        default:
          return 0;
      }
    });
    
    return result;
  }, [processedReps, filter, sortBy]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Page Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Team Overview</h1>
          <p className="text-muted-foreground">
            Track your reps' coaching status and call activity for {format(new Date(), 'MMMM yyyy')}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Reps</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{processedReps.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Active team members</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-success">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">On Track</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{onTrackCount}</div>
              <p className="text-xs text-muted-foreground mt-1">{recentlyCoached} coached in 14 days</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-warning">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">At Risk</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{atRiskCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Need coaching attention</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-muted-foreground">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Calls (30d)</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalCalls}</div>
              <p className="text-xs text-muted-foreground mt-1">{aiGapsCount} reps with AI gaps</p>
            </CardContent>
          </Card>
        </div>

        {/* Team Table */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-xl">Your Reps</CardTitle>
                <CardDescription>Click "View Calls" to see a rep's call history and coaching insights</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border bg-muted p-1">
                  <Button
                    variant={filter === 'all' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter('all')}
                    className="px-3"
                  >
                    All ({processedReps.length})
                  </Button>
                  <Button
                    variant={filter === 'at-risk' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter('at-risk')}
                    className="px-3"
                  >
                    At Risk ({atRiskCount})
                  </Button>
                  <Button
                    variant={filter === 'on-track' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter('on-track')}
                    className="px-3"
                  >
                    On Track ({onTrackCount})
                  </Button>
                  <Button
                    variant={filter === 'ai-gaps' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter('ai-gaps')}
                    className="px-3"
                  >
                    <Brain className="h-3.5 w-3.5 mr-1" />
                    AI Gaps ({aiGapsCount})
                  </Button>
                </div>
                <Select value={sortBy} onValueChange={(v: SortType) => setSortBy(v)}>
                  <SelectTrigger className="w-[180px] bg-background">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="risk">Sort: Risk Status</SelectItem>
                    <SelectItem value="calls">Sort: Calls (30d)</SelectItem>
                    <SelectItem value="coaching">Sort: Last Coaching</SelectItem>
                    <SelectItem value="ai-score">Sort: AI Call Score</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredReps.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">Rep Name</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Calls (30d)</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">AI Score</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">AI Gaps?</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">Last Coaching</TableHead>
                      <TableHead className="w-[180px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReps.map((rep, index) => {
                      const daysSinceCoaching = rep.lastCoaching
                        ? differenceInDays(new Date(), new Date(rep.lastCoaching.session_date))
                        : null;

                      return (
                        <TableRow 
                          key={rep.id} 
                          className={`
                            transition-colors hover:bg-muted/50
                            ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                            ${rep.isAtRisk ? 'border-l-2 border-l-warning' : ''}
                          `}
                        >
                          <TableCell className="py-4">
                            <span className="font-semibold text-foreground">{rep.name}</span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={rep.isAtRisk ? 'at-risk' : 'on-track'}>
                              {rep.isAtRisk ? rep.riskStatus.replace('At Risk: ', '') : 'On Track'}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium ${
                              rep.callsLast30Days > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                            }`}>
                              {rep.callsLast30Days}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {rep.latestAiAnalysis?.call_effectiveness_score != null ? (
                              <Badge 
                                variant="secondary" 
                                className={`text-xs font-semibold ${
                                  rep.latestAiAnalysis.call_effectiveness_score >= 80 
                                    ? 'bg-success/10 text-success' 
                                    : rep.latestAiAnalysis.call_effectiveness_score >= 60 
                                      ? 'bg-warning/10 text-warning' 
                                      : 'bg-destructive/10 text-destructive'
                                }`}
                              >
                                {Math.round(rep.latestAiAnalysis.call_effectiveness_score)}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {rep.latestAiAnalysis ? (
                              rep.hasAiGaps ? (
                                <Badge variant="destructive" className="text-xs">
                                  Flagged
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs bg-success/10 text-success">
                                  None
                                </Badge>
                              )
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {rep.lastCoaching ? (
                              <div className="space-y-0.5">
                                <div className={`text-sm font-medium ${daysSinceCoaching && daysSinceCoaching > 14 ? 'text-warning' : 'text-foreground'}`}>
                                  {format(new Date(rep.lastCoaching.session_date), 'MMM d, yyyy')}
                                </div>
                                {daysSinceCoaching !== null && (
                                  <div className="text-xs text-muted-foreground">
                                    {daysSinceCoaching === 0 ? 'Today' : daysSinceCoaching === 1 ? 'Yesterday' : `${daysSinceCoaching} days ago`}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-destructive font-medium">Never coached</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="default" 
                                size="sm" 
                                onClick={() => navigate(`/manager/rep/${rep.id}?tab=call-history`)}
                              >
                                <Phone className="h-3.5 w-3.5 mr-1" />
                                View Calls
                              </Button>
                              <Button variant="ghost" size="sm" asChild className="hover:bg-primary/10 hover:text-primary">
                                <Link to={`/manager/rep/${rep.id}`}>Details →</Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                  {filter === 'at-risk' 
                    ? 'No reps are at risk. Great job!' 
                    : filter === 'on-track'
                      ? 'No reps are on track yet.'
                      : filter === 'ai-gaps'
                        ? 'No reps have AI-flagged gaps. Great calls!'
                      : 'No team members found.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
