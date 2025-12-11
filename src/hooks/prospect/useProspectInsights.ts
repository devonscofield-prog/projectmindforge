import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import { getProspectById, regenerateAccountInsights, type Prospect } from '@/api/prospects';
import { refreshFollowUps } from '@/api/accountFollowUps';

const log = createLogger('prospectInsights');

interface UseProspectInsightsOptions {
  prospectId: string | undefined;
  onProspectUpdate: (prospect: Prospect) => void;
  onFollowUpsRefresh: () => Promise<void>;
}

export function useProspectInsights({ 
  prospectId, 
  onProspectUpdate,
  onFollowUpsRefresh,
}: UseProspectInsightsOptions) {
  const [isRefreshingInsights, setIsRefreshingInsights] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  const handleRefreshInsightsOnly = useCallback(async () => {
    if (!prospectId || isRefreshingInsights) return;
    
    setIsRefreshingInsights(true);
    try {
      const result = await regenerateAccountInsights(prospectId);
      if (result.success) {
        const prospectData = await getProspectById(prospectId);
        if (prospectData) onProspectUpdate(prospectData);
        toast.success('AI insights updated');
      } else if (result.isRateLimited) {
        toast.error('Too many requests', { 
          description: 'Please wait a moment before refreshing again.',
        });
      } else {
        toast.error('Failed to refresh insights');
      }
    } catch (error) {
      log.error('Failed to refresh insights', { error });
      toast.error('Failed to refresh insights');
    } finally {
      setIsRefreshingInsights(false);
    }
  }, [prospectId, isRefreshingInsights, onProspectUpdate]);

  const handleRefreshAll = useCallback(async () => {
    if (!prospectId || isRefreshingAll || isRefreshingInsights) return;
    
    setIsRefreshingAll(true);
    setIsRefreshingInsights(true);
    
    try {
      const [followUpsResult, insightsResult] = await Promise.all([
        refreshFollowUps(prospectId),
        regenerateAccountInsights(prospectId)
      ]);
      
      // Refresh follow-ups data
      await onFollowUpsRefresh();
      
      // Refresh prospect data
      const prospectData = await getProspectById(prospectId);
      if (prospectData) onProspectUpdate(prospectData);
      
      const hasRateLimiting = followUpsResult.isRateLimited || insightsResult.isRateLimited;
      
      if (hasRateLimiting) {
        toast.error('Too many requests', { 
          description: 'Please wait a moment before refreshing again.',
        });
      } else if (followUpsResult.success && insightsResult.success) {
        toast.success('AI analysis updated successfully');
      } else {
        toast.info('AI analysis partially updated');
      }
    } catch (error) {
      log.error('Failed to refresh all', { error });
      toast.error('Failed to refresh AI analysis');
    } finally {
      setIsRefreshingAll(false);
      setIsRefreshingInsights(false);
    }
  }, [prospectId, isRefreshingAll, isRefreshingInsights, onProspectUpdate, onFollowUpsRefresh]);

  return {
    // State
    isRefreshingInsights,
    isRefreshingAll,
    
    // Actions
    handleRefreshInsightsOnly,
    handleRefreshAll,
  };
}
