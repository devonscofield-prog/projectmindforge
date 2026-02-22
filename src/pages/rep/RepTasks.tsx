import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getAccountDetailUrl } from '@/lib/routes';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SwipeableCard } from '@/components/ui/swipeable-card';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCompleteFollowUp, useDismissFollowUp, useRestoreFollowUp, useReopenFollowUp } from '@/hooks/useFollowUpMutations';
import { lazy, Suspense } from 'react';
const EditTaskDialog = lazy(() => import('@/components/tasks/EditTaskDialog').then(m => ({ default: m.EditTaskDialog })));
const StandaloneTaskDialog = lazy(() => import('@/components/tasks/StandaloneTaskDialog').then(m => ({ default: m.StandaloneTaskDialog })));
import { BulkActionBar } from '@/components/tasks/BulkActionBar';
const BulkRescheduleDialog = lazy(() => import('@/components/tasks/BulkRescheduleDialog').then(m => ({ default: m.BulkRescheduleDialog })));
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
import { TaskTemplatesSection } from '@/components/tasks/TaskTemplatesSection';
import { TaskInsightsSection } from '@/components/tasks/TaskInsightsSection';
import {
  Target,
  Plus,
  CheckCircle2,
  Loader2,
  Building2,
  X,
  Pencil,
  RotateCcw,
  AlertTriangle,
  Calendar as CalendarIcon,
  Inbox,
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { toast } from 'sonner';

import {
  listManualPendingFollowUpsForRep,
  listAllFollowUpsForRepByStatus,
  bulkCompleteFollowUps,
  bulkDismissFollowUps,
  bulkRescheduleFollowUps,
  type AccountFollowUpWithProspect,
  type FollowUpPriority,
  type FollowUpCategory,
} from '@/api/accountFollowUps';
import { PRIORITY_CONFIG, CATEGORY_LABELS } from '@/lib/taskConstants';

const priorityConfig = PRIORITY_CONFIG;
const categoryLabels = CATEGORY_LABELS;

function formatDueDate(dueDate: string): { text: string; isOverdue: boolean; isDueToday: boolean } {
  const date = parseISO(dueDate);
  if (isPast(date) && !isToday(date)) {
    return { text: 'Overdue', isOverdue: true, isDueToday: false };
  }
  if (isToday(date)) {
    return { text: 'Due today', isOverdue: false, isDueToday: true };
  }
  if (isTomorrow(date)) {
    return { text: 'Due tomorrow', isOverdue: false, isDueToday: false };
  }
  return { text: `Due ${format(date, 'MMM d')}`, isOverdue: false, isDueToday: false };
}

function RepTasks() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('pending');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('due_date');
  const [confirmDismissItem, setConfirmDismissItem] = useState<AccountFollowUpWithProspect | null>(null);
  const [editTask, setEditTask] = useState<AccountFollowUpWithProspect | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkReschedule, setShowBulkReschedule] = useState(false);
  const [confirmBulkDismiss, setConfirmBulkDismiss] = useState(false);
  const [bulkActioning, setBulkActioning] = useState(false);

  const repId = user?.id || '';

  // Queries
  const { data: pendingTasks = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['rep-tasks', repId, 'pending'],
    queryFn: () => listManualPendingFollowUpsForRep(repId),
    enabled: !!repId,
    staleTime: 30_000,
  });

  const { data: completedTasks = [], isLoading: completedLoading } = useQuery({
    queryKey: ['rep-tasks', repId, 'completed'],
    queryFn: () => listAllFollowUpsForRepByStatus(repId, 'completed'),
    enabled: !!repId && activeTab === 'completed',
    staleTime: 60_000,
  });

  const { data: dismissedTasks = [], isLoading: dismissedLoading } = useQuery({
    queryKey: ['rep-tasks', repId, 'dismissed'],
    queryFn: () => listAllFollowUpsForRepByStatus(repId, 'dismissed'),
    enabled: !!repId && activeTab === 'dismissed',
    staleTime: 60_000,
  });

  // Mutations
  const completeMutation = useCompleteFollowUp();
  const dismissMutation = useDismissFollowUp();
  const restoreMutation = useRestoreFollowUp();
  const reopenMutation = useReopenFollowUp();

  // Stats
  const overdueTasks = pendingTasks.filter(t => t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date)));
  const dueTodayTasks = pendingTasks.filter(t => t.due_date && isToday(parseISO(t.due_date)));

  // Filtered and sorted pending tasks
  const filteredPending = pendingTasks
    .filter(t => priorityFilter === 'all' || t.priority === priorityFilter)
    .filter(t => categoryFilter === 'all' || t.category === categoryFilter)
    .sort((a, b) => {
      if (sortBy === 'due_date') {
        const aHas = !!a.due_date;
        const bHas = !!b.due_date;
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        if (aHas && bHas) return new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime();
        return 0;
      }
      if (sortBy === 'priority') {
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (order[a.priority as string] ?? 2) - (order[b.priority as string] ?? 2);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['rep-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['manual-follow-ups'] });
    queryClient.invalidateQueries({ queryKey: ['all-follow-ups'] });
  };

  const handleComplete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    completeMutation.mutate(id, { onSettled: invalidateAll });
  };

  const handleDismissClick = (task: AccountFollowUpWithProspect, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDismissItem(task);
  };

  const handleConfirmDismiss = () => {
    if (!confirmDismissItem) return;
    dismissMutation.mutate(confirmDismissItem.id, { onSettled: invalidateAll });
    setConfirmDismissItem(null);
  };

  const handleRestore = (id: string) => {
    restoreMutation.mutate(id, { onSettled: invalidateAll });
  };

  const handleReopen = (id: string) => {
    reopenMutation.mutate(id, { onSettled: invalidateAll });
  };

  const handleNavigate = (prospectId: string) => {
    navigate(getAccountDetailUrl(role, prospectId));
  };

  // -- Bulk actions --
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPending.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPending.map(t => t.id)));
    }
  };

  const handleBulkComplete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkActioning(true);
    try {
      await bulkCompleteFollowUps(ids);
      toast.success(`${ids.length} task${ids.length !== 1 ? 's' : ''} completed`);
      setSelectedIds(new Set());
      invalidateAll();
    } catch {
      toast.error('Failed to complete tasks');
    } finally {
      setBulkActioning(false);
    }
  };

  const handleBulkDismissConfirm = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkActioning(true);
    try {
      await bulkDismissFollowUps(ids);
      toast.success(`${ids.length} task${ids.length !== 1 ? 's' : ''} dismissed`);
      setSelectedIds(new Set());
      setConfirmBulkDismiss(false);
      invalidateAll();
    } catch {
      toast.error('Failed to dismiss tasks');
    } finally {
      setBulkActioning(false);
    }
  };

  const handleBulkReschedule = async (dueDate: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkActioning(true);
    try {
      await bulkRescheduleFollowUps(ids, dueDate);
      toast.success(`${ids.length} task${ids.length !== 1 ? 's' : ''} rescheduled`);
      setSelectedIds(new Set());
      setShowBulkReschedule(false);
      invalidateAll();
    } catch {
      toast.error('Failed to reschedule tasks');
    } finally {
      setBulkActioning(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Tasks</h1>
            <p className="text-muted-foreground text-sm">Manage your follow-up tasks</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overdueTasks.length}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <CalendarIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dueTodayTasks.length}</p>
                <p className="text-xs text-muted-foreground">Due Today</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingTasks.length}</p>
                <p className="text-xs text-muted-foreground">Total Pending</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending">Pending ({pendingTasks.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
            <TabsTrigger value="auto-tasks">Auto Tasks</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="phone_call">Phone Call</SelectItem>
                  <SelectItem value="drip_email">DRIP Email</SelectItem>
                  <SelectItem value="text_message">Text Message</SelectItem>
                  <SelectItem value="follow_up_email">Follow Up Email</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="due_date">Due Date</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="created">Created</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bulk action bar */}
            <BulkActionBar
              selectedCount={selectedIds.size}
              onComplete={handleBulkComplete}
              onDismiss={() => setConfirmBulkDismiss(true)}
              onReschedule={() => setShowBulkReschedule(true)}
              onClearSelection={() => setSelectedIds(new Set())}
              isActioning={bulkActioning}
            />

            {/* Select all toggle */}
            {filteredPending.length > 0 && !pendingLoading && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === filteredPending.length && filteredPending.length > 0}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
                <span className="text-xs text-muted-foreground">
                  Select all ({filteredPending.length})
                </span>
              </div>
            )}

            {pendingLoading ? (
              <TaskListSkeleton />
            ) : filteredPending.length === 0 ? (
              <EmptyState icon={CheckCircle2} message="No pending tasks" description="Create a task to get started" />
            ) : (
              <div className="space-y-2">
                {filteredPending.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    variant="pending"
                    isMobile={isMobile}
                    selected={selectedIds.has(task.id)}
                    onToggleSelect={() => toggleSelect(task.id)}
                    onComplete={(id, e) => handleComplete(id, e)}
                    onDismissClick={(t, e) => handleDismissClick(t, e)}
                    onEdit={(t) => setEditTask(t)}
                    onNavigate={handleNavigate}
                    isActioning={
                      (completeMutation.isPending && completeMutation.variables === task.id) ||
                      (dismissMutation.isPending && dismissMutation.variables === task.id)
                    }
                    onSwipeComplete={() => completeMutation.mutate(task.id, { onSettled: invalidateAll })}
                    onSwipeDismiss={() => dismissMutation.mutate(task.id, { onSettled: invalidateAll })}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed">
            {completedLoading ? (
              <TaskListSkeleton />
            ) : completedTasks.length === 0 ? (
              <EmptyState icon={Inbox} message="No completed tasks yet" />
            ) : (
              <div className="space-y-2">
                {completedTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    variant="completed"
                    isMobile={isMobile}
                    onReopen={handleReopen}
                    onNavigate={handleNavigate}
                    isActioning={reopenMutation.isPending && reopenMutation.variables === task.id}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="dismissed">
            {dismissedLoading ? (
              <TaskListSkeleton />
            ) : dismissedTasks.length === 0 ? (
              <EmptyState icon={Inbox} message="No dismissed tasks" />
            ) : (
              <div className="space-y-2">
                {dismissedTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    variant="dismissed"
                    isMobile={isMobile}
                    onRestore={handleRestore}
                    onNavigate={handleNavigate}
                    isActioning={restoreMutation.isPending && restoreMutation.variables === task.id}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="auto-tasks">
            <TaskTemplatesSection />
          </TabsContent>

          <TabsContent value="insights">
            <TaskInsightsSection />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      {showCreateDialog && (
        <Suspense fallback={null}>
          <StandaloneTaskDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            repId={repId}
            onTaskCreated={invalidateAll}
          />
        </Suspense>
      )}

      {editTask && (
        <Suspense fallback={null}>
          <EditTaskDialog
            open={!!editTask}
            onOpenChange={(open) => !open && setEditTask(null)}
            task={editTask}
            accountName={editTask.account_name || editTask.prospect_name}
          />
        </Suspense>
      )}

      <AlertDialog open={!!confirmDismissItem} onOpenChange={(open) => !open && setConfirmDismissItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss Task?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to dismiss "{confirmDismissItem?.title}"? You can restore it later from the Dismissed tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDismiss} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Dismiss
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk dismiss confirmation */}
      <AlertDialog open={confirmBulkDismiss} onOpenChange={setConfirmBulkDismiss}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss {selectedIds.size} task{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              These tasks will be moved to the Dismissed tab. You can restore them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDismissConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Dismiss All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk reschedule dialog */}
      {showBulkReschedule && (
        <Suspense fallback={null}>
          <BulkRescheduleDialog
            open={showBulkReschedule}
            onOpenChange={setShowBulkReschedule}
            count={selectedIds.size}
            onConfirm={handleBulkReschedule}
            isPending={bulkActioning}
          />
        </Suspense>
      )}
    </AppLayout>
  );
}

// --- Sub-components ---

interface TaskRowProps {
  task: AccountFollowUpWithProspect;
  variant: 'pending' | 'completed' | 'dismissed';
  isMobile: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onComplete?: (id: string, e?: React.MouseEvent) => void;
  onDismissClick?: (task: AccountFollowUpWithProspect, e: React.MouseEvent) => void;
  onEdit?: (task: AccountFollowUpWithProspect) => void;
  onRestore?: (id: string) => void;
  onReopen?: (id: string) => void;
  onNavigate: (prospectId: string) => void;
  isActioning: boolean;
  onSwipeComplete?: () => void;
  onSwipeDismiss?: () => void;
}

function TaskRow({
  task, variant, isMobile,
  selected, onToggleSelect,
  onComplete, onDismissClick, onEdit, onRestore, onReopen,
  onNavigate, isActioning,
  onSwipeComplete, onSwipeDismiss,
}: TaskRowProps) {
  const priorityKey = (task.priority as FollowUpPriority) || 'medium';
  const priority = priorityConfig[priorityKey] || priorityConfig.medium;
  const accountDisplay = task.account_name || task.prospect_name;
  const dueDateInfo = task.due_date ? formatDueDate(task.due_date) : null;
  const isOverdue = dueDateInfo?.isOverdue ?? false;

  const content = (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors group ${isOverdue ? 'border-l-4 border-l-destructive' : ''} ${selected ? 'ring-2 ring-primary/30 bg-primary/5' : ''}`}
      onClick={() => onNavigate(task.prospect_id)}
    >
      {/* Selection checkbox */}
      {variant === 'pending' && onToggleSelect && (
        <Checkbox
          checked={!!selected}
          onCheckedChange={() => onToggleSelect()}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${task.title}`}
          className="shrink-0"
        />
      )}

      {/* Action buttons */}
      {variant === 'pending' && !isMobile && onComplete && (
        <Button size="sm" variant="outline" className="h-8 w-8 p-0 shrink-0 border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 hover:text-green-700 dark:hover:text-green-300"
          onClick={(e) => onComplete(task.id, e)} disabled={isActioning}
        >
          {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        </Button>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Badge variant="secondary" className={`${priority.className} text-[10px] px-1.5 py-0`}>
            {priority.label}
          </Badge>
          {task.category && categoryLabels[task.category as FollowUpCategory] && (
            <span className="text-[10px] text-muted-foreground">
              {categoryLabels[task.category as FollowUpCategory]}
            </span>
          )}
          {dueDateInfo && (
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
              dueDateInfo.isOverdue ? 'bg-destructive/10 text-destructive border-destructive/20'
                : dueDateInfo.isDueToday ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200'
                : 'bg-muted text-muted-foreground'
            }`}>
              {dueDateInfo.text}
            </Badge>
          )}
          {variant === 'completed' && task.completed_at && (
            <span className="text-[10px] text-muted-foreground">
              Completed {format(parseISO(task.completed_at), 'MMM d')}
            </span>
          )}
        </div>
        <p className={`text-sm font-medium truncate ${variant !== 'pending' ? 'line-through text-muted-foreground' : ''}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{task.description}</p>
        )}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <Building2 className="h-3 w-3" />
          <span className="truncate hover:underline" onClick={(e) => { e.stopPropagation(); onNavigate(task.prospect_id); }}>
            {accountDisplay}
          </span>
        </div>
      </div>

      {/* Right actions */}
      {variant === 'pending' && !isMobile && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
              onClick={(e) => { e.stopPropagation(); onEdit(task); }} title="Edit"
            >
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
          {onDismissClick && (
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={(e) => onDismissClick(task, e)} disabled={isActioning} title="Dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {variant === 'completed' && onReopen && (
        <Button size="sm" variant="ghost" className="shrink-0"
          onClick={(e) => { e.stopPropagation(); onReopen(task.id); }} disabled={isActioning}
        >
          {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RotateCcw className="h-4 w-4 mr-1" /> Reopen</>}
        </Button>
      )}

      {variant === 'dismissed' && onRestore && (
        <Button size="sm" variant="ghost" className="shrink-0"
          onClick={(e) => { e.stopPropagation(); onRestore(task.id); }} disabled={isActioning}
        >
          {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RotateCcw className="h-4 w-4 mr-1" /> Restore</>}
        </Button>
      )}
    </div>
  );

  if (isMobile && variant === 'pending' && onSwipeComplete && onSwipeDismiss) {
    return (
      <SwipeableCard
        onSwipeRight={onSwipeComplete}
        onSwipeLeft={onSwipeDismiss}
        rightAction={{ label: 'Complete', icon: CheckCircle2, bgColor: 'bg-success', color: 'text-success-foreground' }}
        leftAction={{ label: 'Dismiss', icon: X, bgColor: 'bg-muted', color: 'text-muted-foreground' }}
        disabled={isActioning}
      >
        {content}
      </SwipeableCard>
    );
  }

  return content;
}

function EmptyState({ icon: Icon, message, description }: { icon: React.ElementType; message: string; description?: string }) {
  return (
    <div className="text-center py-12">
      <Icon className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      {description && <p className="text-xs text-muted-foreground/70 mt-1">{description}</p>}
    </div>
  );
}

function TaskListSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-20 rounded-lg border bg-muted/30 animate-pulse" />
      ))}
    </div>
  );
}

export default RepTasks;
