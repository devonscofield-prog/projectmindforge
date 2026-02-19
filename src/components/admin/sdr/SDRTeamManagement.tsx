import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, UserPlus, UserMinus, Users, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface TeamRow {
  id: string;
  name: string;
  manager_id: string;
  created_at: string;
  updated_at: string;
}

interface MemberRow {
  id: string;
  team_id: string;
  user_id: string;
  created_at: string;
  profiles: { id: string; name: string | null; email: string | null } | null;
}

interface ManagerOption {
  id: string;
  name: string;
}

interface SDROption {
  id: string;
  name: string;
  email: string;
}

export function SDRTeamManagement() {
  const queryClient = useQueryClient();
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<TeamRow | null>(null);
  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamManager, setNewTeamManager] = useState('');
  const [editName, setEditName] = useState('');
  const [editManager, setEditManager] = useState('');

  // Fetch teams
  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['admin-sdr-manage-teams'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sdr_teams').select('*').order('created_at');
      if (error) throw error;
      return data as TeamRow[];
    },
  });

  // Fetch all members with profiles
  const { data: allMembers = [] } = useQuery({
    queryKey: ['admin-sdr-manage-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdr_team_members')
        .select('*, profiles(id, name, email)');
      if (error) throw error;
      return data as MemberRow[];
    },
  });

  // Fetch manager options (users with sdr_manager role)
  const { data: managerOptions = [] } = useQuery({
    queryKey: ['admin-sdr-manager-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'sdr_manager');
      if (error) throw error;
      const ids = data.map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', ids);
      if (pErr) throw pErr;
      return (profiles || []).map((p: any) => ({ id: p.id, name: p.name || p.id })) as ManagerOption[];
    },
  });

  // Fetch SDR options (users with sdr role not already in a team)
  const assignedUserIds = useMemo(() => new Set(allMembers.map(m => m.user_id)), [allMembers]);

  const { data: sdrOptions = [] } = useQuery({
    queryKey: ['admin-sdr-options', Array.from(assignedUserIds)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'sdr');
      if (error) throw error;
      const ids = data.map((r: any) => r.user_id).filter((id: string) => !assignedUserIds.has(id));
      if (ids.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', ids);
      if (pErr) throw pErr;
      return (profiles || []).map((p: any) => ({ id: p.id, name: p.name || 'Unknown', email: p.email || '' })) as SDROption[];
    },
  });

  const managerMap = useMemo(() => {
    const map: Record<string, string> = {};
    managerOptions.forEach(m => { map[m.id] = m.name; });
    return map;
  }, [managerOptions]);

  const membersByTeam = useMemo(() => {
    const map: Record<string, MemberRow[]> = {};
    allMembers.forEach(m => {
      if (!map[m.team_id]) map[m.team_id] = [];
      map[m.team_id].push(m);
    });
    return map;
  }, [allMembers]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-sdr-manage-teams'] });
    queryClient.invalidateQueries({ queryKey: ['admin-sdr-manage-members'] });
    queryClient.invalidateQueries({ queryKey: ['admin-sdr-options'] });
    queryClient.invalidateQueries({ queryKey: ['sdr-teams'] });
    queryClient.invalidateQueries({ queryKey: ['sdr-team-members'] });
  };

  // Create team
  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sdr_teams').insert({ name: newTeamName, manager_id: newTeamManager });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Team created');
      setCreateOpen(false);
      setNewTeamName('');
      setNewTeamManager('');
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Update team
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editTeam) return;
      const { error } = await supabase.from('sdr_teams').update({ name: editName, manager_id: editManager }).eq('id', editTeam.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Team updated');
      setEditTeam(null);
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Delete team
  const deleteMutation = useMutation({
    mutationFn: async (teamId: string) => {
      // Remove members first
      const { error: mErr } = await supabase.from('sdr_team_members').delete().eq('team_id', teamId);
      if (mErr) throw mErr;
      const { error } = await supabase.from('sdr_teams').delete().eq('id', teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Team deleted');
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Add member
  const addMemberMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      const { error } = await supabase.from('sdr_team_members').insert({ team_id: teamId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Member added');
      setAddMemberTeamId(null);
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Remove member
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from('sdr_team_members').delete().eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Member removed');
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (teamsLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">SDR Teams</h2>
          <p className="text-sm text-muted-foreground">Create, edit, and manage SDR team assignments</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Create Team</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create SDR Team</DialogTitle>
              <DialogDescription>Set a team name and assign a manager.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Team Name</Label>
                <Input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="e.g. East Coast SDRs" />
              </div>
              <div className="space-y-2">
                <Label>Manager</Label>
                <Select value={newTeamManager} onValueChange={setNewTeamManager}>
                  <SelectTrigger><SelectValue placeholder="Select manager..." /></SelectTrigger>
                  <SelectContent>
                    {managerOptions.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newTeamName.trim() || !newTeamManager || createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No SDR teams yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {teams.map(team => {
            const members = membersByTeam[team.id] || [];
            const isExpanded = expandedTeam === team.id;

            return (
              <Card key={team.id}>
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <p className="font-medium">{team.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Manager: {managerMap[team.manager_id] || 'Unknown'} • {members.length} members • Created {format(new Date(team.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditTeam(team);
                        setEditName(team.name);
                        setEditManager(team.manager_id);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{team.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the team and unassign all {members.length} member(s). This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(team.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {isExpanded && (
                  <CardContent className="pt-0 border-t">
                    <div className="flex items-center justify-between py-3">
                      <p className="text-sm font-medium">Team Members</p>
                      <Dialog open={addMemberTeamId === team.id} onOpenChange={open => setAddMemberTeamId(open ? team.id : null)}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm"><UserPlus className="h-3.5 w-3.5 mr-1" /> Add Member</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add SDR to {team.name}</DialogTitle>
                            <DialogDescription>Select an unassigned SDR to add to this team.</DialogDescription>
                          </DialogHeader>
                          {sdrOptions.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4">All SDRs are already assigned to teams.</p>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {sdrOptions.map(sdr => (
                                <button
                                  key={sdr.id}
                                  onClick={() => addMemberMutation.mutate({ teamId: team.id, userId: sdr.id })}
                                  disabled={addMemberMutation.isPending}
                                  className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left"
                                >
                                  <div>
                                    <p className="font-medium text-sm">{sdr.name}</p>
                                    <p className="text-xs text-muted-foreground">{sdr.email}</p>
                                  </div>
                                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                                </button>
                              ))}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>

                    {members.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">No members assigned yet.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Added</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {members.map(m => (
                            <TableRow key={m.id}>
                              <TableCell className="font-medium">{m.profiles?.name || 'Unknown'}</TableCell>
                              <TableCell className="text-muted-foreground">{m.profiles?.email || ''}</TableCell>
                              <TableCell className="text-muted-foreground">{format(new Date(m.created_at), 'MMM d, yyyy')}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => removeMemberMutation.mutate(m.id)}
                                  disabled={removeMemberMutation.isPending}
                                >
                                  <UserMinus className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Team Dialog */}
      <Dialog open={!!editTeam} onOpenChange={open => { if (!open) setEditTeam(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>Update team name or manager assignment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Team Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Manager</Label>
              <Select value={editManager} onValueChange={setEditManager}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {managerOptions.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!editName.trim() || !editManager || updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
