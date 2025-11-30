import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CoachingSession, Profile } from '@/types/database';
import { format } from 'date-fns';
import { Plus, ArrowUpDown } from 'lucide-react';
import { getTeamRepsForManager } from '@/api/prospects';
import { useToast } from '@/hooks/use-toast';

interface CoachingWithRep extends CoachingSession {
  rep?: Profile;
}

type SortField = 'date' | 'follow-up';
type SortOrder = 'asc' | 'desc';

export default function ManagerCoaching() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<CoachingWithRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamReps, setTeamReps] = useState<{ id: string; name: string }[]>([]);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    rep_id: '',
    session_date: format(new Date(), 'yyyy-MM-dd'),
    focus_area: '',
    notes: '',
    action_items: '',
    follow_up_date: '',
  });
  const [submitting, setSubmitting] = useState(false);
  
  // Filter state
  const [repFilter, setRepFilter] = useState<string>('all');
  const [followUpFilter, setFollowUpFilter] = useState<string>('all');
  
  // Sort state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const fetchData = async () => {
    if (!user) return;
    
    // Get all coaching sessions by this manager
    const { data: coachingData } = await supabase
      .from('coaching_sessions')
      .select('*')
      .eq('manager_id', user.id)
      .order('session_date', { ascending: false });

    if (coachingData && coachingData.length > 0) {
      // Get unique rep IDs
      const repIds = [...new Set(coachingData.map((c) => c.rep_id))];

      // Fetch rep profiles
      const { data: repProfiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', repIds);

      // Combine data
      const sessionsWithReps: CoachingWithRep[] = coachingData.map((session) => ({
        ...(session as unknown as CoachingSession),
        rep: repProfiles?.find((r) => r.id === session.rep_id) as unknown as Profile,
      }));

      setSessions(sessionsWithReps);
    } else {
      setSessions([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  useEffect(() => {
    if (user) {
      getTeamRepsForManager(user.id).then(setTeamReps);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.rep_id || !formData.focus_area) {
      toast({ title: 'Error', description: 'Please fill in required fields', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('coaching_sessions').insert({
      rep_id: formData.rep_id,
      manager_id: user.id,
      session_date: formData.session_date,
      focus_area: formData.focus_area,
      notes: formData.notes || null,
      action_items: formData.action_items || null,
      follow_up_date: formData.follow_up_date || null,
    });

    setSubmitting(false);
    
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Coaching session created' });
      setDialogOpen(false);
      setFormData({
        rep_id: '',
        session_date: format(new Date(), 'yyyy-MM-dd'),
        focus_area: '',
        notes: '',
        action_items: '',
        follow_up_date: '',
      });
      fetchData();
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const displayedSessions = useMemo(() => {
    let results = sessions;

    // Rep filter
    if (repFilter !== 'all') {
      results = results.filter(s => s.rep_id === repFilter);
    }

    // Follow-up filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (followUpFilter === 'has-followup') {
      results = results.filter(s => s.follow_up_date !== null);
    } else if (followUpFilter === 'no-followup') {
      results = results.filter(s => s.follow_up_date === null);
    } else if (followUpFilter === 'upcoming') {
      results = results.filter(s => 
        s.follow_up_date && new Date(s.follow_up_date) >= today
      );
    } else if (followUpFilter === 'overdue') {
      results = results.filter(s => 
        s.follow_up_date && new Date(s.follow_up_date) < today
      );
    }

    // Sort
    const sorted = [...results].sort((a, b) => {
      let aVal: Date | null, bVal: Date | null;

      if (sortField === 'date') {
        aVal = new Date(a.session_date);
        bVal = new Date(b.session_date);
      } else {
        aVal = a.follow_up_date ? new Date(a.follow_up_date) : null;
        bVal = b.follow_up_date ? new Date(b.follow_up_date) : null;
      }

      // Handle nulls (push to end)
      if (!aVal && !bVal) return 0;
      if (!aVal) return 1;
      if (!bVal) return -1;

      const comparison = aVal.getTime() - bVal.getTime();
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [sessions, repFilter, followUpFilter, sortField, sortOrder]);

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Coaching Sessions</h1>
            <p className="text-muted-foreground mt-1">All your coaching sessions with team members</p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Session
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Coaching Session</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rep_id">Team Member *</Label>
                  <Select 
                    value={formData.rep_id} 
                    onValueChange={(value) => setFormData({ ...formData, rep_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamReps.map(rep => (
                        <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="session_date">Session Date *</Label>
                  <Input
                    id="session_date"
                    type="date"
                    value={formData.session_date}
                    onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="focus_area">Focus Area *</Label>
                  <Input
                    id="focus_area"
                    placeholder="e.g., Discovery Skills, Objection Handling"
                    value={formData.focus_area}
                    onChange={(e) => setFormData({ ...formData, focus_area: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Session notes..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="action_items">Action Items</Label>
                  <Textarea
                    id="action_items"
                    placeholder="Action items for the rep..."
                    value={formData.action_items}
                    onChange={(e) => setFormData({ ...formData, action_items: e.target.value })}
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="follow_up_date">Follow-up Date</Label>
                  <Input
                    id="follow_up_date"
                    type="date"
                    value={formData.follow_up_date}
                    onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                  />
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Create Session'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Session History</CardTitle>
                <CardDescription>View and manage all coaching sessions</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={repFilter} onValueChange={setRepFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filter by Rep" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Reps</SelectItem>
                    {teamReps.map(rep => (
                      <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={followUpFilter} onValueChange={setFollowUpFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Follow-up Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sessions</SelectItem>
                    <SelectItem value="has-followup">Has Follow-up</SelectItem>
                    <SelectItem value="no-followup">No Follow-up</SelectItem>
                    <SelectItem value="upcoming">Upcoming Follow-ups</SelectItem>
                    <SelectItem value="overdue">Overdue Follow-ups</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {displayedSessions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleSort('date')}
                    >
                      <div className="flex items-center gap-1">
                        Date
                        <ArrowUpDown className={`h-4 w-4 ${sortField === 'date' ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                    </TableHead>
                    <TableHead>Rep</TableHead>
                    <TableHead>Focus Area</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleSort('follow-up')}
                    >
                      <div className="flex items-center gap-1">
                        Follow-up
                        <ArrowUpDown className={`h-4 w-4 ${sortField === 'follow-up' ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                    </TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>{format(new Date(session.session_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="font-medium">{session.rep?.name || 'Unknown'}</TableCell>
                      <TableCell>{session.focus_area}</TableCell>
                      <TableCell>
                        {session.follow_up_date
                          ? format(new Date(session.follow_up_date), 'MMM d, yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/manager/rep/${session.rep_id}`}>View Rep</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                {sessions.length === 0 
                  ? 'No coaching sessions yet. Start coaching your team!'
                  : 'No sessions match the current filters.'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
