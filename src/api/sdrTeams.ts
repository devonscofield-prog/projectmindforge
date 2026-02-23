import { supabase } from '@/integrations/supabase/client';

// TODO: Remove once sdr_team_invites is added to generated Supabase types
const sdrTeamInvitesTable = () =>
  (supabase.from as (table: string) => ReturnType<typeof supabase.from>)('sdr_team_invites');

export async function createSDRTeam(name: string, managerId: string): Promise<void> {
  const { error } = await supabase
    .from('sdr_teams')
    .insert({ name, manager_id: managerId });
  if (error) throw error;
}

export async function updateSDRTeam(id: string, name: string, managerId: string): Promise<void> {
  const { error } = await supabase
    .from('sdr_teams')
    .update({ name, manager_id: managerId })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSDRTeam(id: string): Promise<void> {
  // Remove members first
  const { error: membersError } = await supabase
    .from('sdr_team_members')
    .delete()
    .eq('team_id', id);
  if (membersError) throw membersError;

  const { error } = await supabase.from('sdr_teams').delete().eq('id', id);
  if (error) throw error;
}

export async function addSDRTeamMember(teamId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('sdr_team_members')
    .insert({ team_id: teamId, user_id: userId });
  if (error) throw error;
}

export async function removeSDRTeamMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('sdr_team_members')
    .delete()
    .eq('id', memberId);
  if (error) throw error;
}

export interface TeamInviteLink {
  id: string;
  invite_token: string;
  is_active: boolean;
  max_uses: number | null;
  times_used: number;
  expires_at: string | null;
  created_at: string;
}

export async function generateTeamInviteLink(
  teamId: string,
  createdBy: string,
): Promise<TeamInviteLink> {
  const { data, error } = await sdrTeamInvitesTable()
    .insert({ team_id: teamId, created_by: createdBy })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as TeamInviteLink;
}

export async function deactivateTeamInviteLink(linkId: string): Promise<void> {
  const { error } = await sdrTeamInvitesTable()
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', linkId);
  if (error) throw error;
}

export async function fetchActiveTeamInviteLinks(teamId: string): Promise<TeamInviteLink[]> {
  const { data, error } = await sdrTeamInvitesTable()
    .select('*')
    .eq('team_id', teamId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as TeamInviteLink[];
}
