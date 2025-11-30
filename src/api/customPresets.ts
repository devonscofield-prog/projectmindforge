import { supabase } from '@/integrations/supabase/client';

export interface CustomPreset {
  id: string;
  admin_id: string;
  name: string;
  description: string | null;
  mode_ids: string[];
  starter_prompt: string;
  icon_name: string;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomPresetParams {
  name: string;
  description?: string;
  mode_ids: string[];
  starter_prompt: string;
  icon_name?: string;
  is_shared?: boolean;
}

export interface UpdateCustomPresetParams extends Partial<CreateCustomPresetParams> {
  id: string;
}

export async function fetchCustomPresets(): Promise<CustomPreset[]> {
  const { data, error } = await supabase
    .from('admin_custom_presets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching custom presets:', error);
    throw error;
  }

  return (data || []) as CustomPreset[];
}

export async function createCustomPreset(params: CreateCustomPresetParams): Promise<CustomPreset> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('You must be logged in to create presets');
  }

  const { data, error } = await supabase
    .from('admin_custom_presets')
    .insert({
      admin_id: user.id,
      name: params.name,
      description: params.description || null,
      mode_ids: params.mode_ids,
      starter_prompt: params.starter_prompt,
      icon_name: params.icon_name || 'layers',
      is_shared: params.is_shared || false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating custom preset:', error);
    throw error;
  }

  return data as CustomPreset;
}

export async function updateCustomPreset(params: UpdateCustomPresetParams): Promise<CustomPreset> {
  const { id, ...updates } = params;
  
  const { data, error } = await supabase
    .from('admin_custom_presets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating custom preset:', error);
    throw error;
  }

  return data as CustomPreset;
}

export async function deleteCustomPreset(id: string): Promise<void> {
  const { error } = await supabase
    .from('admin_custom_presets')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting custom preset:', error);
    throw error;
  }
}
