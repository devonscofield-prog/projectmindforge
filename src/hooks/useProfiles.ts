import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Profile {
  id: string;
  name: string;
  email: string;
  team_id: string | null;
  is_active: boolean;
  hire_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
}

export interface ProfileBasic {
  id: string;
  name: string;
}

/**
 * Fetch all profiles (basic info: id and name)
 */
export function useProfilesBasic(): UseQueryResult<ProfileBasic[], Error> {
  return useQuery({
    queryKey: ['profiles-basic-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as ProfileBasic[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch all profiles with full details
 */
export function useProfilesFull(): UseQueryResult<Profile[], Error> {
  return useQuery({
    queryKey: ['profiles-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as Profile[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch a single profile by ID
 */
export function useProfile(profileId: string | null | undefined): UseQueryResult<Profile | null, Error> {
  return useQuery({
    queryKey: ['profile', profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch multiple profiles by IDs
 */
export function useProfilesByIds(profileIds: string[]): UseQueryResult<(ProfileBasic & { team_id: string | null })[], Error> {
  return useQuery({
    queryKey: ['profiles-by-ids', profileIds.sort().join(',')],
    queryFn: async () => {
      if (!profileIds.length) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, team_id')
        .in('id', profileIds);
      if (error) throw error;
      return (data || []) as (ProfileBasic & { team_id: string | null })[];
    },
    enabled: profileIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch managers (users with manager role)
 */
export function useManagers(): UseQueryResult<ProfileBasic[], Error> {
  return useQuery({
    queryKey: ['managers'],
    queryFn: async () => {
      // Get manager role user IDs
      const { data: managerRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'manager');
      
      if (rolesError) throw rolesError;
      if (!managerRoles?.length) return [];
      
      const managerIds = managerRoles.map(r => r.user_id);
      
      // Get profiles for managers
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', managerIds)
        .order('name');
      
      if (error) throw error;
      return (data || []) as ProfileBasic[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
