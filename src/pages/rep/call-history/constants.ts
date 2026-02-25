import { CallType } from '@/constants/callTypes';
import { HeatRange } from '@/api/aiCallAnalysis';

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'error' | 'skipped';

export const analysisStatusOptions: { value: AnalysisStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'error', label: 'Error' },
  { value: 'skipped', label: 'Indexed Only' },
];

export const heatRangeOptions: { value: HeatRange; label: string }[] = [
  { value: 'hot', label: '🔥 Hot (7-10)' },
  { value: 'warm', label: '🌡️ Warm (4-6)' },
  { value: 'cold', label: '❄️ Cold (1-3)' },
];

export type SortColumn = 'call_date' | 'account_name' | 'created_at' | 'heat_score' | 'coach_grade';
