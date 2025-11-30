import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();

  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [relationships, setRelationships] = useState<StakeholderRelationship[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCoreData = useCallback(async () => {
    if (!prospectId) return null;

    const [prospectData, stakeholdersData, relationshipsData, callsData] = await Promise.all([
      getProspectById(prospectId),
      listStakeholdersForProspect(prospectId),
      listRelationshipsForProspect(prospectId),
      getCallsForProspect(prospectId),
    ]);

    if (!prospectData) {
      toast({ title: 'Account not found', variant: 'destructive' });
      navigate('/rep/prospects');
      return null;
    }

    setProspect(prospectData);
    setStakeholders(stakeholdersData);
    setRelationships(relationshipsData);
    setCalls(callsData);

    return { prospectData, stakeholdersData, relationshipsData, callsData };
  }, [prospectId, navigate, toast]);

  const handleStatusChange = useCallback(async (newStatus: ProspectStatus) => {
    if (!prospect) return;
    
    try {
      await updateProspect(prospect.id, { status: newStatus });
      setProspect({ ...prospect, status: newStatus });
      toast({ title: 'Status updated' });
    } catch (error) {
      log.error('Failed to update status', { error });
      toast({ title: 'Failed to update status', variant: 'destructive' });
    }
  }, [prospect, toast]);

  const handleUpdateProspect = useCallback(async (updates: Partial<Prospect>): Promise<boolean> => {
    if (!prospect) return false;
    try {
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
