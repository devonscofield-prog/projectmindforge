import { supabase } from '@/integrations/supabase/client';

export type AiMode = 'mock' | 'real';

/**
 * Get current AI mode from app_settings
 */
export async function getAiMode(): Promise<AiMode> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'ai_mode')
    .maybeSingle();

  if (error) {
    console.warn('[getAiMode] Could not fetch AI mode:', error.message);
    return 'mock';
  }

  if (!data) {
    console.warn('[getAiMode] No AI mode setting found, defaulting to mock');
    return 'mock';
  }

  const value = data.value;
  return value === 'real' ? 'real' : 'mock';
}

/**
 * Set AI mode in app_settings (admin only)
 */
export async function setAiMode(mode: AiMode): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert(
      { key: 'ai_mode', value: mode, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

  if (error) {
    throw new Error(`Failed to update AI mode: ${error.message}`);
  }
}
