import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getRepDetailUrl } from '@/lib/routes';
import { 
  useManagerCoachingSessions, 
  useTeamRepsForManager,
  managerCoachingKeys,
  type CoachingWithRep 
} from '@/hooks/useManagerCoachingQueries';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { getManagerPageBreadcrumb } from '@/lib/breadcrumbConfig';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { QueryErrorBoundary } from '@/components/ui/query-error-boundary';
import { format } from 'date-fns';
import { Plus, ArrowUpDown, Pencil, Trash2, Calendar, User, Target, FileText, CheckSquare, CalendarClock, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type SortField = 'date' | 'follow-up';
type SortOrder = 'asc' | 'desc';

const ITEMS_PER_PAGE = 10;

export default function ManagerCoaching() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch data using React Query
  const { data: sessions = [], isLoading: sessionsLoading } = useManagerCoachingSessions(user?.id);
  const { data: teamReps = [] } = useTeamRepsForManager(user?.id);
  
  // Handle refresh
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: managerCoachingKeys.all });
  };
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<CoachingWithRep | null>(null);
  const [formData, setFormData] = useState({
    rep_id: '',
    session_date: format(new Date(), 'yyyy-MM-dd'),
    focus_area: '',
    notes: '',
    action_items: '',
    follow_up_date: '',
  });
  const [submitting, setSubmitting] = useState(false);
  
  // Delete state
  const [deletingSession, setDeletingSession] = useState<CoachingWithRep | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // View details state
  const [viewingSession, setViewingSession] = useState<CoachingWithRep | null>(null);
  
  // Filter state
  const [repFilter, setRepFilter] = useState<string>('all');
  const [followUpFilter, setFollowUpFilter] = useState<string>('all');
  
  // Sort state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Computed dialog state
  const isDialogOpen = dialogOpen || editingSession !== null;
  const isEditMode = editingSession !== null;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [repFilter, followUpFilter]);

  const resetForm = () => {
    setFormData({
      rep_id: '',
      session_date: format(new Date(), 'yyyy-MM-dd'),
      focus_area: '',
      notes: '',
      action_items: '',
      follow_up_date: '',
    });
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setDialogOpen(false);
      setEditingSession(null);
      resetForm();
    }
  };

  const startEdit = (session: CoachingWithRep) => {
    setFormData({
      rep_id: session.rep_id,
      session_date: session.session_date,
      focus_area: session.focus_area,
      notes: session.notes || '',
      action_items: session.action_items || '',
      follow_up_date: session.follow_up_date || '',
    });
    setEditingSession(session);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.rep_id || !formData.focus_area) {
      toast({ title: 'Error', description: 'Please fill in required fields', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    if (isEditMode && editingSession) {
      // Update existing session
      const { error } = await supabase
        .from('coaching_sessions')
        .update({
          rep_id: formData.rep_id,
          session_date: formData.session_date,
          focus_area: formData.focus_area,
          notes: formData.notes || null,
          action_items: formData.action_items || null,
          follow_up_date: formData.follow_up_date || null,
        })
        .eq('id', editingSession.id);

      setSubmitting(false);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Coaching session updated' });
        handleDialogClose(false);
        queryClient.invalidateQueries({ queryKey: managerCoachingKeys.sessions(user.id) });
      }
    } else {
      // Create new session
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
        handleDialogClose(false);
        queryClient.invalidateQueries({ queryKey: managerCoachingKeys.sessions(user.id) });
      }
    }
  };

  const handleDelete = async () => {
    if (!deletingSession) return;

    setDeleting(true);
    const { error } = await supabase
      .from('coaching_sessions')
      .delete()
      .eq('id', deletingSession.id);

    setDeleting(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Coaching session deleted' });
      setDeletingSession(null);
      if (user) {
        queryClient.invalidateQueries({ queryKey: managerCoachingKeys.sessions(user.id) });
      }
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

  // Pagination calculations
  const totalPages = Math.ceil(displayedSessions.length / ITEMS_PER_PAGE);
  const paginatedSessions = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return displayedSessions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [displayedSessions, currentPage]);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== 'ellipsis') {
        pages.push('ellipsis');
      }
    }
    return pages;
  };

  if (sessionsLoading) {
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
        <PageBreadcrumb items={getManagerPageBreadcrumb('coaching')} />
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Coaching Sessions</h1>
            <p className="text-muted-foreground mt-1">All your coaching sessions with team members</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Session
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{isEditMode ? 'Edit Coaching Session' : 'Create Coaching Session'}</DialogTitle>
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
                  <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting 
                      ? (isEditMode ? 'Saving...' : 'Creating...') 
                      : (isEditMode ? 'Save Changes' : 'Create Session')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <QueryErrorBoundary>
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
              <>
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
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSessions.map((session) => (
                      <TableRow 
                        key={session.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setViewingSession(session)}
                      >
                        <TableCell>{format(new Date(session.session_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="font-medium">{session.rep?.name || 'Unknown'}</TableCell>
                        <TableCell>{session.focus_area}</TableCell>
                        <TableCell>
                          {session.follow_up_date
                            ? format(new Date(session.follow_up_date), 'MMM d, yyyy')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => startEdit(session)}
                              title="Edit session"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setDeletingSession(session)}
                              title="Delete session"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                              <Link to={getRepDetailUrl(session.rep_id)}>View Rep</Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, displayedSessions.length)} of {displayedSessions.length} sessions
                    </p>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                        {getPageNumbers().map((page, index) => (
                          page === 'ellipsis' ? (
                            <PaginationItem key={`ellipsis-${index}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          ) : (
                            <PaginationItem key={page}>
                              <PaginationLink
                                isActive={currentPage === page}
                                onClick={() => setCurrentPage(page)}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        ))}
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                {sessions.length === 0 
                  ? 'No coaching sessions yet. Start coaching your team!'
                  : 'No sessions match the current filters.'}
              </p>
            )}
          </CardContent>
        </Card>
        </QueryErrorBoundary>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingSession} onOpenChange={(open) => !open && setDeletingSession(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Coaching Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the coaching session with {deletingSession?.rep?.name || 'this rep'} 
              {deletingSession && ` on ${format(new Date(deletingSession.session_date), 'MMM d, yyyy')}`}. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Session Details Sheet */}
      <Sheet open={!!viewingSession} onOpenChange={(open) => !open && setViewingSession(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Session Details</SheetTitle>
            <SheetDescription>
              Coaching session information and notes
            </SheetDescription>
          </SheetHeader>
          
          {viewingSession && (
            <div className="mt-6 space-y-6">
              {/* Meta info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Session Date
                  </div>
                  <p className="font-medium">
                    {format(new Date(viewingSession.session_date), 'MMMM d, yyyy')}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    Team Member
                  </div>
                  <p className="font-medium">{viewingSession.rep?.name || 'Unknown'}</p>
                </div>
              </div>

              <Separator />

              {/* Focus Area */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Target className="h-4 w-4" />
                  Focus Area
                </div>
                <Badge variant="secondary" className="text-sm">
                  {viewingSession.focus_area}
                </Badge>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Notes
                </div>
                {viewingSession.notes ? (
                  <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">
                    {viewingSession.notes}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No notes recorded</p>
                )}
              </div>

              {/* Action Items */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckSquare className="h-4 w-4" />
                  Action Items
                </div>
                {viewingSession.action_items ? (
                  <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">
                    {viewingSession.action_items}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No action items recorded</p>
                )}
              </div>

              {/* Follow-up Date */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarClock className="h-4 w-4" />
                  Follow-up Date
                </div>
                {viewingSession.follow_up_date ? (
                  <p className="font-medium">
                    {format(new Date(viewingSession.follow_up_date), 'MMMM d, yyyy')}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No follow-up scheduled</p>
                )}
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setViewingSession(null);
                    startEdit(viewingSession);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Session
                </Button>
                <Button variant="outline" asChild className="flex-1">
                  <Link to={getRepDetailUrl(viewingSession.rep_id)}>
                    <User className="h-4 w-4 mr-2" />
                    View Rep
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}