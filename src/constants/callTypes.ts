// Call Type definitions and labels
export type CallType = 'first_demo' | 'reconnect' | 'account_review' | 'upsell' | 'other';

export const callTypeLabels: Record<CallType, string> = {
  first_demo: 'First Demo',
  reconnect: 'Reconnect',
  account_review: 'Account Review',
  upsell: 'Upsell',
  other: 'Other',
};

export const callTypeOptions: { value: CallType; label: string }[] = [
  { value: 'first_demo', label: 'First Demo' },
  { value: 'reconnect', label: 'Reconnect' },
  { value: 'account_review', label: 'Account Review' },
  { value: 'upsell', label: 'Upsell' },
  { value: 'other', label: 'Other' },
];
