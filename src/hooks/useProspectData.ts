import { useEffect, useCallback, useRef } from 'react';
import { createLogger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import {
  useProspectCore,
  useProspectFollowUps,
  useProspectActivities,
  useProspectInsights,
  useProspectRealtime,
  type CallRecord,
  type Prospect,
  type ProspectActivity,
  type ProspectStatus,
  type ProspectActivityType,
  type Stakeholder,
  type StakeholderRelationship,
  type AccountFollowUp,
  type EmailLog,
} from './prospect';
import type { useAuth } from '@/contexts/AuthContext';

const log = createLogger('prospectData');

// Re-export types for backward compatibility
export type { CallRecord };

export interface UseProspectDataReturn {
  // Data
  prospect: Prospect | null;
  stakeholders: Stakeholder[];
  relationships: StakeholderRelationship[];
  activities: ProspectActivity[];
  calls: CallRecord[];
  followUps: AccountFollowUp[];
  completedFollowUps: AccountFollowUp[];
  dismissedFollowUps: AccountFollowUp[];
  emailLogs: EmailLog[];
  user: ReturnType<typeof useAuth>['user'];
  
  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  isRefreshingInsights: boolean;
  
  // Handlers
  loadProspectData: () => Promise<void>;
  handleStatusChange: (newStatus: ProspectStatus) => Promise<void>;
  handleAddActivity: (newActivity: { type: ProspectActivityType; description: string; date: string }) => Promise<ProspectActivity | undefined>;
  handleCompleteFollowUp: (followUpId: string) => Promise<void>;
  handleReopenFollowUp: (followUpId: string) => Promise<void>;
  handleDismissFollowUp: (followUpId: string) => Promise<void>;
  handleRestoreFollowUp: (followUpId: string) => Promise<void>;
  handleRefreshFollowUps: () => Promise<void>;
  handleDeleteEmailLog: (emailId: string) => Promise<void>;
  handleRefreshInsightsOnly: () => Promise<void>;
  handleEmailAdded: () => void;
  handleUpdateProspect: (updates: Partial<Prospect>) => Promise<boolean>;
}

export function useProspectData(prospectId: string | undefined): UseProspectDataReturn {
  const { toast } = useToast();

  // Compose smaller hooks
  const core = useProspectCore({ prospectId });
  const followUps = useProspectFollowUps({ prospectId });
  const activities = useProspectActivities({ prospectId });
  
  // Insights hook needs callbacks to update other hooks' state
  const insights = useProspectInsights({
    prospectId,
    onProspectUpdate: core.setProspect,
    onFollowUpsRefresh: async () => { await followUps.loadFollowUpsData(); },
  });

  // Real-time subscription
  useProspectRealtime({
    prospectId,
    onCallsUpdate: (calls) => core.refreshCalls(),
    onAnalysisComplete: insights.handleRefreshAll,
  });

  // Use refs to store the latest load functions to avoid dependency cycles
  const loadCoreDataRef = useRef(core.loadCoreData);
  const loadFollowUpsDataRef = useRef(followUps.loadFollowUpsData);
  const loadActivitiesDataRef = useRef(activities.loadActivitiesData);
  const setIsLoadingRef = useRef(core.setIsLoading);

  // Keep refs updated without triggering re-renders
  useEffect(() => {
    loadCoreDataRef.current = core.loadCoreData;
    loadFollowUpsDataRef.current = followUps.loadFollowUpsData;
    loadActivitiesDataRef.current = activities.loadActivitiesData;
    setIsLoadingRef.current = core.setIsLoading;
  });

  // Combined load function - now with stable dependencies
  const loadProspectData = useCallback(async () => {
    if (!prospectId) return;
    
    setIsLoadingRef.current(true);
    try {
      const results = await Promise.allSettled([
        loadCoreDataRef.current(),
        loadFollowUpsDataRef.current(),
        loadActivitiesDataRef.current(),
      ]);

      // Check if core data failed (critical - can't display page without it)
      if (results[0].status === 'rejected') {
        log.error('Failed to load core prospect data', { error: results[0].reason });
        toast({ title: 'Failed to load account', variant: 'destructive' });
        return;
      }

      // Core data loaded but prospect not found
      if (!results[0].value) {
        // Navigation already handled in loadCoreData
        return;
      }

      // Log non-critical failures
      if (results[1].status === 'rejected') {
        log.warn('Failed to load follow-ups', { error: results[1].reason });
      }
      if (results[2].status === 'rejected') {
        log.warn('Failed to load activities', { error: results[2].reason });
      }
    } catch (error) {
      log.error('Unexpected error loading prospect', { error });
      toast({ title: 'Failed to load account', variant: 'destructive' });
    } finally {
      setIsLoadingRef.current(false);
    }
  }, [prospectId, toast]);

  // Initial load
  useEffect(() => {
    if (prospectId) loadProspectData();
  }, [prospectId, loadProspectData]);

  // Wrapper for handleAddActivity to maintain backward compatibility
  const handleAddActivity = useCallback(async (
    newActivity: { type: ProspectActivityType; description: string; date: string }
  ) => {
    return activities.handleAddActivity(core.prospect, newActivity);
  }, [activities, core.prospect]);

  // Email added handler that triggers refresh
  const handleEmailAdded = useCallback(async () => {
    if (!prospectId) return;
    await activities.refreshEmailLogs();
    
    toast({ title: 'Refreshing AI analysis with new email data...' });
    insights.handleRefreshAll();
  }, [prospectId, activities, insights, toast]);

  return {
    // Data
    prospect: core.prospect,
    stakeholders: core.stakeholders,
    relationships: core.relationships,
    activities: activities.activities,
    calls: core.calls,
    followUps: followUps.followUps,
    completedFollowUps: followUps.completedFollowUps,
    dismissedFollowUps: followUps.dismissedFollowUps,
    emailLogs: activities.emailLogs,
    user: activities.user,
    
    // Loading states
    isLoading: core.isLoading,
    isRefreshing: followUps.isRefreshing || insights.isRefreshingAll,
    isRefreshingInsights: insights.isRefreshingInsights,
    
    // Handlers
    loadProspectData,
    handleStatusChange: core.handleStatusChange,
    handleAddActivity,
    handleCompleteFollowUp: followUps.handleCompleteFollowUp,
    handleReopenFollowUp: followUps.handleReopenFollowUp,
    handleDismissFollowUp: followUps.handleDismissFollowUp,
    handleRestoreFollowUp: followUps.handleRestoreFollowUp,
    handleRefreshFollowUps: followUps.handleRefreshFollowUps,
    handleDeleteEmailLog: activities.handleDeleteEmailLog,
    handleRefreshInsightsOnly: insights.handleRefreshInsightsOnly,
    handleEmailAdded,
    handleUpdateProspect: core.handleUpdateProspect,
  };
}
