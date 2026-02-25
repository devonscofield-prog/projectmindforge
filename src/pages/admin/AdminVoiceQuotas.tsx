import { useState, useMemo, lazy, Suspense } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Headphones, Users, AlertTriangle, Pencil, ArrowUpDown } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { useVoiceUsageAdmin, useUpdateVoiceQuota } from '@/hooks/sdr/audioHooks';
import type { VoiceUsageAdminEntry } from '@/types/audioAnalysis';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const VoiceQuotaEditDialog = lazy(() =>
  import('@/components/admin/VoiceQuotaEditDialog').then((m) => ({
    default: m.VoiceQuotaEditDialog,
  })),
);

type SortField = 'name' | 'used' | 'pct';
type SortDir = 'asc' | 'desc';

function AdminVoiceQuotas() {
  const { data, isLoading, isError } = useVoiceUsageAdmin();
  const updateQuota = useUpdateVoiceQuota();

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [globalLimitInput, setGlobalLimitInput] = useState<number | null>(null);
  const [editUser, setEditUser] = useState<VoiceUsageAdminEntry | null>(null);

  const entries = data?.entries ?? [];
  const globalLimit = data?.globalLimit ?? 10;

  // Derive the displayed global limit input (default to server value)
  const displayGlobalLimit = globalLimitInput ?? globalLimit;

  // Summary stats
  const totalUsed = useMemo(() => entries.reduce((sum, e) => sum + e.used, 0), [entries]);
  const usersAtLimit = useMemo(
    () => entries.filter((e) => e.used >= e.effectiveLimit).length,
    [entries],
  );

  // Sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = (a.userName ?? a.userEmail ?? '').localeCompare(b.userName ?? b.userEmail ?? '');
          break;
        case 'used':
          cmp = a.used - b.used;
          break;
        case 'pct':
          cmp = a.used / (a.effectiveLimit || 1) - b.used / (b.effectiveLimit || 1);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [entries, sortField, sortDir]);

  const handleSaveGlobalLimit = () => {
    if (displayGlobalLimit === globalLimit) return;
    updateQuota.mutate(
      { scope: 'global', targetId: null, monthlyLimit: displayGlobalLimit },
      {
        onSuccess: () => {
          toast.success('Global default limit updated');
          setGlobalLimitInput(null);
        },
      },
    );
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 80) return 'bg-red-500';
    if (pct >= 50) return 'bg-amber-500';
    return 'bg-green-500';
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load voice quota data. Please try refreshing.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Voice Analysis Quotas</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage monthly voice analysis limits for all users
          </p>
        </div>

        {/* Overview Cards */}
        <section
          aria-label="Voice quota overview"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Headphones className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalUsed}</p>
                  <p className="text-sm text-muted-foreground">Total Analyses This Month</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle
                  className={cn(
                    'h-8 w-8',
                    usersAtLimit > 0 ? 'text-amber-500' : 'text-muted-foreground',
                  )}
                />
                <div>
                  <p className="text-2xl font-bold">{usersAtLimit}</p>
                  <p className="text-sm text-muted-foreground">Users At/Over Limit</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{globalLimit}</p>
                  <p className="text-sm text-muted-foreground">Global Default Limit</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Per-User Table */}
        <Card>
          <CardHeader>
            <CardTitle>Per-User Usage</CardTitle>
            <CardDescription>{entries.length} users with voice analysis activity</CardDescription>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <EmptyState
                icon={Headphones}
                title="No voice analysis usage"
                description="No users have used voice analysis yet this month."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 gap-1"
                        onClick={() => handleSort('name')}
                      >
                        User
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 gap-1"
                        onClick={() => handleSort('used')}
                      >
                        Used
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </Button>
                    </TableHead>
                    <TableHead>Limit</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 gap-1"
                        onClick={() => handleSort('pct')}
                      >
                        % Used
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </Button>
                    </TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEntries.map((entry) => {
                    const pct = entry.effectiveLimit > 0
                      ? Math.round((entry.used / entry.effectiveLimit) * 100)
                      : 0;
                    return (
                      <TableRow key={entry.userId}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {entry.userName || 'Unknown User'}
                            </p>
                            {entry.userEmail && (
                              <p className="text-xs text-muted-foreground">{entry.userEmail}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{entry.used}</TableCell>
                        <TableCell>
                          {entry.effectiveLimit}
                          {entry.individualLimit !== null && (
                            <span className="text-xs text-muted-foreground ml-1">(custom)</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  getProgressColor(pct),
                                )}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground w-12">{pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditUser(entry)}
                            aria-label={`Edit quota for ${entry.userName || 'user'}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Global Default Section */}
        <Card>
          <CardHeader>
            <CardTitle>Global Default Limit</CardTitle>
            <CardDescription>
              This limit applies to all users who do not have an individual or team-level override
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="global-limit">Monthly analyses per user</Label>
                <Input
                  id="global-limit"
                  type="number"
                  min={0}
                  max={1000}
                  className="w-40"
                  value={displayGlobalLimit}
                  onChange={(e) =>
                    setGlobalLimitInput(Math.max(0, parseInt(e.target.value, 10) || 0))
                  }
                />
              </div>
              <Button
                onClick={handleSaveGlobalLimit}
                disabled={displayGlobalLimit === globalLimit || updateQuota.isPending}
              >
                {updateQuota.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit dialog */}
      {editUser && (
        <Suspense fallback={null}>
          <VoiceQuotaEditDialog
            userId={editUser.userId}
            userName={editUser.userName || editUser.userEmail || 'Unknown User'}
            currentLimit={editUser.effectiveLimit}
            currentUsed={editUser.used}
            open={!!editUser}
            onOpenChange={(open) => {
              if (!open) setEditUser(null);
            }}
          />
        </Suspense>
      )}
    </AppLayout>
  );
}

export default AdminVoiceQuotas;
