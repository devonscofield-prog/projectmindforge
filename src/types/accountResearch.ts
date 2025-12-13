/**
 * Structured Account Research Types
 * These types define the structured output from the AI tool calling
 */

export interface StakeholderInsight {
  name: string;
  priorities: string[];
  messaging_approach: string;
  questions_to_ask: string[];
}

export interface ConversationHook {
  hook: string;
  context: string;
}

export interface SolutionAlignment {
  needs_connection: string;
  benefits: string[];
  objections_and_responses: Array<{
    objection: string;
    response: string;
  }>;
}

export interface Signal {
  signal_type: 'hiring' | 'technology' | 'funding' | 'expansion' | 'leadership_change' | 'other';
  description: string;
}

export interface Risk {
  risk_type: 'competitive' | 'timing' | 'budget' | 'decision_process' | 'technical' | 'other';
  description: string;
}

export interface StructuredAccountResearch {
  company_overview: {
    description: string;
    size: string;
    headquarters: string;
    recent_news: string[];
    key_metrics: string[];
  };
  industry_analysis: {
    top_challenges: string[];
    company_specific_challenges: string[];
    market_pressures: string[];
  };
  stakeholder_insights: StakeholderInsight[];
  conversation_hooks: ConversationHook[];
  discovery_questions: string[];
  solution_alignment: SolutionAlignment | null;
  signals_to_watch: Signal[];
  risks_and_considerations: Risk[];
}

/**
 * Type guard for structured research
 */
export function isStructuredAccountResearch(value: unknown): value is StructuredAccountResearch {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.company_overview === 'object' &&
    typeof obj.industry_analysis === 'object' &&
    Array.isArray(obj.discovery_questions)
  );
}
