import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { Mail, Clock, AlertCircle, CheckCircle2, Search, Users } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { getAdminPageBreadcrumb } from '@/lib/breadcrumbConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchEmailDeliveryStatus, EmailDeliveryUser } from '@/api/emailDeliveryStatus';

const STATUS_CONFIG: Record<EmailDeliveryUser['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Active', variant: 'default' },
  pending: { label: 'Pending Setup', variant: 'destructive' },
  configured: { label: 'Configured', variant: 'secondary' },
  disabled: { label: 'Disabled', variant: 'outline' },
  no_tasks: { label: 'No Tasks', variant: 'outline' },
};

export default function AdminEmailDelivery() {
  const [search, setSearch] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['email-delivery-status'],
    queryFn: fetchEmailDeliveryStatus,
    staleTime: 60 * 1000,
  });

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const configured = users.filter(u => u.hasPreferences).length;
  const withPendingTasks = users.filter(u => u.pendingTaskCount > 0).length;
  const todaySent = users.reduce((sum, u) => sum + u.totalEmailsSent, 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageBreadcrumb items={getAdminPageBreadcrumb('emailDelivery')} />

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Email Delivery Status</h1>
          <p className="text-muted-foreground">Monitor reminder email delivery for all users</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Configured Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{configured}</div>
              <p className="text-xs text-muted-foreground">of {users.length} active users</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Users with Pending Tasks</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{withPendingTasks}</div>
              <p className="text-xs text-muted-foreground">awaiting reminders</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Emails Sent</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todaySent}</div>
              <p className="text-xs text-muted-foreground">all time</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead className="text-right">Pending Tasks</TableHead>
                  <TableHead className="text-right">Emails Sent</TableHead>
                  <TableHead>Last Delivery</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No users found</TableCell>
                  </TableRow>
                ) : (
                  filtered.map(user => {
                    const cfg = STATUS_CONFIG[user.status];
                    return (
                      <TableRow key={user.userId}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {user.reminderTime ? (
                            <div className="flex items-center gap-1.5 text-sm">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{user.reminderTime}</span>
                              <span className="text-muted-foreground text-xs">({user.timezone?.replace('America/', '') || '—'})</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not set</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {user.pendingTaskCount > 0 ? (
                            <span className="text-amber-500">{user.pendingTaskCount}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{user.totalEmailsSent}</TableCell>
                        <TableCell>
                          {user.lastSentAt ? (
                            <div className="flex items-center gap-1.5 text-sm">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              <span title={format(new Date(user.lastSentAt), 'PPpp')}>
                                {formatDistanceToNow(new Date(user.lastSentAt), { addSuffix: true })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Never</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
