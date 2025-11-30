import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
  
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
      log.error('Failed to refresh insights', { error });
      toast({ title: 'Failed to refresh insights', variant: 'destructive' });
    } finally {
      setIsRefreshingInsights(false);
    }
  }, [prospectId, isRefreshingInsights, onProspectUpdate, toast]);

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
      log.error('Failed to refresh all', { error });
      toast({ title: 'Failed to refresh AI analysis', variant: 'destructive' });
    } finally {
      setIsRefreshingAll(false);
      setIsRefreshingInsights(false);
    }
  }, [prospectId, isRefreshingAll, isRefreshingInsights, onProspectUpdate, onFollowUpsRefresh, toast]);

  return {
    // State
    isRefreshingInsights,
    isRefreshingAll,
    
    // Actions
    handleRefreshInsightsOnly,
    handleRefreshAll,
  };
}
