import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Mail, Clock, AlertTriangle, CheckCircle, Send, History, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  getAlertConfig,
  createAlertConfig,
  updateAlertConfig,
  getAlertHistory,
  sendTestAlert,
  AlertConfig,
  AlertHistory,
} from "@/api/performanceAlerts";
import { useAuth } from "@/contexts/AuthContext";

export function AlertConfigPanel() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  
  const [email, setEmail] = useState("");
  const [alertOnWarning, setAlertOnWarning] = useState(false);
  const [alertOnCritical, setAlertOnCritical] = useState(true);
  const [cooldownHours, setCooldownHours] = useState(4);
  const [enabled, setEnabled] = useState(true);

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["alertConfig", user?.id],
    queryFn: () => {
      if (!user?.id) return null;
      return getAlertConfig(user.id);
    },
    enabled: !!user?.id,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["alertHistory", user?.id],
    queryFn: () => {
      if (!user?.id) return [];
      return getAlertHistory(user.id, 20);
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (config) {
      setEmail(config.email);
      setAlertOnWarning(config.alert_on_warning);
      setAlertOnCritical(config.alert_on_critical);
      setCooldownHours(config.cooldown_hours);
      setEnabled(config.enabled);
    } else if (profile?.email) {
      setEmail(profile.email);
    }
  }, [config, profile]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      
      if (config) {
        return updateAlertConfig(config.id, {
          email,
          alert_on_warning: alertOnWarning,
          alert_on_critical: alertOnCritical,
          cooldown_hours: cooldownHours,
          enabled,
        });
      } else {
        return createAlertConfig(user.id, {
          email,
          alert_on_warning: alertOnWarning,
          alert_on_critical: alertOnCritical,
          cooldown_hours: cooldownHours,
          enabled,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertConfig"] });
      toast.success("Alert settings saved");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save settings: ${error.message}`);
    },
  });

  const testMutation = useMutation({
    mutationFn: sendTestAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertHistory"] });
      toast.success("Test alert sent! Check your email.");
    },
    onError: (error: Error) => {
      toast.error(`Failed to send test alert: ${error.message}`);
    },
  });

  const hasChanges = config
    ? email !== config.email ||
      alertOnWarning !== config.alert_on_warning ||
      alertOnCritical !== config.alert_on_critical ||
      cooldownHours !== config.cooldown_hours ||
      enabled !== config.enabled
    : email.length > 0;

  if (configLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alert Configuration
          </CardTitle>
          <CardDescription>
            Configure email alerts for performance threshold breaches
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Receive email notifications when thresholds are exceeded
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <Separator />

          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="alert-email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Alert Email
            </Label>
            <Input
              id="alert-email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!enabled}
            />
          </div>

          {/* Alert Levels */}
          <div className="space-y-4">
            <Label className="text-base">Alert Levels</Label>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">Warning Alerts</span>
              </div>
              <Switch
                checked={alertOnWarning}
                onCheckedChange={setAlertOnWarning}
                disabled={!enabled}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm">Critical Alerts</span>
              </div>
              <Switch
                checked={alertOnCritical}
                onCheckedChange={setAlertOnCritical}
                disabled={!enabled}
              />
            </div>
          </div>

          <Separator />

          {/* Cooldown Period */}
          <div className="space-y-2">
            <Label htmlFor="cooldown" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Cooldown Period (hours)
            </Label>
            <p className="text-sm text-muted-foreground">
              Minimum time between alerts of the same type
            </p>
            <Input
              id="cooldown"
              type="number"
              min={1}
              max={24}
              value={cooldownHours}
              onChange={(e) => setCooldownHours(parseInt(e.target.value) || 4)}
              disabled={!enabled}
              className="w-24"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Settings
            </Button>
            <Button
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={!config || testMutation.isPending}
            >
              {testMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send Test Alert
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alert History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Alert History
          </CardTitle>
          <CardDescription>
            Recent performance alerts that were sent
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !history || history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <BellOff className="h-8 w-8 mb-2" />
              <p className="text-sm">No alerts sent yet</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {history.map((alert) => (
                  <AlertHistoryItem key={alert.id} alert={alert} />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AlertHistoryItem({ alert }: { alert: AlertHistory }) {
  const isCritical = alert.alert_type === "critical";

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
      <div className={`mt-0.5 ${isCritical ? "text-destructive" : "text-yellow-500"}`}>
        <AlertTriangle className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={isCritical ? "destructive" : "secondary"}>
            {alert.alert_type}
          </Badge>
          <span className="text-sm font-medium">{alert.metric_type}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Value: {alert.metric_value?.toFixed(2)} (threshold: {alert.threshold_value})
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Sent to {alert.email_sent_to} • {format(new Date(alert.sent_at), "MMM d, h:mm a")}
        </p>
      </div>
    </div>
  );
}
