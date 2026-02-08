export type OpportunityLabel = 'commit' | 'best_case' | 'pipeline' | 'time_waster';

export const opportunityLabelOptions: { value: OpportunityLabel; label: string }[] = [
  { value: 'commit', label: 'Commit' },
  { value: 'best_case', label: 'Best Case' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'time_waster', label: 'Time Waster' },
];

export const opportunityLabelLabels: Record<OpportunityLabel, string> = {
  commit: 'Commit',
  best_case: 'Best Case',
  pipeline: 'Pipeline',
  time_waster: 'Time Waster',
};
