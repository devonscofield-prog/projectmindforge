import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Users, Flame, Calendar, DollarSign, ChevronRight, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { getStakeholderCountsForProspects, getPrimaryStakeholdersForProspects } from '@/api/stakeholders';

type ProspectStatus = 'active' | 'won' | 'lost' | 'dormant';

interface ProspectWithDetails {
  id: string;
  prospect_name: string;
  account_name: string | null;
  status: ProspectStatus;
  industry: string | null;
  heat_score: number | null;
  potential_revenue: number | null;
  last_contact_date: string | null;
  rep_id: string;
  rep_name: string;
  team_name: string | null;
}

const statusLabels: Record<ProspectStatus, string> = {
  active: 'Active',
  won: 'Won',
  lost: 'Lost',
  dormant: 'Dormant',
};

const statusVariants: Record<ProspectStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  won: 'secondary',
  lost: 'destructive',
  dormant: 'outline',
};

const industryOptions = [
  { value: 'education', label: 'Education' },
  { value: 'local_government', label: 'Local Government' },
  { value: 'state_government', label: 'State Government' },
  { value: 'federal_government', label: 'Federal Government' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'msp', label: 'MSP' },
  { value: 'technology', label: 'Technology' },
  { value: 'finance', label: 'Finance' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail', label: 'Retail' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'other', label: 'Other' },
];

function HeatScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground">—</span>;
  
  let colorClass = 'text-muted-foreground';
  if (score >= 8) colorClass = 'text-red-500';
  else if (score >= 6) colorClass = 'text-orange-500';
  else if (score >= 4) colorClass = 'text-yellow-500';
  else colorClass = 'text-blue-500';

  return (
    <div className="flex items-center gap-1">
      <Flame className={`h-4 w-4 ${colorClass}`} />
      <span className={colorClass}>{score}/10</span>
    </div>
  );
}

export default function AdminAccounts() {
  const navigate = useNavigate();
  
  const [prospects, setProspects] = useState<ProspectWithDetails[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [reps, setReps] = useState<{ id: string; name: string }[]>([]);
  const [callCounts, setCallCounts] = useState<Record<string, number>>({});
  const [stakeholderCounts, setStakeholderCounts] = useState<Record<string, number>>({});
  const [primaryStakeholders, setPrimaryStakeholders] = useState<Record<string, { name: string; job_title: string | null }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [repFilter, setRepFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('last_contact_date');

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadProspects();
  }, [statusFilter, teamFilter, repFilter, sortBy]);

  const loadInitialData = async () => {
    // Load teams
    const { data: teamsData } = await supabase.from('teams').select('id, name').order('name');
    setTeams(teamsData || []);

    // Load all reps
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, name')
      .order('name');
    setReps(profilesData || []);
  };

  const loadProspects = async () => {
    setIsLoading(true);
    try {
      // Fetch all prospects with rep info
      let query = supabase
        .from('prospects')
        .select(`
          id,
          prospect_name,
          account_name,
          status,
          industry,
          heat_score,
          potential_revenue,
          last_contact_date,
          rep_id
        `)
        .order(sortBy === 'account_name' ? 'account_name' : sortBy, { ascending: sortBy === 'account_name' });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as ProspectStatus);
      }

      if (repFilter !== 'all') {
        query = query.eq('rep_id', repFilter);
      }

      const { data: prospectsData } = await query;

      if (!prospectsData) {
        setProspects([]);
        setIsLoading(false);
        return;
      }

      // Get unique rep IDs
      const repIds = [...new Set(prospectsData.map(p => p.rep_id))];
      
      // Fetch rep profiles with teams
      const { data: repProfiles } = await supabase
        .from('profiles')
        .select('id, name, team_id')
        .in('id', repIds);

      // Fetch teams for profiles
      const teamIds = [...new Set(repProfiles?.map(r => r.team_id).filter(Boolean) || [])];
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds as string[]);

      // Build lookup maps
      const repMap = new Map(repProfiles?.map(r => [r.id, r]) || []);
      const teamMap = new Map(teamsData?.map(t => [t.id, t.name]) || []);

      // Combine data
      let combined: ProspectWithDetails[] = prospectsData.map(p => {
        const rep = repMap.get(p.rep_id);
        return {
          ...p,
          status: p.status as ProspectStatus,
          rep_name: rep?.name || 'Unknown',
          team_name: rep?.team_id ? teamMap.get(rep.team_id) || null : null,
        };
      });

      // Filter by team if selected
      if (teamFilter !== 'all') {
        const repIdsInTeam = repProfiles?.filter(r => r.team_id === teamFilter).map(r => r.id) || [];
        combined = combined.filter(p => repIdsInTeam.includes(p.rep_id));
      }

      setProspects(combined);

      // Get additional data
      if (combined.length > 0) {
        const prospectIds = combined.map(p => p.id);
        
        // Get call counts
        const { data: callData } = await supabase
          .from('call_transcripts')
          .select('prospect_id')
          .in('prospect_id', prospectIds);
        
        const counts: Record<string, number> = {};
        callData?.forEach(c => {
          if (c.prospect_id) {
            counts[c.prospect_id] = (counts[c.prospect_id] || 0) + 1;
          }
        });
        setCallCounts(counts);

        const [sCounts, primaryData] = await Promise.all([
          getStakeholderCountsForProspects(prospectIds),
          getPrimaryStakeholdersForProspects(prospectIds),
        ]);
        setStakeholderCounts(sCounts);
        setPrimaryStakeholders(primaryData);
      } else {
        setCallCounts({});
        setStakeholderCounts({});
        setPrimaryStakeholders({});
      }
    } catch (error) {
      console.error('Failed to load prospects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProspects = prospects.filter(prospect => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      (prospect.account_name?.toLowerCase().includes(searchLower) ?? false) ||
      prospect.prospect_name.toLowerCase().includes(searchLower) ||
      prospect.rep_name.toLowerCase().includes(searchLower)
    );
  });

  const formatCurrency = (value: number | null) => {
    if (value === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Accounts</h1>
          <p className="text-muted-foreground">
            View all accounts across the organization
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Accounts</p>
                  <p className="text-2xl font-bold">{prospects.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-500/10">
                  <Flame className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">
                    {prospects.filter(p => p.status === 'active').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-orange-500/10">
                  <Flame className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hot (8+)</p>
                  <p className="text-2xl font-bold">
                    {prospects.filter(p => (p.heat_score ?? 0) >= 8).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-500/10">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pipeline Value</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(
                      prospects
                        .filter(p => p.status === 'active')
                        .reduce((sum, p) => sum + (p.potential_revenue ?? 0), 0)
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search accounts or reps..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={repFilter} onValueChange={setRepFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Rep" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reps</SelectItem>
                  {reps.map(rep => (
                    <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="dormant">Dormant</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_contact_date">Last Contact</SelectItem>
                  <SelectItem value="account_name">Account Name</SelectItem>
                  <SelectItem value="heat_score">Heat Score</SelectItem>
                  <SelectItem value="potential_revenue">Revenue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Prospects Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Organization Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredProspects.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No accounts found</h3>
                <p className="text-muted-foreground mt-1">
                  No accounts match your current filters
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Primary Stakeholder</TableHead>
                    <TableHead>Rep</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Heat</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Stakeholders</TableHead>
                    <TableHead>Calls</TableHead>
                    <TableHead>Last Contact</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProspects.map((prospect) => (
                    <TableRow
                      key={prospect.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/rep/prospects/${prospect.id}`)}
                    >
                      <TableCell>
                        <p className="font-medium">
                          {prospect.account_name || prospect.prospect_name}
                        </p>
                      </TableCell>
                      <TableCell>
                        {primaryStakeholders[prospect.id] ? (
                          <div>
                            <p className="font-medium text-sm">{primaryStakeholders[prospect.id].name}</p>
                            {primaryStakeholders[prospect.id].job_title && (
                              <p className="text-xs text-muted-foreground">{primaryStakeholders[prospect.id].job_title}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-normal">
                          {prospect.rep_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {prospect.team_name ? (
                          <span className="text-sm text-muted-foreground">{prospect.team_name}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariants[prospect.status]}>
                          {statusLabels[prospect.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <HeatScoreBadge score={prospect.heat_score} />
                      </TableCell>
                      <TableCell>
                        {formatCurrency(prospect.potential_revenue)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {stakeholderCounts[prospect.id] || 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        {callCounts[prospect.id] || 0}
                      </TableCell>
                      <TableCell>
                        {prospect.last_contact_date ? (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(prospect.last_contact_date), 'MMM d, yyyy')}
                          </div>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
