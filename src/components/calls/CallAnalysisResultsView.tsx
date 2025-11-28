import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CallAnalysis, CallTranscript } from '@/api/aiCallAnalysis';
import { 
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
  AlertTriangle,
  Flame,
  Ear,
  Clock,
  HelpCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface CallAnalysisResultsViewProps {
  call: CallTranscript | null;
  analysis: CallAnalysis | null;
  isManager: boolean;
}

export function CallAnalysisResultsView({ call, analysis, isManager }: CallAnalysisResultsViewProps) {
  const { toast } = useToast();

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: `${label} copied to clipboard.` });
    } catch {
      toast({ title: 'Error', description: 'Failed to copy.', variant: 'destructive' });
    }
  };

  if (!analysis) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No analysis available for this call yet.</p>
          {call?.analysis_status === 'processing' && (
            <p className="text-sm text-muted-foreground mt-2">Analysis is still processing...</p>
          )}
          {call?.analysis_status === 'error' && (
            <p className="text-sm text-destructive mt-2">Error: {call.analysis_error}</p>
          )}
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
                <div className="p-4 border border-destructive/30 bg-destructive/5 rounded-lg space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Critical Info Missing
                  </h4>
                  <ul className="text-sm space-y-1">
                    {analysis.coach_output.critical_info_missing.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-destructive">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Follow-up Questions */}
              {analysis.coach_output.recommended_follow_up_questions && analysis.coach_output.recommended_follow_up_questions.length > 0 && (
                <div className="p-4 border border-primary/30 bg-primary/5 rounded-lg space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2 text-primary">
                    <HelpCircle className="h-4 w-4" />
                    Recommended Follow-up Questions
                  </h4>
                  <ul className="text-sm space-y-1">
                    {analysis.coach_output.recommended_follow_up_questions.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        {item}
                      </li>
                    ))}
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

      {/* Call Notes - Only visible to non-managers */}
      {!isManager && (
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
                <ReactMarkdown
                  components={{
                    p: ({children}) => <p className="mb-2">{children}</p>,
                    ul: ({children}) => <ul className="list-disc ml-6 mb-2">{children}</ul>,
                    li: ({children}) => <li className="mb-1">{children}</li>,
                    strong: ({children}) => <strong className="font-bold">{children}</strong>,
                  }}
                >
                  {analysis.call_notes}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No call notes available.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recap Email - Only visible to non-managers */}
      {!isManager && (
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
      )}
    </div>
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
