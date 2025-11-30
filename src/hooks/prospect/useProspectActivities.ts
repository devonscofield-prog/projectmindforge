import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();

  const [activities, setActivities] = useState<ProspectActivity[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);

  const loadActivitiesData = useCallback(async () => {
    if (!prospectId) return null;

    const [activitiesData, emailLogsData] = await Promise.all([
      listActivitiesForProspect(prospectId),
      listEmailLogsForProspect(prospectId),
    ]);

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
      toast({ title: 'Activity logged' });
      return activity;
    } catch (error) {
      log.error('Failed to add activity', { error });
      toast({ title: 'Failed to log activity', variant: 'destructive' });
      return undefined;
    }
  }, [user?.id, toast]);

  const handleDeleteEmailLog = useCallback(async (emailId: string) => {
    try {
      await deleteEmailLog(emailId);
      setEmailLogs(prev => prev.filter(e => e.id !== emailId));
      toast({ title: 'Email log deleted' });
    } catch (error) {
      log.error('Failed to delete email log', { error });
      toast({ title: 'Failed to delete email log', variant: 'destructive' });
    }
  }, [toast]);

  const refreshEmailLogs = useCallback(async () => {
    if (!prospectId) return;
    const emailLogsData = await listEmailLogsForProspect(prospectId);
    setEmailLogs(emailLogsData);
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
