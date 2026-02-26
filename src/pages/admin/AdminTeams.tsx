import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { withPageErrorBoundary } from '@/components/ui/page-error-boundary';
import { 
  useAdminTeams, 
  useManagerOptions,
  adminTeamsKeys,
  type TeamWithManager,
} from '@/hooks/useAdminTeamsQueries';

const log = createLogger('AdminTeams');
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { getAdminPageBreadcrumb } from '@/lib/breadcrumbConfig';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QueryErrorBoundary } from '@/components/ui/query-error-boundary';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TableSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2, Building2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

function AdminTeams() {
  const queryClient = useQueryClient();
  
  // Fetch data using React Query
  const { data: teams = [], isLoading: teamsLoading } = useAdminTeams();
  const { data: managers = [] } = useManagerOptions();
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamWithManager | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<TeamWithManager | null>(null);
  const [formData, setFormData] = useState({ name: '', manager_id: '' });
  const [saving, setSaving] = useState(false);

  // Handle refresh
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: adminTeamsKeys.all });
  };

  const handleCreateTeam = async () => {
    if (!formData.name.trim()) {
      toast.error('Team name is required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('teams').insert({
        name: formData.name.trim(),
        manager_id: formData.manager_id || null,
      });

      if (error) throw error;

      toast.success('Team created successfully');
      setCreateDialogOpen(false);
      setFormData({ name: '', manager_id: '' });
      queryClient.invalidateQueries({ queryKey: adminTeamsKeys.all });
    } catch (error) {
      log.error('Failed to create team', { error });
      toast.error('Failed to create team');
    } finally {
      setSaving(false);
    }
  };

  const handleEditTeam = async () => {
    if (!editingTeam || !formData.name.trim()) {
      toast.error('Team name is required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          name: formData.name.trim(),
          manager_id: formData.manager_id || null,
        })
        .eq('id', editingTeam.id);

      if (error) throw error;

      toast.success('Team updated successfully');
      setEditDialogOpen(false);
      setEditingTeam(null);
      setFormData({ name: '', manager_id: '' });
      queryClient.invalidateQueries({ queryKey: adminTeamsKeys.all });
    } catch (error) {
      log.error('Failed to update team', { error });
      toast.error('Failed to update team');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!deletingTeam) return;

    setSaving(true);
    try {
      // First, unassign all members from this team
      const { error: unassignError } = await supabase
        .from('profiles')
        .update({ team_id: null })
        .eq('team_id', deletingTeam.id);

      if (unassignError) throw unassignError;

      // Then delete the team
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', deletingTeam.id);

      if (error) throw error;

      toast.success('Team deleted successfully');
      setDeleteDialogOpen(false);
      setDeletingTeam(null);
      queryClient.invalidateQueries({ queryKey: adminTeamsKeys.all });
    } catch (error) {
      log.error('Failed to delete team', { error });
      toast.error('Failed to delete team');
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (team: TeamWithManager) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      manager_id: team.manager_id || '',
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (team: TeamWithManager) => {
    setDeletingTeam(team);
    setDeleteDialogOpen(true);
  };

  if (teamsLoading) {
    return (
      <AppLayout>
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 w-32 bg-muted animate-pulse rounded" />
              <div className="h-4 w-56 bg-muted animate-pulse rounded" />
            </div>
            <div className="h-10 w-28 bg-muted animate-pulse rounded" />
          </div>
          <Card>
            <CardHeader>
              <div className="h-6 w-24 bg-muted animate-pulse rounded" />
              <div className="h-4 w-48 bg-muted animate-pulse rounded mt-2" />
            </CardHeader>
            <CardContent>
              <TableSkeleton rows={5} columns={5} />
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <PageBreadcrumb items={getAdminPageBreadcrumb('teams')} />
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Teams</h1>
            <p className="text-muted-foreground mt-1">View and manage all sales teams</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => {
              setFormData({ name: '', manager_id: '' });
              setCreateDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Team
            </Button>
          </div>
        </div>

        <QueryErrorBoundary>
        <Card>
          <CardHeader>
            <CardTitle>All Teams</CardTitle>
            <CardDescription>Overview of teams and their managers</CardDescription>
          </CardHeader>
          <CardContent>
            {teams.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team Name</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell>{team.manager?.name || 'No manager assigned'}</TableCell>
                      <TableCell>{team.memberCount}</TableCell>
                      <TableCell>{format(new Date(team.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(team)}
                            aria-label={`Edit ${team.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(team)}
                            aria-label={`Delete ${team.name}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={Building2}
                title="No teams yet"
                description="Create your first team to organize your sales reps."
                action={{
                  label: "Create Team",
                  onClick: () => {
                    setFormData({ name: '', manager_id: '' });
                    setCreateDialogOpen(true);
                  }
                }}
              />
            )}
          </CardContent>
        </Card>
        </QueryErrorBoundary>
      </div>

      {/* Create Team Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
            <DialogDescription>
              Add a new team to the organization
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Team Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter team name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager">Manager</Label>
              <Select
                value={formData.manager_id || 'none'}
                onValueChange={(v) => setFormData({ ...formData, manager_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Manager</SelectItem>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {managers.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No users with manager role found. Assign a user the manager role first.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTeam} disabled={saving}>
              {saving ? 'Creating...' : 'Create Team'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>
              Update team details
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Team Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter team name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-manager">Manager</Label>
              <Select
                value={formData.manager_id || 'none'}
                onValueChange={(v) => setFormData({ ...formData, manager_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Manager</SelectItem>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditTeam} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Team Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTeam?.name}"?
              {deletingTeam && deletingTeam.memberCount > 0 && (
                <span className="block mt-2 text-destructive">
                  This will unassign {deletingTeam.memberCount} member(s) from this team.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTeam}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

export default withPageErrorBoundary(AdminTeams, 'Teams');
