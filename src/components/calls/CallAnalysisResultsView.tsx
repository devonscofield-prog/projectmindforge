import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CallAnalysis, CallTranscript, editRecapEmail } from '@/api/aiCallAnalysis';
import { 
  Copy,
  FileText,
  Mail,
  Target,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  Flame,
  Ear,
  Clock,
  HelpCircle,
  RefreshCw,
  Undo2,
  Loader2,
  Download,
  ChevronDown,
  Search
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface CallAnalysisResultsViewProps {
  call: CallTranscript | null;
  analysis: CallAnalysis | null;
  isOwner: boolean;  // Can edit notes/recap
  isManager: boolean; // Read-only view for managers
}

export function CallAnalysisResultsView({ call, analysis, isOwner, isManager }: CallAnalysisResultsViewProps) {
  const { toast } = useToast();
  
  // Recap email editing state (only for owners)
  const [recapDraft, setRecapDraft] = useState(analysis?.recap_email_draft || '');
  const [originalRecapDraft] = useState(analysis?.recap_email_draft || '');
  const [editInstructions, setEditInstructions] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  // Shared markdown components for recap email rendering
  const recapMarkdownComponents = {
    p: ({children}: {children?: React.ReactNode}) => <p className="mb-2">{children}</p>,
    a: ({href, children}: {href?: string; children?: React.ReactNode}) => (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="text-primary underline hover:text-primary/80"
      >
        {children}
      </a>
    ),
    ul: ({children}: {children?: React.ReactNode}) => <ul className="list-disc ml-6 mb-2">{children}</ul>,
    ol: ({children}: {children?: React.ReactNode}) => <ol className="list-decimal ml-6 mb-2">{children}</ol>,
    li: ({children}: {children?: React.ReactNode}) => <li className="mb-1">{children}</li>,
    strong: ({children}: {children?: React.ReactNode}) => <strong className="font-bold">{children}</strong>,
    em: ({children}: {children?: React.ReactNode}) => <em className="italic">{children}</em>,
  };

  // Convert markdown to HTML for rich text clipboard (Outlook compatibility)
  const convertMarkdownToHtml = (markdown: string): string => {
    return markdown
      // Convert markdown links [text](url) to HTML <a> tags
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // Convert bold **text** to <strong>
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Convert italic *text* to <em> (after bold to avoid conflicts)
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Convert newlines to <br> for proper line breaks in email
      .replace(/\n/g, '<br>');
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: `${label} copied to clipboard.` });
    } catch {
      toast({ title: 'Error', description: 'Failed to copy.', variant: 'destructive' });
    }
  };

  const handleRefineEmail = async () => {
    if (!editInstructions.trim() || !recapDraft.trim()) return;

    setIsRefining(true);
    try {
      const updatedDraft = await editRecapEmail(
        recapDraft,
        editInstructions,
        analysis?.call_summary
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

  const handleUndoEmail = () => {
    setRecapDraft(originalRecapDraft);
    toast({
      title: 'Restored',
      description: 'Email restored to original',
    });
  };

  if (!analysis) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            <div>
              <p className="text-muted-foreground">Analysis in progress...</p>
              {call?.analysis_status === 'processing' && (
                <p className="text-sm text-muted-foreground mt-2">Your call is being analyzed by AI. This usually takes 30-60 seconds.</p>
              )}
              {call?.analysis_status === 'pending' && (
                <p className="text-sm text-muted-foreground mt-2">Your call is queued for analysis.</p>
              )}
              {call?.analysis_status === 'error' && (
                <p className="text-sm text-destructive mt-2">Error: {call.analysis_error}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Call Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{analysis.call_summary}</p>
          
          {/* Confidence & Model Info */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
            {analysis.confidence !== null && (
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Confidence: {analysis.confidence}%</span>
              </div>
            )}
            <span className="text-xs text-muted-foreground">Model: {analysis.model_name}</span>
            <span className="text-xs text-muted-foreground">Version: {analysis.prompt_version}</span>
          </div>
        </CardContent>
      </Card>

      {/* AI Call Coach Section */}
      {analysis.coach_output ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              AI Call Coach (BANT / Gap Selling / Active Listening)
            </CardTitle>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Target className="h-4 w-4" />
                {analysis.coach_output.call_type || 'Unknown'}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {analysis.coach_output.duration_minutes ?? '-'} min
              </span>
              <span className="flex items-center gap-1">
                <Flame className="h-4 w-4 text-orange-500" />
                Heat Score: {analysis.coach_output.heat_signature?.score ?? '-'}/10
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Framework Scores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* BANT */}
              <div className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    BANT
                  </span>
                  <Badge variant={
                    (analysis.coach_output.framework_scores?.bant?.score ?? 0) >= 70 ? 'default' :
                    (analysis.coach_output.framework_scores?.bant?.score ?? 0) >= 50 ? 'secondary' : 'destructive'
                  }>
                    {analysis.coach_output.framework_scores?.bant?.score ?? '-'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {analysis.coach_output.framework_scores?.bant?.summary || 'No summary available'}
                </p>
              </div>

              {/* Gap Selling */}
              <div className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    Gap Selling
                  </span>
                  <Badge variant={
                    (analysis.coach_output.framework_scores?.gap_selling?.score ?? 0) >= 70 ? 'default' :
                    (analysis.coach_output.framework_scores?.gap_selling?.score ?? 0) >= 50 ? 'secondary' : 'destructive'
                  }>
                    {analysis.coach_output.framework_scores?.gap_selling?.score ?? '-'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {analysis.coach_output.framework_scores?.gap_selling?.summary || 'No summary available'}
                </p>
              </div>

              {/* Active Listening */}
              <div className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium flex items-center gap-2">
                    <Ear className="h-4 w-4 text-purple-500" />
                    Active Listening
                  </span>
                  <Badge variant={
                    (analysis.coach_output.framework_scores?.active_listening?.score ?? 0) >= 70 ? 'default' :
                    (analysis.coach_output.framework_scores?.active_listening?.score ?? 0) >= 50 ? 'secondary' : 'destructive'
                  }>
                    {analysis.coach_output.framework_scores?.active_listening?.score ?? '-'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {analysis.coach_output.framework_scores?.active_listening?.summary || 'No summary available'}
                </p>
              </div>
            </div>

            {/* Improvements Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* BANT Improvements */}
              {analysis.coach_output.bant_improvements && analysis.coach_output.bant_improvements.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    BANT Improvements
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {analysis.coach_output.bant_improvements.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-blue-500">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Gap Selling Improvements */}
              {analysis.coach_output.gap_selling_improvements && analysis.coach_output.gap_selling_improvements.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    Gap Selling Improvements
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {analysis.coach_output.gap_selling_improvements.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-green-500">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Active Listening Improvements */}
              {analysis.coach_output.active_listening_improvements && analysis.coach_output.active_listening_improvements.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Ear className="h-4 w-4 text-purple-500" />
                    Listening Improvements
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {analysis.coach_output.active_listening_improvements.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-purple-500">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Critical Info & Follow-up Questions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Critical Info Missing */}
              {analysis.coach_output.critical_info_missing && analysis.coach_output.critical_info_missing.length > 0 && (
                <div className="p-4 border border-destructive/30 bg-destructive/5 rounded-lg space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Critical Info Missing
                  </h4>
                  <ul className="space-y-3">
                    {analysis.coach_output.critical_info_missing.map((item, i) => {
                      // Handle both old (string) and new (object) formats
                      const isObject = typeof item === 'object' && item !== null;
                      const info = isObject ? item.info : item;
                      const missedOpportunity = isObject ? item.missed_opportunity : null;
                      
                      return (
                        <li key={i} className="space-y-1">
                          <div className="flex items-start gap-2 text-sm font-medium">
                            <span className="text-destructive">•</span>
                            {info}
                          </div>
                          {missedOpportunity && (
                            <p className="text-xs text-muted-foreground ml-4 pl-2 border-l-2 border-destructive/20 italic">
                              ⚠️ Missed opportunity: {missedOpportunity}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Follow-up Questions */}
              {analysis.coach_output.recommended_follow_up_questions && analysis.coach_output.recommended_follow_up_questions.length > 0 && (
                <div className="p-4 border border-primary/30 bg-primary/5 rounded-lg space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2 text-primary">
                    <HelpCircle className="h-4 w-4" />
                    Recommended Follow-up Questions
                  </h4>
                  <ul className="space-y-3">
                    {analysis.coach_output.recommended_follow_up_questions.map((item, i) => {
                      // Handle both old (string) and new (object) formats
                      const isObject = typeof item === 'object' && item !== null;
                      const question = isObject ? item.question : item;
                      const timingExample = isObject ? item.timing_example : null;
                      
                      return (
                        <li key={i} className="space-y-1">
                          <div className="flex items-start gap-2 text-sm font-medium">
                            <span className="text-primary">•</span>
                            {question}
                          </div>
                          {timingExample && (
                            <p className="text-xs text-muted-foreground ml-4 pl-2 border-l-2 border-primary/20 italic">
                              💡 Best moment: {timingExample}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            {/* Heat Signature Explanation */}
            {analysis.coach_output.heat_signature?.explanation && (
              <div className="p-4 border border-orange-500/30 bg-orange-500/5 rounded-lg">
                <h4 className="font-medium text-sm flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-2">
                  <Flame className="h-4 w-4" />
                  Heat Signature Analysis
                </h4>
                <p className="text-sm text-muted-foreground">
                  {analysis.coach_output.heat_signature.explanation}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              AI Coach output unavailable for this analysis version.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Trend Indicators */}
      {analysis.trend_indicators && Object.keys(analysis.trend_indicators).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Trend Indicators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(analysis.trend_indicators).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                  <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>
                  <span className="text-muted-foreground">{String(value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Call Notes - Visible to owner (editable) and manager (read-only) */}
      {analysis.call_notes && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Call Notes
              {isManager && <Badge variant="outline" className="ml-2">Read-only</Badge>}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => handleCopy(analysis.call_notes!, 'Call notes')}>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/30 rounded-lg p-4">
              <ReactMarkdown
                components={{
                  p: ({children}) => <p className="mb-2">{children}</p>,
                  ul: ({children}) => <ul className="list-disc ml-6 mb-2">{children}</ul>,
                  ol: ({children}) => <ol className="list-decimal ml-6 mb-2">{children}</ol>,
                  li: ({children}) => <li className="mb-1">{children}</li>,
                  h1: ({children}) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
                  h2: ({children}) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
                  h3: ({children}) => <h3 className="text-base font-bold mb-2">{children}</h3>,
                  strong: ({children}) => <strong className="font-bold">{children}</strong>,
                  em: ({children}) => <em className="italic">{children}</em>,
                }}
              >
                {analysis.call_notes}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recap Email - Owner can edit, Manager sees read-only */}
      {analysis.recap_email_draft && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Recap Email Draft
                {isManager && <Badge variant="outline" className="ml-2">Read-only</Badge>}
              </CardTitle>
              {isOwner && (
                <CardDescription className="mt-1">
                  Edit directly or use AI to refine your email
                </CardDescription>
              )}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={async () => {
                const markdown = isOwner ? recapDraft : analysis.recap_email_draft!;
                try {
                  const html = convertMarkdownToHtml(markdown);
                  const clipboardItem = new ClipboardItem({
                    'text/html': new Blob([html], { type: 'text/html' }),
                    'text/plain': new Blob([markdown], { type: 'text/plain' }),
                  });
                  await navigator.clipboard.write([clipboardItem]);
                  toast({ title: 'Copied', description: 'Recap email copied to clipboard.' });
                } catch {
                  // Fallback to plain text if HTML copy fails
                  await navigator.clipboard.writeText(markdown);
                  toast({ title: 'Copied', description: 'Recap email copied as plain text.' });
                }
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {isOwner ? (
              <>
                {/* Edit/Preview toggle */}
                <div className="flex items-center gap-2">
                  <Button 
                    variant={!showEmailPreview ? "secondary" : "ghost"} 
                    size="sm"
                    onClick={() => setShowEmailPreview(false)}
                  >
                    Edit
                  </Button>
                  <Button 
                    variant={showEmailPreview ? "secondary" : "ghost"} 
                    size="sm"
                    onClick={() => setShowEmailPreview(true)}
                  >
                    Preview
                  </Button>
                </div>

                {showEmailPreview ? (
                  /* Preview mode with rendered markdown and clickable links */
                  <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/30 rounded-lg p-4 min-h-[200px]">
                    <ReactMarkdown components={recapMarkdownComponents}>
                      {recapDraft}
                    </ReactMarkdown>
                  </div>
                ) : (
                  /* Edit mode with textarea */
                  <Textarea
                    value={recapDraft}
                    onChange={(e) => setRecapDraft(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                    placeholder="No recap email available"
                  />
                )}

                {recapDraft !== originalRecapDraft && (
                  <Button onClick={handleUndoEmail} variant="outline" size="sm">
                    <Undo2 className="mr-2 h-4 w-4" />
                    Undo Changes
                  </Button>
                )}

                {/* AI Refinement Section */}
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
              </>
            ) : (
              /* Read-only view for managers with rendered links */
              <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/30 rounded-lg p-4">
                <ReactMarkdown components={recapMarkdownComponents}>
                  {analysis.recap_email_draft}
                </ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Full Transcript Section */}
      <FullTranscriptSection call={call} />
    </div>
  );
}

// Separate component for transcript to avoid cluttering main component
function FullTranscriptSection({ call }: { call: CallTranscript | null }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [transcriptSearch, setTranscriptSearch] = useState('');

  const transcript = call?.raw_text || '';

  const transcriptStats = useMemo(() => {
    if (!transcript) return { words: 0, characters: 0 };
    const words = transcript.trim().split(/\s+/).filter(Boolean).length;
    return { words, characters: transcript.length };
  }, [transcript]);

  const highlightedTranscript = useMemo(() => {
    if (!transcriptSearch.trim() || !transcript) return null;
    
    const searchTerm = transcriptSearch.trim();
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = transcript.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-300 dark:bg-yellow-600 rounded px-0.5">{part}</mark>
      ) : (
        part
      )
    );
  }, [transcript, transcriptSearch]);

  const matchCount = useMemo(() => {
    if (!transcriptSearch.trim() || !transcript) return 0;
    const regex = new RegExp(transcriptSearch.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return (transcript.match(regex) || []).length;
  }, [transcript, transcriptSearch]);

  const handleCopyTranscript = async () => {
    try {
      await navigator.clipboard.writeText(transcript);
      toast({ title: 'Copied', description: 'Full transcript copied to clipboard.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to copy transcript.', variant: 'destructive' });
    }
  };

  const handleDownloadTranscript = () => {
    const accountName = call?.account_name || 'Unknown Account';
    const callDate = call?.call_date ? new Date(call.call_date).toISOString().split('T')[0] : 'unknown-date';
    const filename = `${accountName.replace(/[^a-z0-9]/gi, '_')}_${callDate}_transcript.txt`;
    
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({ title: 'Downloaded', description: `Transcript saved as ${filename}` });
  };

  if (!transcript) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader className="pb-3">
          <CollapsibleTrigger className="flex items-center justify-between w-full hover:bg-muted/50 -m-2 p-2 rounded-lg transition-colors">
            <CardTitle className="flex items-center gap-2 text-left">
              <FileText className="h-5 w-5" />
              Full Transcript
              <Badge variant="outline" className="ml-2">
                {transcriptStats.words.toLocaleString()} words
              </Badge>
            </CardTitle>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CardDescription>
            Complete word-for-word recording of the call
          </CardDescription>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Search and Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transcript..."
                  value={transcriptSearch}
                  onChange={(e) => setTranscriptSearch(e.target.value)}
                  className="pl-9"
                />
                {transcriptSearch && matchCount > 0 && (
                  <Badge variant="secondary" className="absolute right-2 top-1/2 -translate-y-1/2">
                    {matchCount} {matchCount === 1 ? 'match' : 'matches'}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyTranscript}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadTranscript}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>

            {/* Transcript Content */}
            <ScrollArea className="h-[500px] border rounded-lg">
              <div className="p-4">
                <pre className="whitespace-pre-wrap font-mono text-sm text-foreground leading-relaxed">
                  {highlightedTranscript || transcript}
                </pre>
              </div>
            </ScrollArea>

            {/* Stats Footer */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
              <span>{transcriptStats.words.toLocaleString()} words</span>
              <span>{transcriptStats.characters.toLocaleString()} characters</span>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
