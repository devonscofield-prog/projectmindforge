export const TIME_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
  { value: '365', label: 'Last year' },
];

export const CALL_TYPES = [
  { value: 'first_demo', label: 'First Demo' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'closing_call', label: 'Closing Call' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'check_in', label: 'Check In' },
  { value: 'other', label: 'Other' },
];

export function createDateRange(daysBack: number): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export interface Transcript {
  id: string;
  call_date: string;
  account_name: string | null;
  call_type: string | null;
  raw_text: string;
  rep_id: string;
  rep_name?: string;
  team_name?: string;
}

export interface TranscriptFilters {
  dateRange: { from: Date; to: Date };
  selectedTeamId: string;
  selectedRepId: string;
  accountSearch: string;
  selectedCallTypes: string[];
}
