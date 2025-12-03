import { supabase } from '@/integrations/supabase/client';

/**
 * Get current user ID from auth context
 * Use this only when you don't have access to AuthContext
 * Prefer passing userId from components when possible
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}
