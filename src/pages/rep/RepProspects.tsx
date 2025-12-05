import { useState, useMemo, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { getAccountDetailUrl } from '@/lib/routes';
import { withPageErrorBoundary } from '@/components/ui/page-error-boundary';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { getRepPageBreadcrumb } from '@/lib/breadcrumbConfig';
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
import { MobileProspectListSkeleton, TableSkeleton, StatCardGridSkeleton } from '@/components/ui/skeletons';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { QueryErrorBoundary } from '@/components/ui/query-error-boundary';
import { Search, Users, Calendar, DollarSign, ChevronRight, Building2, Flame, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { type ProspectStatus, type ProspectFilters } from '@/api/prospects';
import { MobileProspectCard } from '@/components/prospects/MobileProspectCard';
import { statusLabels, statusVariants, industryOptions } from '@/constants/prospects';
import { formatCurrency } from '@/lib/formatters';
import { HeatScoreBadge } from '@/components/ui/heat-score-badge';
import { 
  useRepProspects, 
  useCallCounts, 
  useStakeholderCounts,
  prospectKeys 
} from '@/hooks/useProspectQueries';

function RepProspects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<ProspectFilters['sortBy']>('last_contact_date');

  // Fetch prospects with React Query
  const filters: ProspectFilters = useMemo(() => ({
    sortBy,
    sortOrder: 'desc' as const,
    ...(statusFilter !== 'all' && { statuses: [statusFilter as ProspectStatus] }),
  }), [statusFilter, sortBy]);

  const { 
    data: prospects = [], 
    isLoading,
    refetch: refetchProspects 
  } = useRepProspects(user?.id, filters);

  const prospectIds = useMemo(() => prospects.map(p => p.id), [prospects]);

  const { data: callCounts = {} } = useCallCounts(prospectIds);
  const { data: stakeholderCounts = {} } = useStakeholderCounts(prospectIds);

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: prospectKeys.lists() });
  };

  const filteredProspects = useMemo(() => {
    if (!search) return prospects;
    const searchLower = search.toLowerCase();
    return prospects.filter(prospect =>
      (prospect.account_name?.toLowerCase().includes(searchLower) ?? false) ||
      prospect.prospect_name.toLowerCase().includes(searchLower)
    );
  }, [prospects, search]);

  // Calculate stats from filtered data
  const stats = useMemo(() => ({
    total: prospects.length,
    active: prospects.filter(p => p.status === 'active').length,
    hot: prospects.filter(p => (p.heat_score ?? 0) >= 8).length,
    pipelineValue: prospects
      .filter(p => p.status === 'active')
      .reduce((sum, p) => sum + (p.active_revenue ?? 0), 0),
  }), [prospects]);

  // Handle keyboard navigation for table rows
  const handleRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, prospectId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(getAccountDetailUrl('rep', prospectId));
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
        <PageBreadcrumb items={getRepPageBreadcrumb('accounts')} />
        
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage your accounts and track stakeholder relationships
          </p>
        </div>

        {/* Stats Cards */}
        {isLoading ? (
          <StatCardGridSkeleton count={4} />
        ) : (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Accounts</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-500/10">
                    <TrendingUp className="h-5 w-5 text-green-500" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold">{stats.active}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-orange-500/10">
                    <Flame className="h-5 w-5 text-orange-500" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Hot (8+)</p>
                    <p className="text-2xl font-bold">{stats.hot}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-blue-500/10">
                    <DollarSign className="h-5 w-5 text-blue-500" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pipeline Value</p>
                    <p className="text-2xl font-bold">{formatCurrency(stats.pipelineValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  placeholder="Search accounts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  aria-label="Search accounts"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]" aria-label="Filter by status">
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
                <SelectTrigger className="w-[180px]" aria-label="Sort accounts by">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_contact_date">Last Contact</SelectItem>
                  <SelectItem value="account_name">Account Name</SelectItem>
                  <SelectItem value="heat_score">Heat Score</SelectItem>
                  <SelectItem value="active_revenue">Revenue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Prospects Table */}
        <QueryErrorBoundary>
        <Card>
          <CardHeader>
            <CardTitle>All Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <>
                <div className="md:hidden">
                  <MobileProspectListSkeleton count={5} />
                </div>
                <div className="hidden md:block">
                  <TableSkeleton rows={5} columns={9} />
                </div>
              </>
            ) : filteredProspects.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto mb-4 rounded-full bg-muted p-4 w-fit">
                  <Building2 className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold">No accounts yet</h3>
                <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                  {search 
                    ? `No accounts match "${search}". Try a different search term.`
                    : "Accounts are automatically created when you submit call transcripts. Submit your first call to get started."
                  }
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Card View with Pull-to-Refresh */}
                <PullToRefresh onRefresh={handleRefresh} className="md:hidden">
                  <div className="space-y-3">
                    {filteredProspects.map((prospect) => (
                      <MobileProspectCard
                        key={prospect.id}
                        prospect={prospect}
                        stakeholderCount={stakeholderCounts[prospect.id] || 0}
                        callCount={callCounts[prospect.id] || 0}
                        onClick={() => navigate(getAccountDetailUrl('rep', prospect.id))}
                      />
                    ))}
                  </div>
                </PullToRefresh>

                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table aria-label="Accounts table">
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Account</TableHead>
                        <TableHead scope="col">Status</TableHead>
                        <TableHead scope="col">Industry</TableHead>
                        <TableHead scope="col">Heat</TableHead>
                        <TableHead scope="col">Revenue</TableHead>
                        <TableHead scope="col">Stakeholders</TableHead>
                        <TableHead scope="col">Calls</TableHead>
                        <TableHead scope="col">Last Contact</TableHead>
                        <TableHead scope="col" className="w-10">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProspects.map((prospect) => (
                        <TableRow
                          key={prospect.id}
                          className="cursor-pointer hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none"
                          onClick={() => navigate(getAccountDetailUrl('rep', prospect.id))}
                          onKeyDown={(e) => handleRowKeyDown(e, prospect.id)}
                          tabIndex={0}
                          role="link"
                          aria-label={`View ${prospect.account_name || prospect.prospect_name}`}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {prospect.account_name || prospect.prospect_name}
                              </p>
                              {prospect.account_name && prospect.prospect_name && (
                                <p className="text-xs text-muted-foreground">
                                  Primary: {prospect.prospect_name}
                                </p>
                              )}
                            </div>
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
                            <HeatScoreBadge score={prospect.heat_score} />
                          </TableCell>
                          <TableCell>
                            {formatCurrency(prospect.active_revenue)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Users className="h-3.5 w-3.5" aria-hidden="true" />
                              {stakeholderCounts[prospect.id] || 0}
                            </div>
                          </TableCell>
                          <TableCell>
                            {callCounts[prospect.id] || 0}
                          </TableCell>
                          <TableCell>
                            {prospect.last_contact_date ? (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="h-3 w-3" aria-hidden="true" />
                                {format(new Date(prospect.last_contact_date), 'MMM d, yyyy')}
                              </div>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        </QueryErrorBoundary>
      </div>
    </AppLayout>
  );
}

export default withPageErrorBoundary(RepProspects, 'Accounts');
