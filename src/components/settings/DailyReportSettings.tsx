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
import { FileBarChart, Clock, Globe, Users, Calendar, Lightbulb, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getDailyReportConfig,
  upsertDailyReportConfig,
  sendTestDailyReport,
  getTeamReps,
  type DailyReportConfigUpdate,
} from '@/api/dailyReportConfig';
import {
  detectBrowserTimezone,
  getTimezoneLabel,
  COMMON_TIMEZONES,
  REMINDER_TIMES,
} from '@/api/notificationPreferences';

export function DailyReportSettings() {
  const queryClient = useQueryClient();
  const [detectedTimezone, setDetectedTimezone] = useState<string | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ['daily-report-config'],
    queryFn: getDailyReportConfig,
  });

  const { data: reps = [], isLoading: repsLoading } = useQuery({
    queryKey: ['team-reps-for-report'],
    queryFn: getTeamReps,
  });

  useEffect(() => {
    const detected = detectBrowserTimezone();
    if (detected) setDetectedTimezone(detected);
  }, []);

  const mutation = useMutation({
    mutationFn: upsertDailyReportConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-report-config'] });
      toast.success('Daily report settings saved');
    },
    onError: () => {
      toast.error('Failed to save settings');
    },
  });

  const testMutation = useMutation({
    mutationFn: sendTestDailyReport,
    onSuccess: (data) => {
      if (data.sent && data.sent > 0) {
        toast.success('Test report sent! Check your inbox.');
      } else {
        toast.info(data.message || 'No calls found for the report period.');
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to send test report', { description: error.message });
    },
  });

  const handleUpdate = (updates: DailyReportConfigUpdate) => {
    mutation.mutate({
      enabled: config?.enabled ?? true,
      delivery_time: config?.delivery_time ?? '08:00',
      timezone: config?.timezone ?? 'America/New_York',
      rep_ids: config?.rep_ids ?? null,
      include_weekends: config?.include_weekends ?? false,
      ...updates,
    });
  };

  const handleRepToggle = (repId: string, checked: boolean) => {
    const currentIds = config?.rep_ids || [];
    const allSelected = config?.rep_ids === null;

    let newIds: string[] | null;
    if (allSelected) {
      // Switching from "all" to specific: start with all reps minus the unchecked one
      newIds = checked
        ? null // shouldn't happen since allSelected means all are checked
        : reps.map(r => r.id).filter(id => id !== repId);
    } else if (checked) {
      newIds = [...currentIds, repId];
      // If all reps are now selected, set to null (= all)
      if (newIds.length >= reps.length) newIds = null;
    } else {
      newIds = currentIds.filter(id => id !== repId);
    }

    handleUpdate({ rep_ids: newIds });
  };

  const handleSelectAllReps = (checked: boolean) => {
    handleUpdate({ rep_ids: checked ? null : [] });
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
        </CardContent>
      </Card>
    );
  }

  const enabled = config?.enabled ?? true;
  const deliveryTime = config?.delivery_time ?? '08:00';
  const timezone = config?.timezone ?? 'America/New_York';
  const repIds = config?.rep_ids;
  const includeWeekends = config?.include_weekends ?? false;
  const allRepsSelected = repIds === null;
  const showTimezoneDetection = detectedTimezone && detectedTimezone !== timezone;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileBarChart className="h-5 w-5" />
          Daily Call Report
        </CardTitle>
        <CardDescription>
          Receive a daily email summary of your team's call activity, performance scores, and pipeline created
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="daily-report-enabled">Enable Daily Report</Label>
            <p className="text-sm text-muted-foreground">
              Get a summary email every weekday morning
            </p>
          </div>
          <Switch
            id="daily-report-enabled"
            checked={enabled}
            onCheckedChange={(checked) => handleUpdate({ enabled: checked })}
            disabled={mutation.isPending}
          />
        </div>

        {enabled && (
          <>
            {/* Delivery Time */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Delivery Time
              </Label>
              <Select
                value={deliveryTime}
                onValueChange={(value) => handleUpdate({ delivery_time: value })}
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
                      onClick={() => {
                        handleUpdate({ timezone: detectedTimezone });
                        toast.success(`Timezone set to ${getTimezoneLabel(detectedTimezone)}`);
                      }}
                      disabled={mutation.isPending}
                    >
                      Use Detected
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Include Weekends */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="include-weekends" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Include Weekend Reports
                </Label>
                <p className="text-sm text-muted-foreground">
                  Send reports on Monday covering Saturday/Sunday calls
                </p>
              </div>
              <Switch
                id="include-weekends"
                checked={includeWeekends}
                onCheckedChange={(checked) => handleUpdate({ include_weekends: checked })}
                disabled={mutation.isPending}
              />
            </div>

            {/* Rep Selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Reps to Include
              </Label>
              <p className="text-sm text-muted-foreground">
                Choose which team members appear in your daily report
              </p>

              {repsLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : reps.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No team members found</p>
              ) : (
                <div className="space-y-2 pl-1 max-h-48 overflow-y-auto">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Checkbox
                      id="all-reps"
                      checked={allRepsSelected}
                      onCheckedChange={(checked) => handleSelectAllReps(checked === true)}
                      disabled={mutation.isPending}
                    />
                    <Label htmlFor="all-reps" className="text-sm font-medium cursor-pointer">
                      All Team Members
                    </Label>
                  </div>
                  {reps.map((rep) => {
                    const isChecked = allRepsSelected || (repIds?.includes(rep.id) ?? false);
                    return (
                      <div key={rep.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`rep-${rep.id}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => handleRepToggle(rep.id, checked === true)}
                          disabled={mutation.isPending}
                        />
                        <Label htmlFor={`rep-${rep.id}`} className="text-sm font-normal cursor-pointer">
                          {rep.name}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Send Test Report */}
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}
              >
                {testMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Test Report
                  </>
                )}
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                Sends a test daily report to your email with yesterday's data
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
