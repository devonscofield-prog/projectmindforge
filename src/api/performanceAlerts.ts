import { supabase } from "@/integrations/supabase/client";

export interface AlertConfig {
  id: string;
  user_id: string;
  email: string;
  alert_on_warning: boolean;
  alert_on_critical: boolean;
  cooldown_hours: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlertHistory {
  id: string;
  config_id: string;
  alert_type: string;
  metric_type: string;
  metric_value: number;
  threshold_value: number;
  sent_at: string;
  email_sent_to: string;
}

export async function getAlertConfig(): Promise<AlertConfig | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("performance_alert_config")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching alert config:", error);
    throw error;
  }

  return data as AlertConfig | null;
}

export async function createAlertConfig(config: {
  email: string;
  alert_on_warning?: boolean;
  alert_on_critical?: boolean;
  cooldown_hours?: number;
  enabled?: boolean;
}): Promise<AlertConfig> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("performance_alert_config")
    .insert({
      user_id: user.id,
      email: config.email,
      alert_on_warning: config.alert_on_warning ?? false,
      alert_on_critical: config.alert_on_critical ?? true,
      cooldown_hours: config.cooldown_hours ?? 4,
      enabled: config.enabled ?? true,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating alert config:", error);
    throw error;
  }

  return data as AlertConfig;
}

export async function updateAlertConfig(
  id: string,
  updates: Partial<{
    email: string;
    alert_on_warning: boolean;
    alert_on_critical: boolean;
    cooldown_hours: number;
    enabled: boolean;
  }>
): Promise<AlertConfig> {
  const { data, error } = await supabase
    .from("performance_alert_config")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating alert config:", error);
    throw error;
  }

  return data as AlertConfig;
}

export async function deleteAlertConfig(id: string): Promise<void> {
  const { error } = await supabase
    .from("performance_alert_config")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting alert config:", error);
    throw error;
  }
}

export async function getAlertHistory(limit = 50): Promise<AlertHistory[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("performance_alert_history")
    .select(`
      *,
      performance_alert_config!inner(user_id)
    `)
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching alert history:", error);
    throw error;
  }

  return (data || []).map(item => ({
    id: item.id,
    config_id: item.config_id,
    alert_type: item.alert_type,
    metric_type: item.metric_type,
    metric_value: item.metric_value,
    threshold_value: item.threshold_value,
    sent_at: item.sent_at,
    email_sent_to: item.email_sent_to,
  })) as AlertHistory[];
}

export async function sendTestAlert(): Promise<void> {
  const config = await getAlertConfig();
  if (!config) {
    throw new Error("No alert configuration found. Please configure alerts first.");
  }

  const { error } = await supabase.functions.invoke("send-performance-alert", {
    body: {
      config_id: config.id,
      email: config.email,
      alert_type: "warning",
      metrics: [
        {
          metric_type: "test",
          metric_value: 999,
          threshold_value: 500,
          status: "warning",
        },
      ],
    },
  });

  if (error) {
    console.error("Error sending test alert:", error);
    throw error;
  }
}

export async function triggerAlertCheck(): Promise<{
  status: string;
  alerts_sent: number;
}> {
  const { data, error } = await supabase.functions.invoke("check-performance-alerts");

  if (error) {
    console.error("Error triggering alert check:", error);
    throw error;
  }

  return data;
}
