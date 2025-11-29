import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Star,
  StarOff,
  Trash2,
  Pencil,
  Check,
  X,
  Calendar,
  BarChart3,
  Clock,
  Loader2,
  GitCompare,
} from 'lucide-react';
import {
  listCoachingTrendHistory,
  saveCoachingTrendSnapshot,
  removeFromSnapshots,
  deleteCoachingTrendAnalysis,
  updateSnapshotTitle,
  CoachingTrendHistoryItem,
} from '@/api/coachingTrendHistory';
import { CoachingTrendAnalysis } from '@/api/aiCallAnalysis';
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
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CoachingTrendHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repId: string;
  onLoadAnalysis: (analysis: CoachingTrendAnalysis, dateRange: { from: Date; to: Date }) => void;
  onCompareWithCurrent?: (analysis: CoachingTrendAnalysis, dateRange: { from: Date; to: Date }) => void;
  currentAnalysisId?: string;
  hasCurrentAnalysis?: boolean;
}

export function CoachingTrendHistorySheet({
  open,
  onOpenChange,
  repId,
  onLoadAnalysis,
  onCompareWithCurrent,
  currentAnalysisId,
  hasCurrentAnalysis = false,
}: CoachingTrendHistorySheetProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: history, isLoading } = useQuery({
    queryKey: ['coaching-trend-history', repId],
    queryFn: () => listCoachingTrendHistory(repId, { limit: 50 }),
    enabled: open && !!repId,
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title?: string }) =>
      saveCoachingTrendSnapshot(id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-trend-history', repId] });
      toast.success('Saved as snapshot');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeFromSnapshots,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-trend-history', repId] });
      toast.success('Removed from snapshots');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCoachingTrendAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-trend-history', repId] });
      toast.success('Analysis deleted');
      setDeleteConfirmId(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const updateTitleMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      updateSnapshotTitle(id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-trend-history', repId] });
      setEditingId(null);
      toast.success('Title updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const handleLoad = (item: CoachingTrendHistoryItem) => {
    const dateRange = {
      from: new Date(item.date_range_from),
      to: new Date(item.date_range_to),
    };
    onLoadAnalysis(item.analysis_data, dateRange);
    onOpenChange(false);
  };

  const handleCompare = (item: CoachingTrendHistoryItem) => {
    if (onCompareWithCurrent) {
      const dateRange = {
        from: new Date(item.date_range_from),
        to: new Date(item.date_range_to),
      };
      onCompareWithCurrent(item.analysis_data, dateRange);
      onOpenChange(false);
    }
  };

  const handleStartEdit = (item: CoachingTrendHistoryItem) => {
    setEditingId(item.id);
    setEditTitle(item.title || '');
  };

  const handleSaveTitle = () => {
    if (editingId && editTitle.trim()) {
      updateTitleMutation.mutate({ id: editingId, title: editTitle.trim() });
    }
  };

  const snapshots = history?.filter(h => h.is_snapshot) || [];
  const cached = history?.filter(h => !h.is_snapshot) || [];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Coaching Trends History
            </SheetTitle>
            <SheetDescription>
              View and load previously generated trend analyses. Save important ones as snapshots.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-10rem)] mt-4 pr-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32 mt-2" />
                      <Skeleton className="h-4 w-24 mt-1" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : !history || history.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No trend analyses yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Generate your first analysis to see it here
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Snapshots Section */}
                {snapshots.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      Saved Snapshots ({snapshots.length})
                    </h3>
                    <div className="space-y-2">
                      {snapshots.map(item => (
                        <HistoryCard
                          key={item.id}
                          item={item}
                          isCurrentAnalysis={item.id === currentAnalysisId}
                          isEditing={editingId === item.id}
                          editTitle={editTitle}
                          onEditTitleChange={setEditTitle}
                          onStartEdit={() => handleStartEdit(item)}
                          onSaveTitle={handleSaveTitle}
                          onCancelEdit={() => setEditingId(null)}
                          onLoad={() => handleLoad(item)}
                          onCompare={onCompareWithCurrent ? () => handleCompare(item) : undefined}
                          onToggleSnapshot={() => removeMutation.mutate(item.id)}
                          onDelete={() => setDeleteConfirmId(item.id)}
                          isSaving={saveMutation.isPending || removeMutation.isPending}
                          isUpdatingTitle={updateTitleMutation.isPending}
                          canCompare={hasCurrentAnalysis && item.id !== currentAnalysisId}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Cached Section */}
                {cached.length > 0 && (
                  <div>
                    {snapshots.length > 0 && <Separator className="my-4" />}
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Recent Analyses ({cached.length})
                    </h3>
                    <div className="space-y-2">
                      {cached.map(item => (
                        <HistoryCard
                          key={item.id}
                          item={item}
                          isCurrentAnalysis={item.id === currentAnalysisId}
                          isEditing={false}
                          editTitle=""
                          onEditTitleChange={() => {}}
                          onStartEdit={() => {}}
                          onSaveTitle={() => {}}
                          onCancelEdit={() => {}}
                          onLoad={() => handleLoad(item)}
                          onCompare={onCompareWithCurrent ? () => handleCompare(item) : undefined}
                          onToggleSnapshot={() => saveMutation.mutate({ id: item.id })}
                          onDelete={() => setDeleteConfirmId(item.id)}
                          isSaving={saveMutation.isPending || removeMutation.isPending}
                          isUpdatingTitle={false}
                          canCompare={hasCurrentAnalysis && item.id !== currentAnalysisId}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Analysis?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this coaching trend analysis. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface HistoryCardProps {
  item: CoachingTrendHistoryItem;
  isCurrentAnalysis: boolean;
  isEditing: boolean;
  editTitle: string;
  onEditTitleChange: (value: string) => void;
  onStartEdit: () => void;
  onSaveTitle: () => void;
  onCancelEdit: () => void;
  onLoad: () => void;
  onCompare?: () => void;
  onToggleSnapshot: () => void;
  onDelete: () => void;
  isSaving: boolean;
  isUpdatingTitle: boolean;
  canCompare?: boolean;
}

function HistoryCard({
  item,
  isCurrentAnalysis,
  isEditing,
  editTitle,
  onEditTitleChange,
  onStartEdit,
  onSaveTitle,
  onCancelEdit,
  onLoad,
  onCompare,
  onToggleSnapshot,
  onDelete,
  isSaving,
  isUpdatingTitle,
  canCompare,
}: HistoryCardProps) {
  const fromDate = new Date(item.date_range_from);
  const toDate = new Date(item.date_range_to);
  const createdAt = new Date(item.created_at);

  return (
    <Card className={cn(
      "transition-colors",
      isCurrentAnalysis && "border-primary/50 bg-primary/5"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Title / Date Range */}
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editTitle}
                  onChange={(e) => onEditTitleChange(e.target.value)}
                  placeholder="Enter a title..."
                  className="h-8 text-sm"
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={onSaveTitle}
                  disabled={isUpdatingTitle}
                >
                  {isUpdatingTitle ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={onCancelEdit}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {item.is_snapshot && item.title ? (
                  <p className="font-medium text-sm truncate">{item.title}</p>
                ) : (
                  <p className="font-medium text-sm flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {format(fromDate, 'MMM d')} - {format(toDate, 'MMM d, yyyy')}
                  </p>
                )}
                {item.is_snapshot && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={onStartEdit}
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </Button>
                )}
                {isCurrentAnalysis && (
                  <Badge variant="outline" className="text-xs">Current</Badge>
                )}
              </div>
            )}

            {/* Metadata */}
            {!isEditing && item.is_snapshot && item.title && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(fromDate, 'MMM d')} - {format(toDate, 'MMM d, yyyy')}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                {item.call_count} calls
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(createdAt, { addSuffix: true })}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {canCompare && onCompare && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={onCompare}
                      title="Compare with current"
                    >
                      <GitCompare className="h-4 w-4 text-muted-foreground hover:text-primary" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Compare with current analysis</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={onToggleSnapshot}
              disabled={isSaving}
              title={item.is_snapshot ? 'Remove from snapshots' : 'Save as snapshot'}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : item.is_snapshot ? (
                <StarOff className="h-4 w-4 text-yellow-500" />
              ) : (
                <Star className="h-4 w-4 text-muted-foreground hover:text-yellow-500" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={onLoad}
              disabled={isCurrentAnalysis}
            >
              Load
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
