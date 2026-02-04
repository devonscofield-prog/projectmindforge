import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, Mail, Clock, Globe } from 'lucide-react';
import { toast } from 'sonner';
import {
  getNotificationPreferences,
  upsertNotificationPreferences,
  COMMON_TIMEZONES,
  REMINDER_TIMES,
  type NotificationPreferencesUpdate,
} from '@/api/notificationPreferences';

export function NotificationPreferences() {
  const queryClient = useQueryClient();
  
  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: getNotificationPreferences,
  });

  const mutation = useMutation({
    mutationFn: upsertNotificationPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success('Notification preferences saved');
    },
    onError: () => {
      toast.error('Failed to save preferences');
    },
  });

  const handleUpdate = (updates: NotificationPreferencesUpdate) => {
    mutation.mutate({
      email_enabled: prefs?.email_enabled ?? true,
      reminder_time: prefs?.reminder_time ?? '09:00',
      timezone: prefs?.timezone ?? 'America/New_York',
      notify_due_today: prefs?.notify_due_today ?? true,
      notify_due_tomorrow: prefs?.notify_due_tomorrow ?? true,
      notify_overdue: prefs?.notify_overdue ?? true,
      ...updates,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  const emailEnabled = prefs?.email_enabled ?? true;
  const reminderTime = prefs?.reminder_time ?? '09:00';
  const timezone = prefs?.timezone ?? 'America/New_York';
  const notifyDueToday = prefs?.notify_due_today ?? true;
  const notifyDueTomorrow = prefs?.notify_due_tomorrow ?? true;
  const notifyOverdue = prefs?.notify_overdue ?? true;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Configure how and when you receive follow-up task reminders
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email Reminders Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="email-enabled" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Email Reminders
            </Label>
            <p className="text-sm text-muted-foreground">
              Receive daily digest of due and overdue tasks
            </p>
          </div>
          <Switch
            id="email-enabled"
            checked={emailEnabled}
            onCheckedChange={(checked) => handleUpdate({ email_enabled: checked })}
            disabled={mutation.isPending}
          />
        </div>

        {emailEnabled && (
          <>
            {/* Reminder Time */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Reminder Time
              </Label>
              <Select
                value={reminderTime}
                onValueChange={(value) => handleUpdate({ reminder_time: value })}
                disabled={mutation.isPending}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_TIMES.map((time) => (
                    <SelectItem key={time.value} value={time.value}>
                      {time.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Timezone */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Timezone
              </Label>
              <Select
                value={timezone}
                onValueChange={(value) => handleUpdate({ timezone: value })}
                disabled={mutation.isPending}
              >
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* What to notify about */}
            <div className="space-y-3">
              <Label>Remind me about:</Label>
              <div className="space-y-3 pl-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="notify-overdue"
                    checked={notifyOverdue}
                    onCheckedChange={(checked) =>
                      handleUpdate({ notify_overdue: checked === true })
                    }
                    disabled={mutation.isPending}
                  />
                  <Label
                    htmlFor="notify-overdue"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Overdue tasks
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="notify-due-today"
                    checked={notifyDueToday}
                    onCheckedChange={(checked) =>
                      handleUpdate({ notify_due_today: checked === true })
                    }
                    disabled={mutation.isPending}
                  />
                  <Label
                    htmlFor="notify-due-today"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Tasks due today
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="notify-due-tomorrow"
                    checked={notifyDueTomorrow}
                    onCheckedChange={(checked) =>
                      handleUpdate({ notify_due_tomorrow: checked === true })
                    }
                    disabled={mutation.isPending}
                  />
                  <Label
                    htmlFor="notify-due-tomorrow"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Tasks due tomorrow
                  </Label>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
