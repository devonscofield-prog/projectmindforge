import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Flame, RefreshCw, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
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
}

export function ProspectAIInsights({
  prospect,
  calls,
  emailLogs,
  isRefreshingInsights,
  onRefreshInsights,
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

  const [allExpanded, setAllExpanded] = useState(true);

  const toggleAll = () => {
    setAllExpanded(!allExpanded);
  };

  const sections = [
    { key: 'business_context', title: 'Business Context', data: aiInfo?.business_context },
    { key: 'pain_points', title: 'Pain Points', data: aiInfo?.pain_points },
    { key: 'communication_summary', title: 'Communication Summary', data: aiInfo?.communication_summary },
    { key: 'key_opportunities', title: 'Key Opportunities', data: aiInfo?.key_opportunities },
    { key: 'decision_process', title: 'Decision Process', data: aiInfo?.decision_process },
    { key: 'relationship_health', title: 'Relationship Health', data: aiInfo?.relationship_health },
    { key: 'competitors_mentioned', title: 'Competitors Mentioned', data: aiInfo?.competitors_mentioned },
  ].filter(s => s.data);

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
          {aiInfo && sections.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAll}
            >
              {allExpanded ? (
                <><ChevronsUpDown className="h-4 w-4 mr-1" /> Collapse All</>
              ) : (
                <><ChevronsDownUp className="h-4 w-4 mr-1" /> Expand All</>
              )}
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
          <div className="space-y-3">
            {aiInfo.business_context && (
              <CollapsibleInsightSection
                title="Business Context"
                open={allExpanded}
              >
                <p className="text-sm text-muted-foreground">{aiInfo.business_context}</p>
              </CollapsibleInsightSection>
            )}
            {aiInfo.pain_points && aiInfo.pain_points.length > 0 && (
              <CollapsibleInsightSection
                title="Pain Points"
                open={allExpanded}
              >
                <ul className="space-y-1">
                  {aiInfo.pain_points.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </CollapsibleInsightSection>
            )}
            {aiInfo.communication_summary && (
              <CollapsibleInsightSection
                title="Communication Summary"
                open={allExpanded}
              >
                <p className="text-sm text-muted-foreground">{aiInfo.communication_summary}</p>
              </CollapsibleInsightSection>
            )}
            {aiInfo.key_opportunities && aiInfo.key_opportunities.length > 0 && (
              <CollapsibleInsightSection
                title="Key Opportunities"
                open={allExpanded}
              >
                <ul className="space-y-1">
                  {aiInfo.key_opportunities.map((opp, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      {opp}
                    </li>
                  ))}
                </ul>
              </CollapsibleInsightSection>
            )}
            {aiInfo.decision_process && (
              <CollapsibleInsightSection
                title="Decision Process"
                open={allExpanded}
              >
                <div className="text-sm space-y-1">
                  {aiInfo.decision_process.timeline && (
                    <p><span className="text-muted-foreground">Timeline:</span> {aiInfo.decision_process.timeline}</p>
                  )}
                  {aiInfo.decision_process.budget_signals && (
                    <p><span className="text-muted-foreground">Budget:</span> {aiInfo.decision_process.budget_signals}</p>
                  )}
                </div>
              </CollapsibleInsightSection>
            )}
            {aiInfo.relationship_health && (
              <CollapsibleInsightSection
                title="Relationship Health"
                open={allExpanded}
              >
                <p className="text-sm text-muted-foreground">{aiInfo.relationship_health}</p>
              </CollapsibleInsightSection>
            )}
            {aiInfo.competitors_mentioned && aiInfo.competitors_mentioned.length > 0 && (
              <CollapsibleInsightSection
                title="Competitors Mentioned"
                open={allExpanded}
              >
                <div className="flex flex-wrap gap-2">
                  {aiInfo.competitors_mentioned.map((comp, i) => (
                    <Badge key={i} variant="outline">{comp}</Badge>
                  ))}
                </div>
              </CollapsibleInsightSection>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CollapsibleInsightSection({ 
  title, 
  children, 
  open = false 
}: { 
  title: string; 
  children: React.ReactNode; 
  open?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(open);

  // Sync with parent's expand/collapse all
  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg">
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors">
          <h4 className="font-medium text-sm">{title}</h4>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pb-3">
          {children}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
