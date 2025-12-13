import { 
  Building2, 
  Target, 
  Users, 
  MessageSquare, 
  HelpCircle, 
  TrendingUp, 
  AlertTriangle,
  Lightbulb,
  Copy,
  Check
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ResearchSection } from './ResearchSection';
import type { StructuredAccountResearch, Signal, Risk } from '@/types/accountResearch';

interface StructuredResearchDisplayProps {
  research: StructuredAccountResearch;
}

const SIGNAL_COLORS: Record<Signal['signal_type'], string> = {
  hiring: 'bg-green-500/10 text-green-600 border-green-500/20',
  technology: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  funding: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  expansion: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  leadership_change: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  other: 'bg-muted text-muted-foreground border-border',
};

const RISK_COLORS: Record<Risk['risk_type'], string> = {
  competitive: 'bg-red-500/10 text-red-600 border-red-500/20',
  timing: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  budget: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  decision_process: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  technical: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  other: 'bg-muted text-muted-foreground border-border',
};

function CopyableHook({ hook, context }: { hook: string; context: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(hook);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative bg-muted/30 rounded-lg p-3 hover:bg-muted/50 transition-colors">
      <div className="pr-8">
        <p className="font-medium text-sm">{hook}</p>
        <p className="text-xs text-muted-foreground mt-1">{context}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  );
}

export function StructuredResearchDisplay({ research }: StructuredResearchDisplayProps) {
  const { 
    company_overview, 
    industry_analysis, 
    stakeholder_insights, 
    conversation_hooks,
    discovery_questions,
    solution_alignment,
    signals_to_watch,
    risks_and_considerations
  } = research;

  return (
    <div className="space-y-3">
      {/* Company Overview */}
      <ResearchSection
        icon={<Building2 className="h-4 w-4 text-primary" />}
        title="Company Overview"
      >
        <div className="space-y-3">
          <p className="text-sm">{company_overview.description}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">{company_overview.size}</Badge>
            <Badge variant="secondary">📍 {company_overview.headquarters}</Badge>
          </div>
          {company_overview.key_metrics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {company_overview.key_metrics.map((metric, i) => (
                <Badge key={i} variant="outline" className="text-xs">{metric}</Badge>
              ))}
            </div>
          )}
          {company_overview.recent_news.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">Recent News</p>
              <ul className="text-xs space-y-1">
                {company_overview.recent_news.map((news, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary">•</span>
                    {news}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </ResearchSection>

      {/* Industry Analysis */}
      <ResearchSection
        icon={<Target className="h-4 w-4 text-primary" />}
        title="Industry Analysis"
      >
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Top Industry Challenges</p>
            <ul className="text-sm space-y-1">
              {industry_analysis.top_challenges.map((challenge, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-destructive">⚠</span>
                  {challenge}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Company-Specific Challenges</p>
            <ul className="text-sm space-y-1">
              {industry_analysis.company_specific_challenges.map((challenge, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-amber-500">→</span>
                  {challenge}
                </li>
              ))}
            </ul>
          </div>
          {industry_analysis.market_pressures.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Market Pressures</p>
              <div className="flex flex-wrap gap-1">
                {industry_analysis.market_pressures.map((pressure, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{pressure}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </ResearchSection>

      {/* Stakeholder Insights */}
      {stakeholder_insights.length > 0 && (
        <ResearchSection
          icon={<Users className="h-4 w-4 text-primary" />}
          title={`Stakeholder Insights (${stakeholder_insights.length})`}
        >
          <div className="space-y-3">
            {stakeholder_insights.map((stakeholder, i) => (
              <div key={i} className="border-l-2 border-primary/30 pl-3 py-1">
                <p className="font-medium text-sm">{stakeholder.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{stakeholder.messaging_approach}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {stakeholder.priorities.map((priority, j) => (
                    <Badge key={j} variant="secondary" className="text-xs">{priority}</Badge>
                  ))}
                </div>
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Questions to Ask</p>
                  <ul className="text-xs space-y-1">
                    {stakeholder.questions_to_ask.map((q, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="text-primary">?</span>
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </ResearchSection>
      )}

      {/* Conversation Hooks */}
      <ResearchSection
        icon={<MessageSquare className="h-4 w-4 text-primary" />}
        title={`Conversation Hooks (${conversation_hooks.length})`}
      >
        <div className="space-y-2">
          {conversation_hooks.map((hook, i) => (
            <CopyableHook key={i} hook={hook.hook} context={hook.context} />
          ))}
        </div>
      </ResearchSection>

      {/* Discovery Questions */}
      <ResearchSection
        icon={<HelpCircle className="h-4 w-4 text-primary" />}
        title={`Discovery Questions (${discovery_questions.length})`}
      >
        <ul className="space-y-2">
          {discovery_questions.map((question, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="text-primary font-medium">{i + 1}.</span>
              {question}
            </li>
          ))}
        </ul>
      </ResearchSection>

      {/* Solution Alignment */}
      {solution_alignment && (
        <ResearchSection
          icon={<Lightbulb className="h-4 w-4 text-primary" />}
          title="Solution Alignment"
        >
          <div className="space-y-3">
            <p className="text-sm">{solution_alignment.needs_connection}</p>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Benefits to Emphasize</p>
              <ul className="text-sm space-y-1">
                {solution_alignment.benefits.map((benefit, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-green-500">✓</span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
            {solution_alignment.objections_and_responses.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Objection Handling</p>
                <div className="space-y-2">
                  {solution_alignment.objections_and_responses.map((item, i) => (
                    <div key={i} className="bg-muted/30 rounded-lg p-2 text-xs">
                      <p className="font-medium text-destructive">"{item.objection}"</p>
                      <p className="text-muted-foreground mt-1">→ {item.response}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ResearchSection>
      )}

      {/* Signals to Watch */}
      <ResearchSection
        icon={<TrendingUp className="h-4 w-4 text-primary" />}
        title={`Signals to Watch (${signals_to_watch.length})`}
      >
        <div className="space-y-2">
          {signals_to_watch.map((signal, i) => (
            <div key={i} className="flex gap-2 items-start">
              <Badge className={SIGNAL_COLORS[signal.signal_type]} variant="outline">
                {signal.signal_type.replace('_', ' ')}
              </Badge>
              <span className="text-sm flex-1">{signal.description}</span>
            </div>
          ))}
        </div>
      </ResearchSection>

      {/* Risks & Considerations */}
      <ResearchSection
        icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
        title={`Risks & Considerations (${risks_and_considerations.length})`}
        defaultOpen={false}
      >
        <div className="space-y-2">
          {risks_and_considerations.map((risk, i) => (
            <div key={i} className="flex gap-2 items-start">
              <Badge className={RISK_COLORS[risk.risk_type]} variant="outline">
                {risk.risk_type.replace('_', ' ')}
              </Badge>
              <span className="text-sm flex-1">{risk.description}</span>
            </div>
          ))}
        </div>
      </ResearchSection>
    </div>
  );
}
