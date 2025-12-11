import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import {
  listActivitiesForProspect,
  createProspectActivity,
  type ProspectActivity,
  type ProspectActivityType,
} from '@/api/prospects';
import {
  listEmailLogsForProspect,
  deleteEmailLog,
  type EmailLog,
} from '@/api/emailLogs';

const log = createLogger('prospectActivities');

interface UseProspectActivitiesOptions {
  prospectId: string | undefined;
}

export function useProspectActivities({ prospectId }: UseProspectActivitiesOptions) {
  const { user } = useAuth();

  const [activities, setActivities] = useState<ProspectActivity[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);

  const loadActivitiesData = useCallback(async () => {
    if (!prospectId) return null;

    const results = await Promise.allSettled([
      listActivitiesForProspect(prospectId),
      listEmailLogsForProspect(prospectId),
    ]);

    // Extract results, using empty arrays for failed requests
    const activitiesData = results[0].status === 'fulfilled' ? results[0].value : [];
    const emailLogsData = results[1].status === 'fulfilled' ? results[1].value : [];

    // Log any failures for debugging
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const names = ['activities', 'emailLogs'];
        log.warn(`Failed to load ${names[index]}`, { error: result.reason });
      }
    });

    setActivities(activitiesData);
    setEmailLogs(emailLogsData);

    return { activitiesData, emailLogsData };
  }, [prospectId]);

  const handleAddActivity = useCallback(async (
    prospect: { id: string } | null,
    newActivity: { type: ProspectActivityType; description: string; date: string }
  ) => {
    if (!prospect || !user?.id) return undefined;
    
    try {
      const activity = await createProspectActivity({
        prospectId: prospect.id,
        repId: user.id,
        activityType: newActivity.type,
        description: newActivity.description || undefined,
        activityDate: newActivity.date,
      });

      setActivities(prev => [activity, ...prev]);
      toast.success('Activity logged');
      return activity;
    } catch (error) {
      log.error('Failed to add activity', { error });
      toast.error('Failed to log activity');
      return undefined;
    }
  }, [user?.id]);

  const handleDeleteEmailLog = useCallback(async (emailId: string) => {
    try {
      await deleteEmailLog(emailId);
      setEmailLogs(prev => prev.filter(e => e.id !== emailId));
      toast.success('Email log deleted');
    } catch (error) {
      log.error('Failed to delete email log', { error });
      toast.error('Failed to delete email log');
    }
  }, []);

  const refreshEmailLogs = useCallback(async () => {
    if (!prospectId) return;
    try {
      const emailLogsData = await listEmailLogsForProspect(prospectId);
      setEmailLogs(emailLogsData);
    } catch (error) {
      log.warn('Failed to refresh email logs', { error });
    }
  }, [prospectId]);

  return {
    // State
    activities,
    emailLogs,
    user,
    
    // Actions
    loadActivitiesData,
    handleAddActivity,
    handleDeleteEmailLog,
    refreshEmailLogs,
  };
}