import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
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
import {
  FolderOpen,
  FileText,
  Link,
  Trash2,
  Copy,
  Check,
  Calendar,
  Loader2,
  Users,
} from 'lucide-react';

interface SavedSelection {
  id: string;
  name: string;
  description: string | null;
  transcript_ids: string[];
  filters: Json | null;
  share_token: string | null;
  is_shared: boolean;
  created_at: string;
  admin_id: string;
}

interface SavedSelectionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadSelection: (selection: SavedSelection) => void;
}

export function SavedSelectionsSheet({
  open,
  onOpenChange,
  onLoadSelection,
}: SavedSelectionsSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: selections, isLoading } = useQuery({
    queryKey: ['admin-saved-selections', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('admin_transcript_selections')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as SavedSelection[];
    },
    enabled: open && !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('admin_transcript_selections')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-saved-selections'] });
      toast.success('Selection deleted');
      setDeleteId(null);
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast.error('Failed to delete selection');
    },
  });

  const copyShareUrl = (selection: SavedSelection) => {
    if (!selection.share_token) return;
    
    const url = `${window.location.origin}/admin/transcripts?share=${selection.share_token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(selection.id);
    toast.success('Share link copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLoad = (selection: SavedSelection) => {
    onLoadSelection(selection);
    onOpenChange(false);
    toast.success(`Loaded "${selection.name}"`);
  };

  // Separate own vs shared selections
  const ownSelections = selections?.filter(s => s.admin_id === user?.id) || [];
  const sharedSelections = selections?.filter(s => s.admin_id !== user?.id && s.is_shared) || [];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              Saved Selections
            </SheetTitle>
            <SheetDescription>
              Load a previously saved transcript selection
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !selections?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No saved selections yet</p>
                <p className="text-sm">Save a selection to access it later</p>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="space-y-6 pr-4">
                  {/* Own Selections */}
                  {ownSelections.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Your Selections
                      </h3>
                      <div className="space-y-2">
                        {ownSelections.map(selection => (
                          <SelectionCard
                            key={selection.id}
                            selection={selection}
                            isOwn={true}
                            copiedId={copiedId}
                            onLoad={() => handleLoad(selection)}
                            onCopy={() => copyShareUrl(selection)}
                            onDelete={() => setDeleteId(selection.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Shared Selections */}
                  {sharedSelections.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Shared With You
                      </h3>
                      <div className="space-y-2">
                        {sharedSelections.map(selection => (
                          <SelectionCard
                            key={selection.id}
                            selection={selection}
                            isOwn={false}
                            copiedId={copiedId}
                            onLoad={() => handleLoad(selection)}
                            onCopy={() => copyShareUrl(selection)}
                            onDelete={() => {}}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selection?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this saved selection. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface SelectionCardProps {
  selection: SavedSelection;
  isOwn: boolean;
  copiedId: string | null;
  onLoad: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

function SelectionCard({
  selection,
  isOwn,
  copiedId,
  onLoad,
  onCopy,
  onDelete,
}: SelectionCardProps) {
  return (
    <div className="rounded-lg border p-3 hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm truncate">{selection.name}</h4>
            {selection.is_shared && (
              <Badge variant="secondary" className="text-xs shrink-0">
                <Link className="h-3 w-3 mr-1" />
                Shared
              </Badge>
            )}
          </div>
          {selection.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {selection.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {selection.transcript_ids.length} transcripts
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(selection.created_at), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mt-3">
        <Button size="sm" onClick={onLoad} className="flex-1">
          Load Selection
        </Button>
        {selection.is_shared && selection.share_token && (
          <Button size="sm" variant="outline" onClick={onCopy}>
            {copiedId === selection.id ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        )}
        {isOwn && (
          <Button size="sm" variant="outline" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
}
