import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  createCallTranscriptAndAnalyze, 
  listCallTranscriptsForRep, 
  getAnalysisForCall, 
  editRecapEmail,
  CallAnalysis,
  CallTranscript 
} from '@/api/aiCallAnalysis';
import { format } from 'date-fns';
import { 
  Plus, 
  FileText, 
  Mail, 
  Copy, 
  RefreshCw, 
  Undo2, 
  History, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Loader2,
  Eye
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

type CallSource = 'zoom' | 'teams' | 'dialer' | 'other';

export function CallCoachingSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [transcript, setTranscript] = useState('');
  const [callDate, setCallDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [source, setSource] = useState<CallSource>('zoom');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Analysis display state
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<CallAnalysis | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

  // Recap email editing state
  const [recapDraft, setRecapDraft] = useState('');
  const [originalRecapDraft, setOriginalRecapDraft] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  // Fetch transcripts for history
  const { data: transcripts = [], isLoading: isLoadingTranscripts, refetch: refetchTranscripts } = useQuery({
    queryKey: ['rep-transcripts', user?.id],
    queryFn: () => listCallTranscriptsForRep(user!.id),
    enabled: !!user?.id,
  });

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !transcript.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await createCallTranscriptAndAnalyze({
        repId: user.id,
        callDate,
        source,
        rawText: transcript,
        notes: notes || undefined,
      });

      toast({
        title: 'Call submitted for analysis',
        description: 'Your call transcript is being analyzed by AI.',
      });

      // Clear form
      setTranscript('');
      setNotes('');
      setCallDate(format(new Date(), 'yyyy-MM-dd'));

      // Refetch transcripts
      await refetchTranscripts();

      // If analysis completed, load it
      if (result.analyzeResponse?.analysis_id) {
        await loadAnalysis(result.transcript.id);
      } else {
        setSelectedCallId(result.transcript.id);
        // Poll for completion
        pollForAnalysis(result.transcript.id);
      }
    } catch (error) {
      console.error('Error submitting call:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit call for analysis',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Poll for analysis completion
  const pollForAnalysis = async (callId: string) => {
    const maxAttempts = 30;
    let attempts = 0;

    const poll = async () => {
      attempts++;
      const analysis = await getAnalysisForCall(callId);
      
      if (analysis) {
        setCurrentAnalysis(analysis);
        setRecapDraft(analysis.recap_email_draft || '');
        setOriginalRecapDraft(analysis.recap_email_draft || '');
        await refetchTranscripts();
        toast({
          title: 'Analysis complete',
          description: 'Your call has been analyzed.',
        });
        return;
      }

      if (attempts < maxAttempts) {
        setTimeout(poll, 2000);
      } else {
        toast({
          title: 'Analysis taking longer than expected',
          description: 'Please check back in a moment.',
          variant: 'destructive',
        });
      }
    };

    poll();
  };

  // Load analysis for a specific call
  const loadAnalysis = async (callId: string) => {
    setIsLoadingAnalysis(true);
    setSelectedCallId(callId);
    try {
      const analysis = await getAnalysisForCall(callId);
      setCurrentAnalysis(analysis);
      if (analysis) {
        setRecapDraft(analysis.recap_email_draft || '');
        setOriginalRecapDraft(analysis.recap_email_draft || '');
      }
    } catch (error) {
      console.error('Error loading analysis:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analysis',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  // Handle recap email refinement
  const handleRefineEmail = async () => {
    if (!editInstructions.trim() || !recapDraft.trim()) return;

    setIsRefining(true);
    try {
      const updatedDraft = await editRecapEmail(
        recapDraft,
        editInstructions,
        currentAnalysis?.call_summary
      );
      setRecapDraft(updatedDraft);
      setEditInstructions('');
      toast({
        title: 'Email refined',
        description: 'Your recap email has been updated.',
      });
    } catch (error) {
      console.error('Error refining email:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to refine email',
        variant: 'destructive',
      });
    } finally {
      setIsRefining(false);
    }
  };

  // Copy email to clipboard
  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(recapDraft);
      toast({
        title: 'Copied',
        description: 'Email copied to clipboard',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  // Undo email changes
  const handleUndoEmail = () => {
    setRecapDraft(originalRecapDraft);
    toast({
      title: 'Restored',
      description: 'Email restored to original',
    });
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" /> Completed</Badge>;
      case 'processing':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Processing</Badge>;
      case 'error':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Error</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
    }
  };

  const sourceLabels: Record<CallSource, string> = {
    zoom: 'Zoom',
    teams: 'Teams',
    dialer: 'Dialer',
    other: 'Other',
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="new" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="new" className="gap-2">
            <Plus className="h-4 w-4" /> New Analysis
          </TabsTrigger>
          <TabsTrigger value="results" className="gap-2" disabled={!currentAnalysis}>
            <FileText className="h-4 w-4" /> Results
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" /> History
          </TabsTrigger>
        </TabsList>

        {/* New Call Analysis Form */}
        <TabsContent value="new" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Submit Call for AI Analysis</CardTitle>
              <CardDescription>
                Paste your call transcript and get AI-generated notes and a recap email draft.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="callDate">Call Date</Label>
                    <Input
                      id="callDate"
                      type="date"
                      value={callDate}
                      onChange={(e) => setCallDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source">Source</Label>
                    <Select value={source} onValueChange={(v) => setSource(v as CallSource)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zoom">Zoom</SelectItem>
                        <SelectItem value="teams">Teams</SelectItem>
                        <SelectItem value="dialer">Dialer</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transcript">Call Transcript *</Label>
                  <Textarea
                    id="transcript"
                    placeholder="Paste your full call transcript here..."
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Internal Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any additional context or notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>

                <Button type="submit" disabled={isSubmitting || !transcript.trim()} className="w-full">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Submit for Analysis
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analysis Results */}
        <TabsContent value="results" className="space-y-4">
          {isLoadingAnalysis ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : currentAnalysis ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Call Notes */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Call Notes
                  </CardTitle>
                  <CardDescription>
                    AI-generated structured notes from your call
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none max-h-[500px] overflow-y-auto">
                    {currentAnalysis.call_notes ? (
                      <ReactMarkdown>{currentAnalysis.call_notes}</ReactMarkdown>
                    ) : (
                      <p className="text-muted-foreground">No call notes available.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recap Email */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Recap Email Draft
                  </CardTitle>
                  <CardDescription>
                    Ready-to-send follow-up email
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={recapDraft}
                    onChange={(e) => setRecapDraft(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                    placeholder="No recap email available"
                  />

                  <div className="flex gap-2">
                    <Button onClick={handleCopyEmail} variant="default" className="flex-1">
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Email
                    </Button>
                    {recapDraft !== originalRecapDraft && (
                      <Button onClick={handleUndoEmail} variant="outline">
                        <Undo2 className="mr-2 h-4 w-4" />
                        Undo
                      </Button>
                    )}
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <Label htmlFor="editInstructions">Refine with AI</Label>
                    <Input
                      id="editInstructions"
                      placeholder="e.g., Make it shorter, more formal, emphasize the demo..."
                      value={editInstructions}
                      onChange={(e) => setEditInstructions(e.target.value)}
                    />
                    <Button 
                      onClick={handleRefineEmail} 
                      disabled={isRefining || !editInstructions.trim()}
                      variant="secondary"
                      className="w-full"
                    >
                      {isRefining ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Refining...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Refine Email
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Summary Card */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Analysis Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{currentAnalysis.call_summary}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{currentAnalysis.discovery_score ?? '-'}</div>
                      <div className="text-xs text-muted-foreground">Discovery</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{currentAnalysis.objection_handling_score ?? '-'}</div>
                      <div className="text-xs text-muted-foreground">Objections</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{currentAnalysis.rapport_communication_score ?? '-'}</div>
                      <div className="text-xs text-muted-foreground">Rapport</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{currentAnalysis.product_knowledge_score ?? '-'}</div>
                      <div className="text-xs text-muted-foreground">Product</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{currentAnalysis.deal_advancement_score ?? '-'}</div>
                      <div className="text-xs text-muted-foreground">Advancement</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">{currentAnalysis.call_effectiveness_score ?? '-'}</div>
                      <div className="text-xs text-muted-foreground">Effectiveness</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-48 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No analysis selected. Submit a new call or select from history.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Call History</CardTitle>
              <CardDescription>
                Your previous call analyses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTranscripts ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : transcripts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No calls submitted yet. Submit your first call for analysis!
                </p>
              ) : (
                <div className="space-y-3">
                  {transcripts.map((t) => (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                        selectedCallId === t.id ? 'border-primary bg-muted/50' : 'hover:bg-muted/30'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {format(new Date(t.call_date), 'MMM d, yyyy')}
                          </span>
                          <Badge variant="outline">{sourceLabels[t.source as CallSource]}</Badge>
                          {getStatusBadge(t.analysis_status)}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {t.raw_text.substring(0, 100)}...
                        </p>
                      </div>
                      {t.analysis_status === 'completed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => loadAnalysis(t.id)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
