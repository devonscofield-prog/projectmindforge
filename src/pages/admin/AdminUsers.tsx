import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Profile, Team, UserRole } from '@/types/database';
import { format } from 'date-fns';

interface UserWithDetails extends Profile {
  role?: UserRole;
  team?: Team;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');

  useEffect(() => {
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
      const { data: teams } = await supabase.from('teams').select('*');

      // Combine data
      const usersWithDetails: UserWithDetails[] = profiles.map((profile) => ({
        ...(profile as unknown as Profile),
        role: roles?.find((r) => r.user_id === profile.id)?.role as UserRole,
        team: teams?.find((t) => t.id === profile.team_id) as unknown as Team,
      }));

      setUsers(usersWithDetails);
      setLoading(false);
    };

    fetchData();
  }, []);

  const filteredUsers = roleFilter === 'all' 
    ? users 
    : users.filter((u) => u.role === roleFilter);

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
          <p className="text-muted-foreground mt-1">View all users in the system</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>All Users</CardTitle>
              <CardDescription>
                {filteredUsers.length} users {roleFilter !== 'all' && `(filtered by ${roleFilter})`}
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
            {filteredUsers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-8">No users found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
