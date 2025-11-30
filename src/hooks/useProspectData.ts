import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createLogger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  getProspectById,
  updateProspect,
  listActivitiesForProspect,
  createProspectActivity,
  getCallsForProspect,
  regenerateAccountInsights,
  type Prospect,
  type ProspectActivity,
  type ProspectStatus,
  type ProspectActivityType,
} from '@/api/prospects';
import {
  listStakeholdersForProspect,
  type Stakeholder,
} from '@/api/stakeholders';

const log = createLogger('prospectData');
import {
  listRelationshipsForProspect,
  type StakeholderRelationship,
} from '@/api/stakeholderRelationships';
import {
  listFollowUpsForProspect,
  completeFollowUp,
  reopenFollowUp,
  dismissFollowUp,
  restoreFollowUp,
  refreshFollowUps,
  type AccountFollowUp,
} from '@/api/accountFollowUps';
import {
  listEmailLogsForProspect,
  deleteEmailLog,
  type EmailLog,
} from '@/api/emailLogs';

export interface CallRecord {
  id: string;
  call_date: string;
  call_type: string | null;
  analysis_status: string;
  primary_stakeholder_name: string | null;
}

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [relationships, setRelationships] = useState<StakeholderRelationship[]>([]);
  const [activities, setActivities] = useState<ProspectActivity[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [followUps, setFollowUps] = useState<AccountFollowUp[]>([]);
  const [completedFollowUps, setCompletedFollowUps] = useState<AccountFollowUp[]>([]);
  const [dismissedFollowUps, setDismissedFollowUps] = useState<AccountFollowUp[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshingInsights, setIsRefreshingInsights] = useState(false);

  const handleRefreshAllRef = useRef<(() => Promise<void>) | null>(null);

  const loadProspectData = useCallback(async () => {
    if (!prospectId) return;
    
    setIsLoading(true);
    try {
      const [prospectData, stakeholdersData, relationshipsData, activitiesData, callsData, pendingFollowUps, completedFollowUpsData, dismissedFollowUpsData, emailLogsData] = await Promise.all([
        getProspectById(prospectId),
        listStakeholdersForProspect(prospectId),
        listRelationshipsForProspect(prospectId),
        listActivitiesForProspect(prospectId),
        getCallsForProspect(prospectId),
        listFollowUpsForProspect(prospectId, 'pending'),
        listFollowUpsForProspect(prospectId, 'completed'),
        listFollowUpsForProspect(prospectId, 'dismissed'),
        listEmailLogsForProspect(prospectId),
      ]);

      if (!prospectData) {
        toast({ title: 'Account not found', variant: 'destructive' });
        navigate('/rep/prospects');
        return;
      }

      setProspect(prospectData);
      setStakeholders(stakeholdersData);
      setRelationships(relationshipsData);
      setActivities(activitiesData);
      setCalls(callsData);
      setFollowUps(pendingFollowUps);
      setCompletedFollowUps(completedFollowUpsData);
      setDismissedFollowUps(dismissedFollowUpsData);
      setEmailLogs(emailLogsData);
    } catch (error) {
      log.error('Failed to load prospect', { error });
      toast({ title: 'Failed to load account', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [prospectId, navigate, toast]);

  // Initial load
  useEffect(() => {
    if (prospectId) loadProspectData();
  }, [prospectId, loadProspectData]);

  // Real-time subscription for call analysis completion
  useEffect(() => {
    if (!prospectId) return;

    const channel = supabase
      .channel(`call-analysis-${prospectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_transcripts',
          filter: `prospect_id=eq.${prospectId}`,
        },
        (payload) => {
          const newRecord = payload.new as { analysis_status: string; id: string };
          const oldRecord = payload.old as { analysis_status: string; id: string };
          
          if (
            newRecord.analysis_status === 'completed' &&
            oldRecord.analysis_status !== 'completed'
          ) {
            log.info('Call analysis completed, refreshing AI data...');
            toast({ title: 'New call analysis available, refreshing insights...' });
            
            getCallsForProspect(prospectId).then(setCalls);
            
            setTimeout(() => {
              handleRefreshAllRef.current?.();
            }, 1000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [prospectId, toast]);

  const handleStatusChange = async (newStatus: ProspectStatus) => {
    if (!prospect) return;
    
    try {
      await updateProspect(prospect.id, { status: newStatus });
      setProspect({ ...prospect, status: newStatus });
      toast({ title: 'Status updated' });
    } catch (error) {
      toast({ title: 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleAddActivity = async (newActivity: { type: ProspectActivityType; description: string; date: string }) => {
    if (!prospect || !user?.id) return undefined;
    
    const activity = await createProspectActivity({
      prospectId: prospect.id,
      repId: user.id,
      activityType: newActivity.type,
      description: newActivity.description || undefined,
      activityDate: newActivity.date,
    });

    setActivities([activity, ...activities]);
    toast({ title: 'Activity logged' });
    return activity;
  };

  const handleCompleteFollowUp = async (followUpId: string) => {
    try {
      const updated = await completeFollowUp(followUpId);
      setFollowUps(prev => prev.filter(f => f.id !== followUpId));
      setCompletedFollowUps(prev => [updated, ...prev]);
      toast({ title: 'Follow-up completed' });
    } catch (error) {
      toast({ title: 'Failed to complete follow-up', variant: 'destructive' });
    }
  };

  const handleReopenFollowUp = async (followUpId: string) => {
    try {
      const updated = await reopenFollowUp(followUpId);
      setCompletedFollowUps(prev => prev.filter(f => f.id !== followUpId));
      setFollowUps(prev => [updated, ...prev]);
      toast({ title: 'Follow-up reopened' });
    } catch (error) {
      toast({ title: 'Failed to reopen follow-up', variant: 'destructive' });
    }
  };

  const handleDismissFollowUp = async (followUpId: string) => {
    try {
      const dismissed = await dismissFollowUp(followUpId);
      setFollowUps(prev => prev.filter(f => f.id !== followUpId));
      setDismissedFollowUps(prev => [dismissed, ...prev]);
      toast({ title: 'Follow-up dismissed' });
    } catch (error) {
      toast({ title: 'Failed to dismiss follow-up', variant: 'destructive' });
    }
  };

  const handleRestoreFollowUp = async (followUpId: string) => {
    try {
      const restored = await restoreFollowUp(followUpId);
      setDismissedFollowUps(prev => prev.filter(f => f.id !== followUpId));
      setFollowUps(prev => [restored, ...prev]);
      toast({ title: 'Follow-up restored' });
    } catch (error) {
      toast({ title: 'Failed to restore follow-up', variant: 'destructive' });
    }
  };

  const handleRefreshFollowUps = async () => {
    if (!prospectId) return;
    setIsRefreshing(true);
    try {
      const result = await refreshFollowUps(prospectId);
      if (result.success) {
        const [pendingFollowUps, completedFollowUpsData, dismissedFollowUpsData] = await Promise.all([
          listFollowUpsForProspect(prospectId, 'pending'),
          listFollowUpsForProspect(prospectId, 'completed'),
          listFollowUpsForProspect(prospectId, 'dismissed'),
        ]);
        setFollowUps(pendingFollowUps);
        setCompletedFollowUps(completedFollowUpsData);
        setDismissedFollowUps(dismissedFollowUpsData);
        toast({ title: `Generated ${result.count || 0} new follow-up steps` });
      } else if (result.isRateLimited) {
        toast({ 
          title: 'Too many requests', 
          description: 'Please wait a moment before refreshing again.',
          variant: 'destructive' 
        });
      } else {
        toast({ title: 'Failed to refresh follow-ups', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Failed to refresh follow-ups', variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteEmailLog = async (emailId: string) => {
    try {
      await deleteEmailLog(emailId);
      setEmailLogs(prev => prev.filter(e => e.id !== emailId));
      toast({ title: 'Email log deleted' });
    } catch (error) {
      toast({ title: 'Failed to delete email log', variant: 'destructive' });
    }
  };

  const handleRefreshAll = async () => {
    if (!prospectId || isRefreshing || isRefreshingInsights) return;
    
    setIsRefreshing(true);
    setIsRefreshingInsights(true);
    
    try {
      const [followUpsResult, insightsResult] = await Promise.all([
        refreshFollowUps(prospectId),
        regenerateAccountInsights(prospectId)
      ]);
      
      const [pendingFollowUps, completedFollowUpsData, dismissedFollowUpsData, prospectData] = await Promise.all([
        listFollowUpsForProspect(prospectId, 'pending'),
        listFollowUpsForProspect(prospectId, 'completed'),
        listFollowUpsForProspect(prospectId, 'dismissed'),
        getProspectById(prospectId)
      ]);
      
      setFollowUps(pendingFollowUps);
      setCompletedFollowUps(completedFollowUpsData);
      setDismissedFollowUps(dismissedFollowUpsData);
      if (prospectData) setProspect(prospectData);
      
      // Check for rate limiting
      const hasRateLimiting = followUpsResult.isRateLimited || insightsResult.isRateLimited;
      
      if (hasRateLimiting) {
        toast({ 
          title: 'Too many requests', 
          description: 'Please wait a moment before refreshing again.',
          variant: 'destructive' 
        });
      } else if (followUpsResult.success && insightsResult.success) {
        toast({ title: 'AI analysis updated successfully' });
      } else {
        toast({ title: 'AI analysis partially updated', variant: 'default' });
      }
    } catch (error) {
      toast({ title: 'Failed to refresh AI analysis', variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
      setIsRefreshingInsights(false);
    }
  };

  handleRefreshAllRef.current = handleRefreshAll;

  const handleRefreshInsightsOnly = async () => {
    if (!prospectId || isRefreshingInsights) return;
    
    setIsRefreshingInsights(true);
    try {
      const result = await regenerateAccountInsights(prospectId);
      if (result.success) {
        const prospectData = await getProspectById(prospectId);
        if (prospectData) setProspect(prospectData);
        toast({ title: 'AI insights updated' });
      } else if (result.isRateLimited) {
        toast({ 
          title: 'Too many requests', 
          description: 'Please wait a moment before refreshing again.',
          variant: 'destructive' 
        });
      } else {
        toast({ title: 'Failed to refresh insights', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Failed to refresh insights', variant: 'destructive' });
    } finally {
      setIsRefreshingInsights(false);
    }
  };

  const handleEmailAdded = async () => {
    if (!prospectId) return;
    const emailLogsData = await listEmailLogsForProspect(prospectId);
    setEmailLogs(emailLogsData);
    
    toast({ title: 'Refreshing AI analysis with new email data...' });
    handleRefreshAll();
  };

  const handleUpdateProspect = async (updates: Partial<Prospect>): Promise<boolean> => {
    if (!prospect) return false;
    try {
      // Filter out null values for fields that don't accept null in updateProspect
      const sanitizedUpdates: Parameters<typeof updateProspect>[1] = {};
      if (updates.status !== undefined) sanitizedUpdates.status = updates.status;
      if (updates.potential_revenue !== undefined) sanitizedUpdates.potential_revenue = updates.potential_revenue ?? undefined;
      if (updates.salesforce_link !== undefined) sanitizedUpdates.salesforce_link = updates.salesforce_link;
      if (updates.industry !== undefined) sanitizedUpdates.industry = updates.industry;
      if (updates.ai_extracted_info !== undefined) sanitizedUpdates.ai_extracted_info = updates.ai_extracted_info ?? undefined;
      if (updates.suggested_follow_ups !== undefined) sanitizedUpdates.suggested_follow_ups = updates.suggested_follow_ups ?? undefined;
      if (updates.heat_score !== undefined) sanitizedUpdates.heat_score = updates.heat_score ?? undefined;
      
      await updateProspect(prospect.id, sanitizedUpdates);
      setProspect({ ...prospect, ...updates });
      return true;
    } catch (error) {
      return false;
    }
  };

  return {
    // Data
    prospect,
    stakeholders,
    relationships,
    activities,
    calls,
    followUps,
    completedFollowUps,
    dismissedFollowUps,
    emailLogs,
    user,
    
    // Loading states
    isLoading,
    isRefreshing,
    isRefreshingInsights,
    
    // Handlers
    loadProspectData,
    handleStatusChange,
    handleAddActivity,
    handleCompleteFollowUp,
    handleReopenFollowUp,
    handleDismissFollowUp,
    handleRestoreFollowUp,
    handleRefreshFollowUps,
    handleDeleteEmailLog,
    handleRefreshInsightsOnly,
    handleEmailAdded,
    handleUpdateProspect,
  };
}
