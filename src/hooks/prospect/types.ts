import type { Prospect, ProspectActivity, ProspectStatus, ProspectActivityType } from '@/api/prospects';
import type { Stakeholder } from '@/api/stakeholders';
import type { StakeholderRelationship } from '@/api/stakeholderRelationships';
import type { AccountFollowUp } from '@/api/accountFollowUps';
import type { EmailLog } from '@/api/emailLogs';

export interface CallRecord {
  id: string;
  call_date: string;
  call_type: string | null;
  analysis_status: string;
  primary_stakeholder_name: string | null;
  coach_grade: string | null;
}

export interface ProspectCoreState {
  prospect: Prospect | null;
  stakeholders: Stakeholder[];
  relationships: StakeholderRelationship[];
  calls: CallRecord[];
  isLoading: boolean;
}

export interface ProspectFollowUpsState {
  followUps: AccountFollowUp[];
  completedFollowUps: AccountFollowUp[];
  dismissedFollowUps: AccountFollowUp[];
  isRefreshing: boolean;
}

export interface ProspectActivitiesState {
  activities: ProspectActivity[];
  emailLogs: EmailLog[];
}

export interface ProspectInsightsState {
  isRefreshingInsights: boolean;
}

export type { Prospect, ProspectActivity, ProspectStatus, ProspectActivityType };
export type { Stakeholder };
export type { StakeholderRelationship };
export type { AccountFollowUp };
export type { EmailLog };
