import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { 
  Flame, RefreshCw, Loader2, AlertCircle, CheckCircle2, ChevronDown, 
  ChevronsDownUp, ChevronsUpDown, AlertTriangle, Target, User, Swords,
  HelpCircle, TrendingUp, TrendingDown, Minus, Zap, XCircle, Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import type { Prospect, ProspectIntel } from '@/api/prospects';
import type { CallRecord } from '@/hooks/useProspectData';
import type { EmailLog } from '@/api/emailLogs';

interface ProspectAIInsightsProps {
  prospect: Prospect;
  calls: CallRecord[];
  emailLogs: EmailLog[];
  isRefreshingInsights: boolean;
  onRefreshInsights: () => void;
}

const DISC_EMOJIS: Record<string, string> = {
  'D': '🦁',
  'I': '🦋',
  'S': '🐢',
  'C': '🦉',
};

const DISC_COLORS: Record<string, string> = {
  'D': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  'I': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'S': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'C': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

const TRAJECTORY_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  improving: { icon: TrendingUp, color: 'text-green-500', label: 'Improving' },
  stable: { icon: Minus, color: 'text-blue-500', label: 'Stable' },
  declining: { icon: TrendingDown, color: 'text-red-500', label: 'Declining' },
  stalled: { icon: XCircle, color: 'text-yellow-500', label: 'Stalled' },
};

export function ProspectAIInsights({
  prospect,
  calls,
  emailLogs,
  isRefreshingInsights,
  onRefreshInsights,
}: ProspectAIInsightsProps) {
  const aiInfo = prospect.ai_extracted_info as ProspectIntel | null;

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

  // Check for V2 data (new AI-native fields)
  const hasV2Data = aiInfo?.deal_blockers || aiInfo?.champion_signals || aiInfo?.next_best_action || aiInfo?.relationship_trajectory;

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
            {hasV2Data && (
              <Badge variant="outline" className="ml-1 text-xs">V2</Badge>
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
          {aiInfo && (
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              {allExpanded ? (
                <><ChevronsUpDown className="h-4 w-4 mr-1" /> Collapse</>
              ) : (
                <><ChevronsDownUp className="h-4 w-4 mr-1" /> Expand</>
              )}
            </Button>
          )}
          <Button
            variant={hasNewDataSinceAnalysis ? "default" : "outline"}
            size="sm"
            onClick={onRefreshInsights}
            disabled={isRefreshingInsights}
          >
            {isRefreshingInsights ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!aiInfo ? (
          <div className="text-center py-8">
            <Flame className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">No AI insights yet</p>
            <Button variant="outline" size="sm" onClick={onRefreshInsights} disabled={isRefreshingInsights}>
              {isRefreshingInsights ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" />Generate Insights</>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Next Best Action Banner - always visible if present */}
            {aiInfo.next_best_action && (
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 flex items-start gap-2">
                <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Next Best Action</p>
                  <p className="text-sm text-muted-foreground">{aiInfo.next_best_action}</p>
                </div>
              </div>
            )}

            {/* Relationship Trajectory */}
            {aiInfo.relationship_trajectory && TRAJECTORY_CONFIG[aiInfo.relationship_trajectory] && (
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                {(() => {
                  const config = TRAJECTORY_CONFIG[aiInfo.relationship_trajectory!];
                  const Icon = config.icon;
                  return (
                    <>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                      <span className="text-sm font-medium">Relationship: {config.label}</span>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Deal Blockers */}
            {aiInfo.deal_blockers && aiInfo.deal_blockers.length > 0 && (
              <CollapsibleInsightSection
                title="Deal Blockers"
                icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
                open={allExpanded}
                priority
              >
                <ul className="space-y-1">
                  {aiInfo.deal_blockers.map((blocker, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      {blocker}
                    </li>
                  ))}
                </ul>
              </CollapsibleInsightSection>
            )}

            {/* Champion Signals */}
            {aiInfo.champion_signals && aiInfo.champion_signals.length > 0 && (
              <CollapsibleInsightSection
                title="Champion Signals"
                icon={<Sparkles className="h-4 w-4 text-green-500" />}
                open={allExpanded}
              >
                <ul className="space-y-1">
                  {aiInfo.champion_signals.map((signal, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      {signal}
                    </li>
                  ))}
                </ul>
              </CollapsibleInsightSection>
            )}

            {/* Buying Signals */}
            {aiInfo.buying_signals && aiInfo.buying_signals.length > 0 && (
              <CollapsibleInsightSection
                title="Buying Signals"
                icon={<TrendingUp className="h-4 w-4 text-green-500" />}
                open={allExpanded}
              >
                <ul className="space-y-1">
                  {aiInfo.buying_signals.map((signal, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      {signal}
                    </li>
                  ))}
                </ul>
              </CollapsibleInsightSection>
            )}

            {/* Stall Signals */}
            {aiInfo.stall_signals && aiInfo.stall_signals.length > 0 && (
              <CollapsibleInsightSection
                title="Stall Signals"
                icon={<TrendingDown className="h-4 w-4 text-amber-500" />}
                open={allExpanded}
              >
                <ul className="space-y-1">
                  {aiInfo.stall_signals.map((signal, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      {signal}
                    </li>
                  ))}
                </ul>
              </CollapsibleInsightSection>
            )}

            {/* Legacy V2: Critical Gaps Summary */}
            {aiInfo.critical_gaps_summary && aiInfo.critical_gaps_summary.length > 0 && (
              <CollapsibleInsightSection
                title="Critical Gaps"
                icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
                open={allExpanded}
                priority
              >
                <div className="space-y-2">
                  {aiInfo.critical_gaps_summary.map((gap, i) => (
                    <div key={i} className="border-l-2 border-amber-400 pl-3 py-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{gap.category}</Badge>
                        <span className="text-sm">{gap.description}</span>
                      </div>
                      {gap.suggested_question && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                          <HelpCircle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>Ask: "{gap.suggested_question}"</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleInsightSection>
            )}

            {/* Prospect Persona */}
            {aiInfo.prospect_persona && (
              <CollapsibleInsightSection
                title="Prospect Communication Style"
                icon={<User className="h-4 w-4 text-purple-500" />}
                open={allExpanded}
              >
                <div className="space-y-3">
                  {aiInfo.prospect_persona.disc && (
                    <div className="flex items-center gap-2">
                      <Badge className={DISC_COLORS[aiInfo.prospect_persona.disc] || 'bg-muted'}>
                        {DISC_EMOJIS[aiInfo.prospect_persona.disc] || ''} {aiInfo.prospect_persona.disc}
                      </Badge>
                      {aiInfo.prospect_persona.archetype && (
                        <span className="text-sm font-medium">{aiInfo.prospect_persona.archetype}</span>
                      )}
                    </div>
                  )}
                  {aiInfo.prospect_persona.communication_style && (
                    <p className="text-sm text-muted-foreground">{aiInfo.prospect_persona.communication_style}</p>
                  )}
                  {aiInfo.prospect_persona.dos && aiInfo.prospect_persona.dos.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-green-600 mb-1">✓ Do:</p>
                      <ul className="text-sm space-y-0.5">
                        {aiInfo.prospect_persona.dos.slice(0, 3).map((d, i) => (
                          <li key={i} className="text-muted-foreground">• {d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiInfo.prospect_persona.donts && aiInfo.prospect_persona.donts.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-600 mb-1">✗ Don't:</p>
                      <ul className="text-sm space-y-0.5">
                        {aiInfo.prospect_persona.donts.slice(0, 3).map((d, i) => (
                          <li key={i} className="text-muted-foreground">• {d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CollapsibleInsightSection>
            )}

            {/* Competitors Summary */}
            {aiInfo.competitors_summary && aiInfo.competitors_summary.length > 0 && (
              <CollapsibleInsightSection
                title="Competitive Landscape"
                icon={<Swords className="h-4 w-4 text-red-500" />}
                open={allExpanded}
              >
                <div className="space-y-2">
                  {aiInfo.competitors_summary.map((comp, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Badge variant="destructive" className="text-xs shrink-0">{comp.name}</Badge>
                      {comp.positioning && (
                        <span className="text-sm text-muted-foreground">{comp.positioning}</span>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleInsightSection>
            )}

            {/* Business Context */}
            {aiInfo.business_context && (
              <CollapsibleInsightSection title="Business Context" icon={<Target className="h-4 w-4 text-blue-500" />} open={allExpanded}>
                <p className="text-sm text-muted-foreground">{aiInfo.business_context}</p>
              </CollapsibleInsightSection>
            )}

            {/* Pain Points */}
            {aiInfo.pain_points && aiInfo.pain_points.length > 0 && (
              <CollapsibleInsightSection title="Pain Points" icon={<AlertCircle className="h-4 w-4 text-orange-500" />} open={allExpanded}>
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

            {/* Key Opportunities */}
            {aiInfo.key_opportunities && aiInfo.key_opportunities.length > 0 && (
              <CollapsibleInsightSection title="Key Opportunities" icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} open={allExpanded}>
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

            {/* Communication Summary */}
            {aiInfo.communication_summary && (
              <CollapsibleInsightSection title="Communication Summary" open={allExpanded}>
                <p className="text-sm text-muted-foreground">{aiInfo.communication_summary}</p>
              </CollapsibleInsightSection>
            )}

            {/* Decision Process */}
            {aiInfo.decision_process && (
              <CollapsibleInsightSection title="Decision Process" open={allExpanded}>
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

            {/* Relationship Health (legacy) */}
            {aiInfo.relationship_health && !aiInfo.relationship_trajectory && (
              <CollapsibleInsightSection title="Relationship Health" open={allExpanded}>
                <p className="text-sm text-muted-foreground">{aiInfo.relationship_health}</p>
              </CollapsibleInsightSection>
            )}

            {/* Legacy competitors (only if no V2 competitors_summary) */}
            {!aiInfo.competitors_summary && aiInfo.competitors_mentioned && aiInfo.competitors_mentioned.length > 0 && (
              <CollapsibleInsightSection title="Competitors Mentioned" open={allExpanded}>
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
  open = false,
  icon,
  priority = false,
}: { 
  title: string; 
  children: React.ReactNode; 
  open?: boolean;
  icon?: React.ReactNode;
  priority?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(open);

  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={`border rounded-lg ${priority ? 'border-amber-300 dark:border-amber-700' : ''}`}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            {icon}
            <h4 className="font-medium text-sm">{title}</h4>
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pb-3">
          {children}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
