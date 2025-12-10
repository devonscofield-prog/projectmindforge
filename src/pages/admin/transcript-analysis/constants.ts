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
  const now = new Date();
  
  // End date is today at end of day
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  
  // Start date is (daysBack - 1) days ago at start of day
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (daysBack - 1), 0, 0, 0, 0);
  
  return { from, to };
}

export type TranscriptAnalysisStatus = 'pending' | 'processing' | 'completed' | 'error' | 'skipped';

export const ANALYSIS_STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'completed', label: 'Analyzed' },
  { value: 'skipped', label: 'Indexed Only' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'error', label: 'Error' },
];

export interface Transcript {
  id: string;
  call_date: string;
  account_name: string | null;
  call_type: string | null;
  raw_text: string;
  rep_id: string;
  analysis_status: TranscriptAnalysisStatus;
  rep_name?: string;
  team_name?: string;
  manager_id?: string | null;
  created_at?: string;
}

export interface TranscriptFilters {
  dateRange: { from: Date; to: Date };
  selectedTeamId: string;
  selectedRepId: string;
  accountSearch: string;
  selectedCallTypes: string[];
}
