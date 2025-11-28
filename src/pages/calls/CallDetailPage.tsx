import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { getCallWithAnalysis, CallAnalysis, CallTranscript } from '@/api/aiCallAnalysis';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Loader2, 
  ShieldAlert,
  Copy,
  FileText,
  Mail,
  Target,
  MessageSquare,
  Users,
  Package,
  TrendingUp,
  BarChart3,
  Tag,
  Lightbulb,
  AlertTriangle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

type CallSource = 'zoom' | 'teams' | 'dialer' | 'other';

const sourceLabels: Record<CallSource, string> = {
  zoom: 'Zoom',
  teams: 'Teams',
  dialer: 'Dialer',
  other: 'Other',
};

export default function CallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();

  const [transcript, setTranscript] = useState<CallTranscript | null>(null);
  const [analysis, setAnalysis] = useState<CallAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [notAuthorized, setNotAuthorized] = useState(false);

  useEffect(() => {
    async function loadCall() {
      if (!id || !user) return;

      setLoading(true);
      try {
        const result = await getCallWithAnalysis(id);
        
        if (!result) {
          toast({
            title: 'Call not found',
            description: 'The requested call could not be found.',
            variant: 'destructive',
          });
          navigate(-1);
          return;
        }

        // Role-based access check
        if (role === 'rep' && result.transcript.rep_id !== user.id) {
          setNotAuthorized(true);
          setLoading(false);
          return;
        }

        setTranscript(result.transcript);
        setAnalysis(result.analysis);
      } catch (error) {
        console.error('Error loading call:', error);
        toast({
          title: 'Error',
          description: 'Failed to load call details.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    loadCall();
  }, [id, user, role, navigate, toast]);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: `${label} copied to clipboard.` });
    } catch {
      toast({ title: 'Error', description: 'Failed to copy.', variant: 'destructive' });
    }
  };

  const getBackPath = () => {
    if (role === 'manager') return '/manager/coaching';
    return '/rep';
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (notAuthorized) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <ShieldAlert className="h-16 w-16 text-destructive" />
          <h1 className="text-2xl font-bold">Not Authorized</h1>
          <p className="text-muted-foreground">You are not authorized to view this call.</p>
          <Button onClick={() => navigate(getBackPath())}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Call History
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (!transcript) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <h1 className="text-2xl font-bold">Call Not Found</h1>
          <Button onClick={() => navigate(getBackPath())}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Call History
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(getBackPath())}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Call Details</h1>
              <p className="text-muted-foreground">
                Full AI coaching breakdown for this call
              </p>
            </div>
          </div>
        </div>

        {/* Call Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Call Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{format(new Date(transcript.call_date), 'MMMM d, yyyy')}</span>
              </div>
              <Badge variant="outline">{sourceLabels[transcript.source as CallSource]}</Badge>
              <Badge variant={transcript.analysis_status === 'completed' ? 'default' : 'secondary'}>
                {transcript.analysis_status}
              </Badge>
              {transcript.notes && (
                <span className="text-sm text-muted-foreground">Notes: {transcript.notes}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {analysis ? (
          <>
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

            {/* Scores Grid */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Scores</CardTitle>
                <CardDescription>AI-evaluated performance across key areas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <ScoreCard icon={Target} label="Discovery" score={analysis.discovery_score} />
                  <ScoreCard icon={MessageSquare} label="Objection Handling" score={analysis.objection_handling_score} />
                  <ScoreCard icon={Users} label="Rapport" score={analysis.rapport_communication_score} />
                  <ScoreCard icon={Package} label="Product Knowledge" score={analysis.product_knowledge_score} />
                  <ScoreCard icon={TrendingUp} label="Deal Advancement" score={analysis.deal_advancement_score} />
                  <ScoreCard icon={BarChart3} label="Effectiveness" score={analysis.call_effectiveness_score} highlight />
                </div>
              </CardContent>
            </Card>

            {/* Strengths & Opportunities */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Strengths */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-success">
                    <Lightbulb className="h-5 w-5" />
                    Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analysis.strengths && analysis.strengths.length > 0 ? (
                    <ul className="space-y-3">
                      {analysis.strengths.map((s, i) => (
                        <li key={i} className="flex gap-3 p-3 bg-success/5 rounded-lg border border-success/20">
                          <span className="text-success font-bold">{i + 1}.</span>
                          <div>
                            <p className="font-medium">{String(s.area || s.title || 'Strength')}</p>
                            <p className="text-sm text-muted-foreground">{String(s.detail || s.description || '')}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-sm">No strengths identified.</p>
                  )}
                </CardContent>
              </Card>

              {/* Opportunities */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-warning">
                    <AlertTriangle className="h-5 w-5" />
                    Opportunities for Improvement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analysis.opportunities && analysis.opportunities.length > 0 ? (
                    <ul className="space-y-3">
                      {analysis.opportunities.map((o, i) => (
                        <li key={i} className="flex gap-3 p-3 bg-warning/5 rounded-lg border border-warning/20">
                          <span className="text-warning font-bold">{i + 1}.</span>
                          <div>
                            <p className="font-medium">{String(o.area || o.title || 'Opportunity')}</p>
                            <p className="text-sm text-muted-foreground">{String(o.detail || o.description || '')}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-sm">No opportunities identified.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Deal Gaps */}
            {analysis.deal_gaps && Object.keys(analysis.deal_gaps).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Deal Gaps
                  </CardTitle>
                  <CardDescription>Areas that may block deal progression</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(analysis.deal_gaps).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center p-2 bg-destructive/5 rounded border border-destructive/20">
                        <span className="font-medium capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="text-sm text-muted-foreground">{String(value)}</span>
                      </div>
                    ))}
                  </div>
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

            {/* Tags */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysis.skill_tags && analysis.skill_tags.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Skill Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.skill_tags.map((tag, i) => (
                        <Badge key={i} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.deal_tags && analysis.deal_tags.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Deal Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.deal_tags.map((tag, i) => (
                        <Badge key={i} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.meta_tags && analysis.meta_tags.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Meta Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.meta_tags.map((tag, i) => (
                        <Badge key={i} variant="default">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {(!analysis.skill_tags?.length && !analysis.deal_tags?.length && !analysis.meta_tags?.length) && (
                  <p className="text-muted-foreground text-sm">No tags available.</p>
                )}
              </CardContent>
            </Card>

            {/* Call Notes */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Call Notes
                  </CardTitle>
                  {analysis.call_notes && (
                    <Button variant="outline" size="sm" onClick={() => handleCopy(analysis.call_notes!, 'Notes')}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                  )}
                </div>
                <CardDescription>AI-generated structured notes</CardDescription>
              </CardHeader>
              <CardContent>
                {analysis.call_notes ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{analysis.call_notes}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No call notes available.</p>
                )}
              </CardContent>
            </Card>

            {/* Recap Email */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Recap Email Draft
                  </CardTitle>
                  {analysis.recap_email_draft && (
                    <Button variant="outline" size="sm" onClick={() => handleCopy(analysis.recap_email_draft!, 'Email')}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                  )}
                </div>
                <CardDescription>Ready-to-send follow-up email</CardDescription>
              </CardHeader>
              <CardContent>
                {analysis.recap_email_draft ? (
                  <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap">
                    {analysis.recap_email_draft}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No recap email available.</p>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No analysis available for this call yet.</p>
              {transcript.analysis_status === 'processing' && (
                <p className="text-sm text-muted-foreground mt-2">Analysis is still processing...</p>
              )}
              {transcript.analysis_status === 'error' && (
                <p className="text-sm text-destructive mt-2">Error: {transcript.analysis_error}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

// Score card component
function ScoreCard({ 
  icon: Icon, 
  label, 
  score, 
  highlight = false 
}: { 
  icon: React.ComponentType<{ className?: string }>; 
  label: string; 
  score: number | null;
  highlight?: boolean;
}) {
  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className={`text-center p-4 rounded-lg ${highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted'}`}>
      <Icon className={`h-5 w-5 mx-auto mb-2 ${highlight ? 'text-primary' : 'text-muted-foreground'}`} />
      <div className={`text-2xl font-bold ${getScoreColor(score)}`}>
        {score !== null ? score : '-'}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}