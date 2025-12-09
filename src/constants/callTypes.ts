// Call Type definitions and labels
export type CallType = 
  | 'first_demo' 
  | 'discovery' 
  | 'reconnect' 
  | 'account_review' 
  | 'qbr'
  | 'technical_deep_dive'
  | 'negotiation'
  | 'upsell' 
  | 'onboarding'
  | 'other';

export const callTypeLabels: Record<CallType, string> = {
  first_demo: 'First Demo',
  discovery: 'Discovery',
  reconnect: 'Reconnect',
  account_review: 'Account Review',
  qbr: 'QBR',
  technical_deep_dive: 'Technical Deep Dive',
  negotiation: 'Negotiation',
  upsell: 'Upsell',
  onboarding: 'Onboarding',
  other: 'Other',
};

export const callTypeOptions: { value: CallType; label: string }[] = [
  { value: 'first_demo', label: 'First Demo' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'reconnect', label: 'Reconnect' },
  { value: 'account_review', label: 'Account Review' },
  { value: 'qbr', label: 'QBR (Quarterly Business Review)' },
  { value: 'technical_deep_dive', label: 'Technical Deep Dive' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'upsell', label: 'Upsell' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'other', label: 'Other' },
];
