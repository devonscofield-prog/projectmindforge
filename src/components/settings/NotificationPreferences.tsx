import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, Mail, Clock, Globe, Calendar, Target, Lightbulb, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getNotificationPreferences,
  upsertNotificationPreferences,
  sendTestReminderEmail,
  detectBrowserTimezone,
  getTimezoneLabel,
  COMMON_TIMEZONES,
  REMINDER_TIMES,
  PRIORITY_FILTERS,
  type NotificationPreferencesUpdate,
} from '@/api/notificationPreferences';

export function NotificationPreferences() {
  const queryClient = useQueryClient();
  const [detectedTimezone, setDetectedTimezone] = useState<string | null>(null);
  const [secondaryEnabled, setSecondaryEnabled] = useState(false);
  
  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: getNotificationPreferences,
  });

  // Detect browser timezone on mount
  useEffect(() => {
    const detected = detectBrowserTimezone();
    if (detected) {
      setDetectedTimezone(detected);
    }
  }, []);

  // Sync secondary enabled state with prefs
  useEffect(() => {
    if (prefs?.secondary_reminder_time) {
      setSecondaryEnabled(true);
    }
  }, [prefs?.secondary_reminder_time]);

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

  const testEmailMutation = useMutation({
    mutationFn: sendTestReminderEmail,
    onSuccess: (data) => {
      if (data.sent && data.sent > 0) {
        toast.success('Test email sent! Check your inbox.');
      } else {
        toast.info(data.message || 'No tasks to include in test email. Create a task with reminders enabled first.');
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to send test email', { description: error.message });
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
      secondary_reminder_time: prefs?.secondary_reminder_time ?? null,
      exclude_weekends: prefs?.exclude_weekends ?? false,
      min_priority: prefs?.min_priority ?? null,
      ...updates,
    });
  };

  const handleSecondaryToggle = (enabled: boolean) => {
    setSecondaryEnabled(enabled);
    if (!enabled) {
      handleUpdate({ secondary_reminder_time: null });
    } else {
      // Default to 5 PM if enabling
      handleUpdate({ secondary_reminder_time: '17:00' });
    }
  };

  const handleUseDetectedTimezone = () => {
    if (detectedTimezone) {
      handleUpdate({ timezone: detectedTimezone });
      toast.success(`Timezone set to ${getTimezoneLabel(detectedTimezone)}`);
    }
  };

  const handlePriorityChange = (value: string) => {
    // Convert 'all' back to null for the database
    handleUpdate({ min_priority: value === 'all' ? null : value });
  };

  const handleSendTestEmail = () => {
    testEmailMutation.mutate();
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
  const secondaryReminderTime = prefs?.secondary_reminder_time ?? '17:00';
  const timezone = prefs?.timezone ?? 'America/New_York';
  const notifyDueToday = prefs?.notify_due_today ?? true;
  const notifyDueTomorrow = prefs?.notify_due_tomorrow ?? true;
  const notifyOverdue = prefs?.notify_overdue ?? true;
  const excludeWeekends = prefs?.exclude_weekends ?? false;
  // Map null to 'all' for display
  const minPriority = prefs?.min_priority ?? 'all';

  const showTimezoneDetection = detectedTimezone && detectedTimezone !== timezone;

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
            {/* Primary Reminder Time */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Primary Reminder Time
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

            {/* Secondary Reminder Time */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="secondary-enabled" className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Secondary Reminder Time
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get a second daily reminder (optional)
                  </p>
                </div>
                <Switch
                  id="secondary-enabled"
                  checked={secondaryEnabled}
                  onCheckedChange={handleSecondaryToggle}
                  disabled={mutation.isPending}
                />
              </div>
              {secondaryEnabled && (
                <Select
                  value={secondaryReminderTime}
                  onValueChange={(value) => handleUpdate({ secondary_reminder_time: value })}
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
              )}
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

              {/* Timezone Detection Banner */}
              {showTimezoneDetection && (
                <Alert className="mt-2">
                  <Lightbulb className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between gap-2">
                    <span>
                      Detected: <strong>{getTimezoneLabel(detectedTimezone)}</strong>. Use this instead?
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUseDetectedTimezone}
                      disabled={mutation.isPending}
                    >
                      Use Detected
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Exclude Weekends */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="exclude-weekends" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Exclude Weekends
                </Label>
                <p className="text-sm text-muted-foreground">
                  Don't send reminders on Saturday/Sunday
                </p>
              </div>
              <Switch
                id="exclude-weekends"
                checked={excludeWeekends}
                onCheckedChange={(checked) => handleUpdate({ exclude_weekends: checked })}
                disabled={mutation.isPending}
              />
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

            {/* Priority Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                Minimum Priority
              </Label>
              <p className="text-sm text-muted-foreground">
                Only notify for tasks at or above this priority
              </p>
              <Select
                value={minPriority}
                onValueChange={handlePriorityChange}
                disabled={mutation.isPending}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_FILTERS.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Send Test Email */}
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleSendTestEmail}
                disabled={testEmailMutation.isPending}
              >
                {testEmailMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Test Email
                  </>
                )}
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                Sends a test reminder digest to your email address
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
