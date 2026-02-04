export interface FollowUpSuggestion {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'discovery' | 'stakeholder' | 'objection' | 'proposal' | 'relationship' | 'competitive';
  suggested_due_days: number | null;
  urgency_signal: string | null;
  ai_reasoning: string;
  related_evidence: string | null;
  status: 'pending' | 'accepted' | 'dismissed';
}
