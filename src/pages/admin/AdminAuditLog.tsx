import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchAdminAuditLogs, UserActivityLogWithProfile } from '@/api/userActivityLogs';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  UserPlus, 
  UserCog, 
  Shield, 
  KeyRound, 
  UserX, 
  UserCheck,
  Clock,
  User
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { getAdminPageBreadcrumb } from '@/lib/breadcrumbConfig';

export default function AdminAuditLog() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => fetchAdminAuditLogs(200),
    staleTime: 30 * 1000,
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_invited':
        return <UserPlus className="h-4 w-4 text-green-600" />;
      case 'user_profile_updated':
        return <UserCog className="h-4 w-4 text-blue-600" />;
      case 'user_role_changed':
        return <Shield className="h-4 w-4 text-purple-600" />;
      case 'password_reset_requested':
        return <KeyRound className="h-4 w-4 text-orange-600" />;
      case 'user_deactivated':
        return <UserX className="h-4 w-4 text-red-600" />;
      case 'user_reactivated':
        return <UserCheck className="h-4 w-4 text-emerald-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityBadgeVariant = (type: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (type) {
      case 'user_invited':
      case 'user_reactivated':
        return 'default';
      case 'user_role_changed':
        return 'secondary';
      case 'user_deactivated':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatActivityType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getTargetUserInfo = (log: UserActivityLogWithProfile) => {
    const metadata = log.metadata as Record<string, unknown>;
    if (metadata?.target_user_name) {
      return {
        name: String(metadata.target_user_name),
        email: metadata.target_user_email ? String(metadata.target_user_email) : undefined,
      };
    }
    return null;
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const targetUser = getTargetUserInfo(log);
    return (
      log.user_name.toLowerCase().includes(search) ||
      log.user_email.toLowerCase().includes(search) ||
      formatActivityType(log.activity_type).toLowerCase().includes(search) ||
      (targetUser?.name?.toLowerCase().includes(search)) ||
      (targetUser?.email?.toLowerCase().includes(search))
    );
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageBreadcrumb items={getAdminPageBreadcrumb('auditLog')} />
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground mt-2">
            Track all admin actions including user management, role changes, and password resets
          </p>
        </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Admin Actions</CardTitle>
              <CardDescription>
                Recent administrative activities across the platform
              </CardDescription>
            </div>
            <Badge variant="outline" className="h-8">
              {filteredLogs.length} {filteredLogs.length === 1 ? 'action' : 'actions'}
            </Badge>
          </div>
          <div className="pt-4">
            <Input
              placeholder="Search by admin name, action type, or target user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No audit logs found</p>
              <p className="text-sm mt-1">
                {searchTerm ? 'Try adjusting your search terms' : 'Admin actions will appear here'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-340px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Action</TableHead>
                    <TableHead>Performed By</TableHead>
                    <TableHead>Target User</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right">Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const targetUser = getTargetUserInfo(log);
                    const metadata = log.metadata as Record<string, unknown>;

                    return (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getActivityIcon(log.activity_type)}
                            <Badge variant={getActivityBadgeVariant(log.activity_type)}>
                              {formatActivityType(log.activity_type)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{log.user_name}</p>
                              <p className="text-xs text-muted-foreground">{log.user_email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {targetUser ? (
                            <div>
                              <p className="font-medium text-sm">{targetUser.name}</p>
                              {targetUser.email && (
                                <p className="text-xs text-muted-foreground">{targetUser.email}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm space-y-1">
                            {(() => {
                              const changes = metadata?.changes;
                              if (changes && typeof changes === 'object') {
                                return (
                                  <p className="text-muted-foreground text-xs">
                                    {JSON.stringify(changes)}
                                  </p>
                                );
                              }
                              return null;
                            })()}
                            {(() => {
                              const oldRole = metadata?.old_role;
                              const newRole = metadata?.new_role;
                              if (oldRole && newRole && typeof oldRole === 'string' && typeof newRole === 'string') {
                                return (
                                  <p className="text-muted-foreground">
                                    Role: <span className="font-medium">{oldRole}</span> → <span className="font-medium">{newRole}</span>
                                  </p>
                                );
                              }
                              return null;
                            })()}
                            {(() => {
                              const oldTeam = metadata?.old_team;
                              const newTeam = metadata?.new_team;
                              if (oldTeam && newTeam && typeof oldTeam === 'string' && typeof newTeam === 'string') {
                                return (
                                  <p className="text-muted-foreground">
                                    Team: <span className="font-medium">{oldTeam}</span> → <span className="font-medium">{newTeam}</span>
                                  </p>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="text-sm">
                            <p className="font-medium">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(log.created_at), 'MMM d, h:mm a')}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      </div>
    </AppLayout>
  );
}
