import { supabase } from '@/integrations/supabase/client';

export type RelationshipType = 'reports_to' | 'influences' | 'collaborates_with' | 'opposes';

export interface StakeholderRelationship {
  id: string;
  prospect_id: string;
  source_stakeholder_id: string;
  target_stakeholder_id: string;
  relationship_type: RelationshipType;
  strength: number;
  notes: string | null;
  rep_id: string;
  created_at: string;
  updated_at: string;
}

export const relationshipTypeLabels: Record<RelationshipType, string> = {
  reports_to: 'Reports To',
  influences: 'Influences',
  collaborates_with: 'Collaborates With',
  opposes: 'Opposes',
};

export const relationshipTypeColors: Record<RelationshipType, string> = {
  reports_to: 'hsl(var(--primary))',
  influences: 'hsl(var(--chart-2))',
  collaborates_with: 'hsl(var(--chart-3))',
  opposes: 'hsl(var(--destructive))',
};

export async function listRelationshipsForProspect(prospectId: string): Promise<StakeholderRelationship[]> {
  const { data, error } = await supabase
    .from('stakeholder_relationships')
    .select('*')
    .eq('prospect_id', prospectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching relationships:', error);
    throw error;
  }

  return (data || []) as StakeholderRelationship[];
}

export async function createRelationship(params: {
  prospectId: string;
  sourceStakeholderId: string;
  targetStakeholderId: string;
  relationshipType: RelationshipType;
  strength?: number;
  notes?: string;
  repId: string;
}): Promise<StakeholderRelationship> {
  const { data, error } = await supabase
    .from('stakeholder_relationships')
    .insert({
      prospect_id: params.prospectId,
      source_stakeholder_id: params.sourceStakeholderId,
      target_stakeholder_id: params.targetStakeholderId,
      relationship_type: params.relationshipType,
      strength: params.strength ?? 5,
      notes: params.notes || null,
      rep_id: params.repId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating relationship:', error);
    throw error;
  }

  return data as StakeholderRelationship;
}

export async function updateRelationship(
  relationshipId: string,
  updates: Partial<Pick<StakeholderRelationship, 'relationship_type' | 'strength' | 'notes'>>
): Promise<StakeholderRelationship> {
  const { data, error } = await supabase
    .from('stakeholder_relationships')
    .update(updates)
    .eq('id', relationshipId)
    .select()
    .single();

  if (error) {
    console.error('Error updating relationship:', error);
    throw error;
  }

  return data as StakeholderRelationship;
}

export async function deleteRelationship(relationshipId: string): Promise<void> {
  const { error } = await supabase
    .from('stakeholder_relationships')
    .delete()
    .eq('id', relationshipId);

  if (error) {
    console.error('Error deleting relationship:', error);
    throw error;
  }
}
