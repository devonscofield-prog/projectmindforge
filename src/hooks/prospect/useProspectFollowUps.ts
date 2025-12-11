import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import {
  listFollowUpsForProspect,
  completeFollowUp,
  reopenFollowUp,
  dismissFollowUp,
  restoreFollowUp,
  refreshFollowUps,
  type AccountFollowUp,
} from '@/api/accountFollowUps';

const log = createLogger('prospectFollowUps');

interface UseProspectFollowUpsOptions {
  prospectId: string | undefined;
}

export function useProspectFollowUps({ prospectId }: UseProspectFollowUpsOptions) {
  const [followUps, setFollowUps] = useState<AccountFollowUp[]>([]);
  const [completedFollowUps, setCompletedFollowUps] = useState<AccountFollowUp[]>([]);
  const [dismissedFollowUps, setDismissedFollowUps] = useState<AccountFollowUp[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadFollowUpsData = useCallback(async () => {
    if (!prospectId) return null;

    const results = await Promise.allSettled([
      listFollowUpsForProspect(prospectId, 'pending'),
      listFollowUpsForProspect(prospectId, 'completed'),
      listFollowUpsForProspect(prospectId, 'dismissed'),
    ]);

    // Extract results, using empty arrays for failed requests
    const pendingFollowUps = results[0].status === 'fulfilled' ? results[0].value : [];
    const completedFollowUpsData = results[1].status === 'fulfilled' ? results[1].value : [];
    const dismissedFollowUpsData = results[2].status === 'fulfilled' ? results[2].value : [];

    // Log any failures for debugging
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const types = ['pending', 'completed', 'dismissed'];
        log.warn(`Failed to load ${types[index]} follow-ups`, { error: result.reason });
      }
    });

    setFollowUps(pendingFollowUps);
    setCompletedFollowUps(completedFollowUpsData);
    setDismissedFollowUps(dismissedFollowUpsData);

    return { pendingFollowUps, completedFollowUpsData, dismissedFollowUpsData };
  }, [prospectId]);

  const handleCompleteFollowUp = useCallback(async (followUpId: string) => {
    try {
      const updated = await completeFollowUp(followUpId);
      setFollowUps(prev => prev.filter(f => f.id !== followUpId));
      setCompletedFollowUps(prev => [updated, ...prev]);
      toast.success('Follow-up completed');
    } catch (error) {
      log.error('Failed to complete follow-up', { error });
      toast.error('Failed to complete follow-up');
    }
  }, []);

  const handleReopenFollowUp = useCallback(async (followUpId: string) => {
    try {
      const updated = await reopenFollowUp(followUpId);
      setCompletedFollowUps(prev => prev.filter(f => f.id !== followUpId));
      setFollowUps(prev => [updated, ...prev]);
      toast.success('Follow-up reopened');
    } catch (error) {
      log.error('Failed to reopen follow-up', { error });
      toast.error('Failed to reopen follow-up');
    }
  }, []);

  const handleDismissFollowUp = useCallback(async (followUpId: string) => {
    try {
      const dismissed = await dismissFollowUp(followUpId);
      setFollowUps(prev => prev.filter(f => f.id !== followUpId));
      setDismissedFollowUps(prev => [dismissed, ...prev]);
      toast.success('Follow-up dismissed');
    } catch (error) {
      log.error('Failed to dismiss follow-up', { error });
      toast.error('Failed to dismiss follow-up');
    }
  }, []);

  const handleRestoreFollowUp = useCallback(async (followUpId: string) => {
    try {
      const restored = await restoreFollowUp(followUpId);
      setDismissedFollowUps(prev => prev.filter(f => f.id !== followUpId));
      setFollowUps(prev => [restored, ...prev]);
      toast.success('Follow-up restored');
    } catch (error) {
      log.error('Failed to restore follow-up', { error });
      toast.error('Failed to restore follow-up');
    }
  }, []);

  const handleRefreshFollowUps = useCallback(async () => {
    if (!prospectId) return;
    setIsRefreshing(true);
    try {
      const result = await refreshFollowUps(prospectId);
      if (result.success) {
        await loadFollowUpsData();
        toast.success(`Generated ${result.count || 0} new follow-up steps`);
      } else if (result.isRateLimited) {
        toast.error('Too many requests', { 
          description: 'Please wait a moment before refreshing again.' 
        });
      } else {
        toast.error('Failed to refresh follow-ups');
      }
    } catch (error) {
      log.error('Failed to refresh follow-ups', { error });
      toast.error('Failed to refresh follow-ups');
    } finally {
      setIsRefreshing(false);
    }
  }, [prospectId, loadFollowUpsData]);

  return {
    // State
    followUps,
    completedFollowUps,
    dismissedFollowUps,
    isRefreshing,
    
    // Setters
    setIsRefreshing,
    
    // Actions
    loadFollowUpsData,
    handleCompleteFollowUp,
    handleReopenFollowUp,
    handleDismissFollowUp,
    handleRestoreFollowUp,
    handleRefreshFollowUps,
  };
}