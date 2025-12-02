import { supabase } from '@/integrations/supabase/client';
import type { ProspectActivityType } from './prospects';

export interface ActivityTemplate {
  id: string;
  user_id: string;
  activity_type: ProspectActivityType;
  template_text: string;
  created_at: string;
  updated_at: string;
}

export async function fetchActivityTemplates(activityType?: ProspectActivityType): Promise<ActivityTemplate[]> {
  let query = supabase
    .from('activity_templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (activityType) {
    query = query.eq('activity_type', activityType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching activity templates:', error);
    throw error;
  }

  return (data || []).map(template => ({
    ...template,
    activity_type: template.activity_type as ProspectActivityType,
    created_at: template.created_at || new Date().toISOString(),
    updated_at: template.updated_at || new Date().toISOString(),
  }));
}

export async function createActivityTemplate(
  activityType: ProspectActivityType,
  templateText: string
): Promise<ActivityTemplate> {
  const { data, error } = await supabase
    .from('activity_templates')
    .insert({
      activity_type: activityType as string,
      template_text: templateText,
    } as any)
    .select()
    .single();

  if (error) {
    console.error('Error creating activity template:', error);
    throw error;
  }

  return {
    ...data,
    activity_type: data.activity_type as ProspectActivityType,
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || new Date().toISOString(),
  };
}

export async function updateActivityTemplate(
  id: string,
  templateText: string
): Promise<ActivityTemplate> {
  const { data, error } = await supabase
    .from('activity_templates')
    .update({ template_text: templateText })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating activity template:', error);
    throw error;
  }

  return {
    ...data,
    activity_type: data.activity_type as ProspectActivityType,
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || new Date().toISOString(),
  };
}

export async function deleteActivityTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('activity_templates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting activity template:', error);
    throw error;
  }
}