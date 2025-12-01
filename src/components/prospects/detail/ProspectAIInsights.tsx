import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Flame, RefreshCw, Loader2, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { format } from 'date-fns';
import type { Prospect } from '@/api/prospects';
import type { CallRecord } from '@/hooks/useProspectData';
import type { EmailLog } from '@/api/emailLogs';

interface ProspectAIInsightsProps {
  prospect: Prospect;
  calls: CallRecord[];
  emailLogs: EmailLog[];
  isRefreshingInsights: boolean;
  onRefreshInsights: () => void;
  onResearchAccount?: () => void;
}

export function ProspectAIInsights({
  prospect,
  calls,
  emailLogs,
  isRefreshingInsights,
  onRefreshInsights,
  onResearchAccount,
}: ProspectAIInsightsProps) {
  const aiInfo = prospect.ai_extracted_info as {
    business_context?: string;
    pain_points?: string[];
    communication_summary?: string;
    key_opportunities?: string[];
    decision_process?: {
      timeline?: string;
      budget_signals?: string;
    };
    relationship_health?: string;
    competitors_mentioned?: string[];
    last_analyzed_at?: string;
  } | null;

  const lastAnalyzedAt = aiInfo?.last_analyzed_at ? new Date(aiInfo.last_analyzed_at) : null;
  const latestCallDate = calls.length > 0 ? new Date(calls[0].call_date) : null;
  const latestEmailDate = emailLogs.length > 0 ? new Date(emailLogs[0].email_date) : null;
  
  const hasNewDataSinceAnalysis = lastAnalyzedAt && (
    (latestCallDate && latestCallDate > lastAnalyzedAt) ||
    (latestEmailDate && latestEmailDate > lastAnalyzedAt)
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-primary" />
            AI Insights
            {hasNewDataSinceAnalysis && (
              <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                New data available
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {aiInfo?.last_analyzed_at 
              ? `Last analyzed ${format(new Date(aiInfo.last_analyzed_at), 'MMM d, yyyy h:mm a')}`
              : 'Extracted from calls and emails'
            }
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {onResearchAccount && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResearchAccount}
            >
              <Search className="h-4 w-4 mr-1" />
              Research
            </Button>
          )}
          <Button
            variant={hasNewDataSinceAnalysis ? "default" : "outline"}
            size="sm"
            onClick={onRefreshInsights}
            disabled={isRefreshingInsights}
          >
            {isRefreshingInsights ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!aiInfo ? (
          <div className="text-center py-8">
            <Flame className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">No AI insights yet</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshInsights}
              disabled={isRefreshingInsights}
            >
              {isRefreshingInsights ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate Insights
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            {aiInfo.business_context && (
              <div>
                <h4 className="font-medium mb-1">Business Context</h4>
                <p className="text-sm text-muted-foreground">{aiInfo.business_context}</p>
              </div>
            )}
            {aiInfo.pain_points && aiInfo.pain_points.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Pain Points</h4>
                <ul className="space-y-1">
                  {aiInfo.pain_points.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {aiInfo.communication_summary && (
              <div>
                <h4 className="font-medium mb-1">Communication Summary</h4>
                <p className="text-sm text-muted-foreground">{aiInfo.communication_summary}</p>
              </div>
            )}
            {aiInfo.key_opportunities && aiInfo.key_opportunities.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Key Opportunities</h4>
                <ul className="space-y-1">
                  {aiInfo.key_opportunities.map((opp, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      {opp}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {aiInfo.decision_process && (
              <div>
                <h4 className="font-medium mb-2">Decision Process</h4>
                <div className="text-sm space-y-1">
                  {aiInfo.decision_process.timeline && (
                    <p><span className="text-muted-foreground">Timeline:</span> {aiInfo.decision_process.timeline}</p>
                  )}
                  {aiInfo.decision_process.budget_signals && (
                    <p><span className="text-muted-foreground">Budget:</span> {aiInfo.decision_process.budget_signals}</p>
                  )}
                </div>
              </div>
            )}
            {aiInfo.relationship_health && (
              <div>
                <h4 className="font-medium mb-1">Relationship Health</h4>
                <p className="text-sm text-muted-foreground">{aiInfo.relationship_health}</p>
              </div>
            )}
            {aiInfo.competitors_mentioned && aiInfo.competitors_mentioned.length > 0 && (
              <div>
                <h4 className="font-medium mb-1">Competitors Mentioned</h4>
                <div className="flex flex-wrap gap-2">
                  {aiInfo.competitors_mentioned.map((comp, i) => (
                    <Badge key={i} variant="outline">{comp}</Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
