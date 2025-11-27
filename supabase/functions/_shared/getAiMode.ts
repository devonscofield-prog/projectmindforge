import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AiMode = "mock" | "real";

/**
 * Get current AI mode from database app_settings, with env var fallback
 */
export async function getCurrentAiMode(client: SupabaseClient): Promise<AiMode> {
  try {
    const { data, error } = await client
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_mode')
      .maybeSingle();

    if (!error && data) {
      const value = data.value;
      if (value === 'mock' || value === 'real') {
        console.log(`[getAiMode] Retrieved from DB: ${value}`);
        return value;
      }
    }
    
    if (error) {
      console.warn('[getAiMode] Error fetching from DB:', error.message);
    }
  } catch (err) {
    console.warn('[getAiMode] Exception fetching from DB, using env fallback:', err);
  }

  // Fallback to environment variable
  const useMockEnv = Deno.env.get('USE_MOCK_AI');
  const fallbackMode: AiMode = useMockEnv === 'true' ? 'mock' : 'real';
  console.log(`[getAiMode] Using env fallback: ${fallbackMode} (USE_MOCK_AI=${useMockEnv})`);
  return fallbackMode;
}
