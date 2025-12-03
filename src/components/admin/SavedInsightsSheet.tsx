import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { 
  fetchRecentSessionsForList, 
  fetchSessionById,
  deleteAnalysisSession, 
  type AnalysisSession,
  type AnalysisSessionListItem 
} from '@/api/analysisSessions';

const log = createLogger('SavedInsightsSheet');
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ReactMarkdown from 'react-markdown';
import {
  Lightbulb,
  Link,
  Trash2,
  Copy,
  Check,
  Calendar,
  Loader2,
  Users,
  Eye,
  Tag,
  History,
  MessageSquare,
  FileText,
} from 'lucide-react';

// Lightweight insight type for list views (excludes large content/chat_context)
interface SavedInsightListItem {
  id: string;
  title: string;
  tags: string[] | null;
  share_token: string | null;
  is_shared: boolean;
  created_at: string;
  admin_id: string;
  selection_id: string | null;
}

// Full insight type with content for detail view
interface SavedInsight extends SavedInsightListItem {
  content: string;
}

interface SavedInsightsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SavedInsightsSheet({
  open,
  onOpenChange,
}: SavedInsightsSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [viewInsightId, setViewInsightId] = useState<string | null>(null);
  const [viewSessionId, setViewSessionId] = useState<string | null>(null);

  // Fetch insights list - lightweight query excluding content
  const { data: insights, isLoading: isLoadingInsights } = useQuery({
    queryKey: ['admin-insights-list', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Selective column fetch - exclude large content and chat_context columns
      // Filter to user's own + shared insights, with pagination limit
      const { data, error } = await supabase
        .from('admin_chat_insights')
        .select('id, title, tags, share_token, is_shared, created_at, admin_id, selection_id')
        .or(`admin_id.eq.${user.id},is_shared.eq.true`)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as SavedInsightListItem[];
    },
    enabled: open && !!user?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch sessions list - lightweight query
  const { data: sessions, isLoading: isLoadingSessions } = useQuery({
    queryKey: ['analysis-sessions-list', user?.id],
    queryFn: () => {
      if (!user?.id) return [];
      return fetchRecentSessionsForList(user.id, 20);
    },
    enabled: open && !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch full insight when viewing details - filter to own or shared
  const { data: viewInsight, isLoading: isLoadingInsightDetail } = useQuery({
    queryKey: ['admin-insight-detail', viewInsightId, user?.id],
    queryFn: async () => {
      if (!viewInsightId || !user?.id) return null;
      
      const { data, error } = await supabase
        .from('admin_chat_insights')
        .select('*')
        .eq('id', viewInsightId)
        .or(`admin_id.eq.${user.id},is_shared.eq.true`)
        .maybeSingle();
      
      if (error) throw error;
      return data as SavedInsight | null;
    },
    enabled: !!viewInsightId && !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes - individual items rarely change
  });

  // Fetch full session when viewing details
  const { data: viewSession, isLoading: isLoadingSessionDetail } = useQuery({
    queryKey: ['analysis-session-detail', viewSessionId],
    queryFn: () => {
      if (!viewSessionId || !user?.id) return null;
      return fetchSessionById(viewSessionId, user.id);
    },
    enabled: !!viewSessionId && !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('admin_chat_insights')
        .delete()
        .eq('id', id)
        .eq('admin_id', user.id); // Defense in depth - only delete own insights
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-insights-list'] });
      toast.success('Insight deleted');
      setDeleteId(null);
    },
    onError: (error) => {
      log.error('Delete insight error', { error });
      toast.error('Failed to delete insight');
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const success = await deleteAnalysisSession(sessionId, user.id);
      if (!success) throw new Error('Failed to delete session');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis-sessions-list'] });
      toast.success('Session deleted');
      setDeleteSessionId(null);
    },
    onError: () => {
      toast.error('Failed to delete session');
    },
  });

  const copyShareUrl = (insight: SavedInsightListItem) => {
    if (!insight.share_token) return;
    
    const url = `${window.location.origin}/admin/transcripts?insight=${insight.share_token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(insight.id);
    toast.success('Share link copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Separate own vs shared insights
  const ownInsights = insights?.filter(s => s.admin_id === user?.id) || [];
  const sharedInsights = insights?.filter(s => s.admin_id !== user?.id && s.is_shared) || [];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Saved Analysis
            </SheetTitle>
            <SheetDescription>
              View saved insights and recent analysis sessions
            </SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="insights" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="insights" className="gap-1">
                <Lightbulb className="h-4 w-4" />
                Insights
              </TabsTrigger>
              <TabsTrigger value="sessions" className="gap-1">
                <History className="h-4 w-4" />
                Sessions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="insights" className="mt-4">
              {isLoadingInsights ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !insights?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No saved insights yet</p>
                  <p className="text-sm">Save insights from your chat conversations</p>
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-280px)]">
                  <div className="space-y-6 pr-4">
                    {/* Own Insights */}
                    {ownInsights.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground">
                          Your Insights
                        </h3>
                        <div className="space-y-2">
                          {ownInsights.map(insight => (
                            <InsightCard
                              key={insight.id}
                              insight={insight}
                              isOwn={true}
                              copiedId={copiedId}
                              onView={() => setViewInsightId(insight.id)}
                              onCopy={() => copyShareUrl(insight)}
                              onDelete={() => setDeleteId(insight.id)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Shared Insights */}
                    {sharedInsights.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Shared With You
                        </h3>
                        <div className="space-y-2">
                          {sharedInsights.map(insight => (
                            <InsightCard
                              key={insight.id}
                              insight={insight}
                              isOwn={false}
                              copiedId={copiedId}
                              onView={() => setViewInsightId(insight.id)}
                              onCopy={() => copyShareUrl(insight)}
                              onDelete={() => {}}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="sessions" className="mt-4">
              {isLoadingSessions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !sessions?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No analysis sessions yet</p>
                  <p className="text-sm">Your chat sessions are auto-saved here</p>
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-280px)]">
                  <div className="space-y-2 pr-4">
                    {sessions.map(session => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        onView={() => setViewSessionId(session.id)}
                        onDelete={() => setDeleteSessionId(session.id)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Delete Insight Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Insight?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this saved insight. This action cannot be undone.
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

      {/* Delete Session Confirmation */}
      <AlertDialog open={!!deleteSessionId} onOpenChange={() => setDeleteSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this analysis session. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSessionId && deleteSessionMutation.mutate(deleteSessionId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Insight Dialog */}
      <Dialog open={!!viewInsightId} onOpenChange={() => setViewInsightId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewInsight?.title || 'Loading...'}</DialogTitle>
          </DialogHeader>
          {isLoadingInsightDetail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : viewInsight ? (
            <div className="space-y-4">
              {viewInsight.tags && viewInsight.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {viewInsight.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="prose prose-sm dark:prose-invert max-w-none analysis-markdown">
                <ReactMarkdown>{viewInsight.content || ''}</ReactMarkdown>
              </div>
              <p className="text-xs text-muted-foreground">
                Saved on {format(new Date(viewInsight.created_at), 'MMMM d, yyyy')}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">Insight not found</p>
          )}
        </DialogContent>
      </Dialog>

      {/* View Session Dialog */}
      <Dialog open={!!viewSessionId} onOpenChange={() => setViewSessionId(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {viewSession?.title || 'Loading...'}
            </DialogTitle>
          </DialogHeader>
          {isLoadingSessionDetail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : viewSession ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Badge variant="outline" className="gap-1">
                  <FileText className="h-3 w-3" />
                  {viewSession.transcript_ids.length} transcripts
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {viewSession.messages.length} messages
                </Badge>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(viewSession.updated_at), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
              <ScrollArea className="h-[50vh]">
                <div className="space-y-4 pr-4">
                  {viewSession.messages.map((message, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg ${
                        message.role === 'user' 
                          ? 'bg-primary/10 ml-8' 
                          : 'bg-muted mr-8'
                      }`}
                    >
                      <p className="text-xs font-medium text-muted-foreground mb-1 uppercase">
                        {message.role}
                      </p>
                      <div className="prose prose-sm dark:prose-invert max-w-none analysis-markdown">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <p className="text-muted-foreground">Session not found</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface InsightCardProps {
  insight: SavedInsightListItem;
  isOwn: boolean;
  copiedId: string | null;
  onView: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

function InsightCard({
  insight,
  isOwn,
  copiedId,
  onView,
  onCopy,
  onDelete,
}: InsightCardProps) {
  return (
    <div className="rounded-lg border p-3 hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm truncate">{insight.title}</h4>
            {insight.is_shared && (
              <Badge variant="secondary" className="text-xs shrink-0">
                <Link className="h-3 w-3 mr-1" />
                Shared
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {insight.tags && insight.tags.length > 0 && (
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {insight.tags.length} tags
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(insight.created_at), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mt-3">
        <Button size="sm" onClick={onView} className="flex-1">
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
        {insight.is_shared && insight.share_token && (
          <Button size="sm" variant="outline" onClick={onCopy}>
            {copiedId === insight.id ? (
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

interface SessionCardProps {
  session: AnalysisSessionListItem;
  onView: () => void;
  onDelete: () => void;
}

function SessionCard({ session, onView, onDelete }: SessionCardProps) {
  return (
    <div className="rounded-lg border p-3 hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-sm truncate">
            {session.title || 'Untitled Session'}
          </h4>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <Badge variant="outline" className="gap-1">
              <FileText className="h-3 w-3" />
              {session.transcript_ids.length} transcripts
            </Badge>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(session.updated_at), 'MMM d')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <Button size="sm" onClick={onView} className="flex-1">
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
        <Button size="sm" variant="outline" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
