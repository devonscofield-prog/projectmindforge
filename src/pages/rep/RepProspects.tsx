import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { Search, Users, Flame, Calendar, DollarSign, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { 
  listProspectsForRep, 
  getCallCountsForProspects,
  type Prospect, 
  type ProspectStatus,
  type ProspectFilters 
} from '@/api/prospects';

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

export default function RepProspects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [callCounts, setCallCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<ProspectFilters['sortBy']>('last_contact_date');

  useEffect(() => {
    if (!user?.id) return;
    loadProspects();
  }, [user?.id, statusFilter, sortBy]);

  const loadProspects = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const filters: ProspectFilters = {
        sortBy,
        sortOrder: 'desc',
      };
      
      if (statusFilter !== 'all') {
        filters.statuses = [statusFilter as ProspectStatus];
      }

      const data = await listProspectsForRep(user.id, filters);
      setProspects(data);

      // Get call counts
      if (data.length > 0) {
        const counts = await getCallCountsForProspects(data.map(p => p.id));
        setCallCounts(counts);
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
      prospect.prospect_name.toLowerCase().includes(searchLower) ||
      (prospect.account_name?.toLowerCase().includes(searchLower) ?? false)
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
          <h1 className="text-3xl font-bold tracking-tight">Prospects</h1>
          <p className="text-muted-foreground">
            Manage your prospect profiles and track interactions
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Prospects</p>
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
                  placeholder="Search prospects..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
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
                  <SelectItem value="prospect_name">Name</SelectItem>
                  <SelectItem value="account_name">Account</SelectItem>
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
            <CardTitle>All Prospects</CardTitle>
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
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No prospects yet</h3>
                <p className="text-muted-foreground mt-1">
                  Prospects are automatically created when you submit calls
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prospect</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Heat</TableHead>
                    <TableHead>Revenue</TableHead>
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
                      <TableCell className="font-medium">
                        {prospect.prospect_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {prospect.account_name || '—'}
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
