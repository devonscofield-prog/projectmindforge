import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getAccountDetailUrl } from '@/lib/routes';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { getAdminPageBreadcrumb } from '@/lib/breadcrumbConfig';
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
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Search, Users, Calendar, DollarSign, ChevronRight, Building2, Flame, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import {
  useAdminProspects,
  useAdminProspectStats,
  useCallCounts,
  useStakeholderCounts,
  usePrimaryStakeholders,
  prospectKeys,
} from '@/hooks/useProspectQueries';
import { useTeams } from '@/hooks/useTeams';
import { useReps } from '@/hooks/useReps';
import { statusLabels, statusVariants, industryOptions } from '@/constants/prospects';
import { formatCurrency } from '@/lib/formatters';
import { HeatScoreBadge } from '@/components/ui/heat-score-badge';
import { QueryErrorBoundary } from '@/components/ui/query-error-boundary';

export default function AdminAccounts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [repFilter, setRepFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('last_contact_date');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Fetch teams and reps
  const { data: teams = [] } = useTeams();
  const { data: reps = [] } = useReps();

  // Fetch stats (cached for 5 minutes)
  const { data: stats = { total: 0, active: 0, hot: 0, pipelineValue: 0 } } = useAdminProspectStats();

  // Build filters for prospects query
  const filters = useMemo(() => ({
    statusFilter,
    teamFilter,
    repFilter,
    sortBy,
    search,
    currentPage,
    pageSize,
  }), [statusFilter, teamFilter, repFilter, sortBy, search, currentPage, pageSize]);

  // Fetch prospects with pagination
  const { 
    data: prospectsData,
    isLoading: isLoadingProspects,
    error: prospectsError 
  } = useAdminProspects(filters);

  const prospects = prospectsData?.prospects || [];
  const totalCount = prospectsData?.totalCount || 0;

  // Get prospect IDs for related data
  const prospectIds = useMemo(() => prospects.map(p => p.id), [prospects]);

  // Fetch related data
  const { data: callCounts = {} } = useCallCounts(prospectIds, prospectIds.length > 0);
  const { data: stakeholderCounts = {} } = useStakeholderCounts(prospectIds, prospectIds.length > 0);
  const { data: primaryStakeholders = {} } = usePrimaryStakeholders(prospectIds, prospectIds.length > 0);

  // Refresh handler
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: prospectKeys.lists() });
    queryClient.invalidateQueries({ queryKey: prospectKeys.stats() });
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const isLoading = isLoadingProspects;

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageBreadcrumb items={getAdminPageBreadcrumb('accounts')} />
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">All Accounts</h1>
            <p className="text-muted-foreground">
              View all accounts across the organization
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
                  <p className="text-2xl font-bold">{stats.total}</p>
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
                  <p className="text-2xl font-bold">{stats.active}</p>
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
                  <p className="text-2xl font-bold">{stats.hot}</p>
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
                  <p className="text-2xl font-bold">{formatCurrency(stats.pipelineValue)}</p>
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
        <QueryErrorBoundary>
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
            ) : prospects.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No accounts found</h3>
                <p className="text-muted-foreground mt-1">
                  No accounts match your current filters
                </p>
              </div>
            ) : (
              <>
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
                    {prospects.map((prospect) => (
                      <TableRow
                        key={prospect.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(getAccountDetailUrl('admin', prospect.id))}
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
                        <TableCell>{formatCurrency(prospect.active_revenue)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{stakeholderCounts[prospect.id] || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>{callCounts[prospect.id] || 0}</TableCell>
                        <TableCell>
                          {prospect.last_contact_date ? (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(prospect.last_contact_date), 'MMM d, yyyy')}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="mt-4">
                  <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalCount}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                  />
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