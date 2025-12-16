import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { getAccountDetailUrl } from '@/lib/routes';
import { withPageErrorBoundary } from '@/components/ui/page-error-boundary';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { getManagerPageBreadcrumb } from '@/lib/breadcrumbConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { TableSkeleton } from '@/components/ui/skeletons';
import { Search, Users, Calendar, DollarSign, ChevronRight, Building2, Flame, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { 
  useTeamProspects,
  useCallCounts,
  useStakeholderCounts,
  usePrimaryStakeholders,
  prospectKeys,
  type ProspectStatus,
  type ProspectFilters 
} from '@/hooks/useProspectQueries';
import { useTeamReps } from '@/hooks/useReps';
import { statusLabels, statusVariants, industryOptions } from '@/constants/prospects';
import { formatCurrency } from '@/lib/formatters';
import { HeatScoreBadge } from '@/components/ui/heat-score-badge';
import { QueryErrorBoundary } from '@/components/ui/query-error-boundary';

function ManagerAccounts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [repFilter, setRepFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<ProspectFilters['sortBy']>('last_contact_date');

  // Fetch team reps
  const { data: teamReps = [] } = useTeamReps(user?.id);

  // Build filters for prospects query
  const filters: ProspectFilters & { repId?: string } = useMemo(() => ({
    sortBy,
    sortOrder: 'desc',
    statuses: statusFilter !== 'all' ? [statusFilter as ProspectStatus] : undefined,
    repId: repFilter !== 'all' ? repFilter : undefined,
  }), [sortBy, statusFilter, repFilter]);

  // Fetch prospects
  const { 
    data: prospects = [], 
    isLoading: isLoadingProspects,
    error: prospectsError 
  } = useTeamProspects(user?.id, filters);

  // Get prospect IDs for related data
  const prospectIds = useMemo(() => prospects.map(p => p.id), [prospects]);

  // Fetch related data
  const { data: callCounts = {} } = useCallCounts(prospectIds, prospectIds.length > 0);
  const { data: stakeholderCounts = {} } = useStakeholderCounts(prospectIds, prospectIds.length > 0);
  const { data: primaryStakeholders = {} } = usePrimaryStakeholders(prospectIds, prospectIds.length > 0);

  // Client-side search filter
  const filteredProspects = useMemo(() => {
    if (!search) return prospects;
    const searchLower = search.toLowerCase();
    return prospects.filter(prospect => 
      (prospect.account_name?.toLowerCase().includes(searchLower) ?? false) ||
      prospect.prospect_name.toLowerCase().includes(searchLower) ||
      prospect.rep_name.toLowerCase().includes(searchLower)
    );
  }, [prospects, search]);

  // Refresh handler
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: prospectKeys.lists() });
  };

  const isLoading = isLoadingProspects;

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageBreadcrumb items={getManagerPageBreadcrumb('accounts')} />
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team Accounts</h1>
            <p className="text-muted-foreground">
              View all accounts from your team's sales representatives
            </p>
          </div>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
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
                  <p className="text-sm text-muted-foreground">Hot (70+)</p>
                  <p className="text-2xl font-bold">
                    {prospects.filter(p => (p.account_heat_score ?? 0) >= 70).length}
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
                        .reduce((sum, p) => sum + (p.active_revenue ?? 0), 0)
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
              <Select value={repFilter} onValueChange={setRepFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Rep" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reps</SelectItem>
                  {teamReps.map(rep => (
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
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as ProspectFilters['sortBy'])}>
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
        <QueryErrorBoundary>
          <Card>
            <CardHeader>
              <CardTitle>All Team Accounts</CardTitle>
            </CardHeader>
            <CardContent>
            {isLoading ? (
              <TableSkeleton rows={5} columns={11} />
            ) : filteredProspects.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No accounts found</h3>
                <p className="text-muted-foreground mt-1">
                  {teamReps.length === 0 
                    ? "No reps are assigned to your team yet"
                    : "No accounts match your current filters"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Primary Stakeholder</TableHead>
                    <TableHead>Rep</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Industry</TableHead>
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
                      onClick={() => navigate(getAccountDetailUrl('manager', prospect.id))}
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
                        <Badge variant={statusVariants[prospect.status]}>
                          {statusLabels[prospect.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {prospect.industry ? (
                          <Badge variant="outline" className="text-xs">
                            {industryOptions.find(i => i.value === prospect.industry)?.label ?? prospect.industry}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <HeatScoreBadge score={prospect.account_heat_score} />
                      </TableCell>
                      <TableCell>
                        {formatCurrency(prospect.active_revenue)}
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
        </QueryErrorBoundary>
      </div>
    </AppLayout>
  );
}

export default withPageErrorBoundary(ManagerAccounts, 'Team Accounts');
