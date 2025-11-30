import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Profile, Team, UserRole } from '@/types/database';
import { format, formatDistanceToNow } from 'date-fns';
import { Pencil, History } from 'lucide-react';
import { toast } from 'sonner';
import { useOnlineUsers } from '@/hooks/usePresence';
import { UserActivityLogSheet } from '@/components/admin/UserActivityLogSheet';

interface UserWithDetails extends Profile {
  role?: UserRole;
  team?: Team;
  last_seen_at?: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const onlineUsers = useOnlineUsers();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithDetails | null>(null);
  const [editForm, setEditForm] = useState({ role: '', team_id: '', is_active: true });
  const [saving, setSaving] = useState(false);
  
  // Activity log sheet state
  const [activitySheetOpen, setActivitySheetOpen] = useState(false);
  const [activityUser, setActivityUser] = useState<UserWithDetails | null>(null);

  const fetchData = async () => {
    // Fetch all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('name');

    if (!profiles) {
      setLoading(false);
      return;
    }

    // Fetch all roles
    const { data: roles } = await supabase.from('user_roles').select('*');

    // Fetch all teams
    const { data: teamsData } = await supabase.from('teams').select('*').order('name');
    setTeams((teamsData || []) as unknown as Team[]);

    // Combine data
    const usersWithDetails: UserWithDetails[] = profiles.map((profile) => ({
      ...(profile as unknown as Profile),
      role: roles?.find((r) => r.user_id === profile.id)?.role as UserRole,
      team: teamsData?.find((t) => t.id === profile.team_id) as unknown as Team,
    }));

    setUsers(usersWithDetails);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [roleFilter]);

  const filteredUsers = useMemo(() => {
    return roleFilter === 'all' 
      ? users 
      : users.filter((u) => u.role === roleFilter);
  }, [users, roleFilter]);

  // Paginated users
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize);

  const getRoleBadgeVariant = (role?: UserRole) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'manager':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const handleEditClick = (user: UserWithDetails) => {
    setEditingUser(user);
    setEditForm({
      role: user.role || 'rep',
      team_id: user.team_id || '',
      is_active: user.is_active,
    });
    setEditDialogOpen(true);
  };

  const handleActivityClick = (user: UserWithDetails) => {
    setActivityUser(user);
    setActivitySheetOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    
    setSaving(true);
    try {
      // Update profiles table for team_id and is_active
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          team_id: editForm.team_id || null,
          is_active: editForm.is_active,
        })
        .eq('id', editingUser.id);

      if (profileError) throw profileError;

      // Update user_roles table for role change
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role: editForm.role as UserRole })
        .eq('user_id', editingUser.id);

      if (roleError) throw roleError;

      toast.success('User updated successfully');
      setEditDialogOpen(false);
      setEditingUser(null);
      
      // Refresh data
      await fetchData();
    } catch (error) {
      console.error('Failed to update user:', error);
      toast.error('Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

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
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground mt-1">View and manage all users in the system</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>All Users</CardTitle>
              <CardDescription className="flex items-center gap-3">
                <span>{filteredUsers.length} users {roleFilter !== 'all' && `(filtered by ${roleFilter})`}</span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                  {onlineUsers.size} online
                </span>
              </CardDescription>
            </div>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as 'all' | UserRole)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="rep">Rep</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {paginatedUsers.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.map((user) => {
                      const isOnline = onlineUsers.has(user.id);
                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span 
                                    className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                                      isOnline 
                                        ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' 
                                        : 'bg-muted-foreground/30'
                                    }`} 
                                  />
                                </TooltipTrigger>
                                <TooltipContent>
                                  {isOnline 
                                    ? 'Online now' 
                                    : user.last_seen_at 
                                      ? `Last seen ${formatDistanceToNow(new Date(user.last_seen_at), { addSuffix: true })}`
                                      : 'Offline'
                                  }
                                </TooltipContent>
                              </Tooltip>
                              {user.name}
                            </div>
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant={getRoleBadgeVariant(user.role)} className="capitalize">
                              {user.role || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>{user.team?.name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={user.is_active ? 'default' : 'secondary'}>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(new Date(user.created_at), 'MMM d, yyyy')}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleActivityClick(user)}
                                  >
                                    <History className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>View activity log</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditClick(user)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit user</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                
                {/* Pagination */}
                {filteredUsers.length > pageSize && (
                  <div className="mt-4 border-t pt-4">
                    <PaginationControls
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={filteredUsers.length}
                      pageSize={pageSize}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={handlePageSizeChange}
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-center py-8">No users found.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update role, team assignment, and status for {editingUser?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm({ ...editForm, role: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="rep">Rep</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="team">Team</Label>
              <Select
                value={editForm.team_id || 'none'}
                onValueChange={(v) => setEditForm({ ...editForm, team_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Team</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Active Status</Label>
              <Switch
                id="is_active"
                checked={editForm.is_active}
                onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Activity Log Sheet */}
      {activityUser && (
        <UserActivityLogSheet
          open={activitySheetOpen}
          onOpenChange={setActivitySheetOpen}
          userId={activityUser.id}
          userName={activityUser.name}
        />
      )}
    </AppLayout>
  );
}
