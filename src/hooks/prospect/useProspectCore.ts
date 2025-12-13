import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import {
  getProspectById,
  updateProspect,
  getCallsForProspect,
  type Prospect,
  type ProspectStatus,
} from '@/api/prospects';
import { listStakeholdersForProspect, type Stakeholder } from '@/api/stakeholders';
import { listRelationshipsForProspect, type StakeholderRelationship } from '@/api/stakeholderRelationships';
import type { CallRecord } from './types';

const log = createLogger('prospectCore');

interface UseProspectCoreOptions {
  prospectId: string | undefined;
}

export function useProspectCore({ prospectId }: UseProspectCoreOptions) {
  const navigate = useNavigate();

  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [relationships, setRelationships] = useState<StakeholderRelationship[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCoreData = useCallback(async () => {
    if (!prospectId) return null;

    try {
      // Use Promise.allSettled to handle partial failures gracefully
      const results = await Promise.allSettled([
        getProspectById(prospectId),
        listStakeholdersForProspect(prospectId),
        listRelationshipsForProspect(prospectId),
        getCallsForProspect(prospectId),
      ]);

      // Extract results, using defaults for failed requests
      const prospectData = results[0].status === 'fulfilled' ? results[0].value : null;
      const stakeholdersData = results[1].status === 'fulfilled' ? results[1].value : [];
      const relationshipsData = results[2].status === 'fulfilled' ? results[2].value : [];
      const callsData = results[3].status === 'fulfilled' ? results[3].value : [];

      // Log any failures for debugging
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const names = ['prospect', 'stakeholders', 'relationships', 'calls'];
          log.warn(`Failed to load ${names[index]}`, { error: result.reason });
        }
      });

      if (!prospectData) {
        toast.error('Account not found');
        // Check current path to navigate appropriately
        const currentPath = window.location.pathname;
        if (currentPath.startsWith('/admin')) {
          navigate('/admin/accounts');
        } else if (currentPath.startsWith('/manager')) {
          navigate('/manager/accounts');
        } else {
          navigate('/rep/prospects');
        }
        return null;
      }

      setProspect(prospectData);
      setStakeholders(stakeholdersData);
      setRelationships(relationshipsData);
      setCalls(callsData);

      return { prospectData, stakeholdersData, relationshipsData, callsData };
    } catch (error) {
      log.error('Unexpected error loading core data', { error });
      throw error;
    }
  }, [prospectId, navigate]);

  const handleStatusChange = useCallback(async (newStatus: ProspectStatus) => {
    if (!prospect) return;
    
    try {
      await updateProspect(prospect.id, { status: newStatus });
      setProspect({ ...prospect, status: newStatus });
      toast.success('Status updated');
    } catch (error) {
      log.error('Failed to update status', { error });
      toast.error('Failed to update status');
    }
  }, [prospect]);

  const handleUpdateProspect = useCallback(async (updates: Partial<Prospect>): Promise<boolean> => {
    if (!prospect) return false;
    try {
      const sanitizedUpdates: Parameters<typeof updateProspect>[1] = {};
      if (updates.status !== undefined) sanitizedUpdates.status = updates.status;
      if (updates.potential_revenue !== undefined) sanitizedUpdates.potential_revenue = updates.potential_revenue ?? undefined;
      if (updates.active_revenue !== undefined) sanitizedUpdates.active_revenue = updates.active_revenue ?? undefined;
      if (updates.salesforce_link !== undefined) sanitizedUpdates.salesforce_link = updates.salesforce_link;
      if (updates.opportunity_link !== undefined) sanitizedUpdates.opportunity_link = updates.opportunity_link;
      if (updates.industry !== undefined) sanitizedUpdates.industry = updates.industry;
      if (updates.website !== undefined) sanitizedUpdates.website = updates.website;
      if (updates.ai_extracted_info !== undefined) sanitizedUpdates.ai_extracted_info = updates.ai_extracted_info ?? undefined;
      if (updates.suggested_follow_ups !== undefined) sanitizedUpdates.suggested_follow_ups = updates.suggested_follow_ups ?? undefined;
      if (updates.heat_score !== undefined) sanitizedUpdates.heat_score = updates.heat_score ?? undefined;
      
      await updateProspect(prospect.id, sanitizedUpdates);
      setProspect({ ...prospect, ...updates });
      return true;
    } catch (error) {
      log.error('Failed to update prospect', { error });
      return false;
    }
  }, [prospect]);

  const refreshCalls = useCallback(async () => {
    if (!prospectId) return;
    const callsData = await getCallsForProspect(prospectId);
    setCalls(callsData);
  }, [prospectId]);

  const refreshProspect = useCallback(async () => {
    if (!prospectId) return;
    const prospectData = await getProspectById(prospectId);
    if (prospectData) setProspect(prospectData);
  }, [prospectId]);

  return {
    // State
    prospect,
    stakeholders,
    relationships,
    calls,
    isLoading,
    
    // Setters for external updates
    setProspect,
    setIsLoading,
    
    // Actions
    loadCoreData,
    handleStatusChange,
    handleUpdateProspect,
    refreshCalls,
    refreshProspect,
  };
}