import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- hoisted mocks ---
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  listRelationshipsForProspect,
  createRelationship,
  updateRelationship,
  deleteRelationship,
  relationshipTypeLabels,
  relationshipTypeColors,
  type RelationshipType,
} from '../stakeholderRelationships';

// ---------- helpers ----------
function chainable(resolveValue: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolveValue),
    then: <T>(resolve: (v: typeof resolveValue) => T): T => resolve(resolveValue),
    [Symbol.toStringTag]: 'Promise',
  };
  return builder;
}

// ---------- setup ----------
beforeEach(() => {
  vi.clearAllMocks();
});

// ---------- tests ----------
describe('stakeholderRelationships', () => {
  describe('constants', () => {
    it('relationshipTypeLabels covers all relationship types', () => {
      const types: RelationshipType[] = ['reports_to', 'influences', 'collaborates_with', 'opposes'];
      types.forEach((t) => {
        expect(relationshipTypeLabels[t]).toBeDefined();
        expect(typeof relationshipTypeLabels[t]).toBe('string');
      });
      expect(relationshipTypeLabels.reports_to).toBe('Reports To');
      expect(relationshipTypeLabels.opposes).toBe('Opposes');
    });

    it('relationshipTypeColors covers all relationship types', () => {
      const types: RelationshipType[] = ['reports_to', 'influences', 'collaborates_with', 'opposes'];
      types.forEach((t) => {
        expect(relationshipTypeColors[t]).toBeDefined();
        expect(typeof relationshipTypeColors[t]).toBe('string');
      });
    });
  });

  describe('listRelationshipsForProspect', () => {
    it('returns relationships ordered by created_at desc', async () => {
      const mockRels = [
        { id: 'rel-1', prospect_id: 'p-1', source_stakeholder_id: 's-1', target_stakeholder_id: 's-2', relationship_type: 'reports_to', strength: 5 },
        { id: 'rel-2', prospect_id: 'p-1', source_stakeholder_id: 's-2', target_stakeholder_id: 's-3', relationship_type: 'influences', strength: 8 },
      ];
      mockFrom.mockReturnValue(chainable({ data: mockRels, error: null }));

      const result = await listRelationshipsForProspect('p-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('rel-1');
      expect(mockFrom).toHaveBeenCalledWith('stakeholder_relationships');
    });

    it('returns empty array when data is null', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));

      const result = await listRelationshipsForProspect('p-1');
      expect(result).toEqual([]);
    });

    it('throws on supabase error', async () => {
      const dbError = new Error('DB error');
      mockFrom.mockReturnValue(chainable({ data: null, error: dbError }));

      await expect(listRelationshipsForProspect('p-1')).rejects.toThrow('DB error');
    });
  });

  describe('createRelationship', () => {
    it('inserts with default strength of 5 when not provided', async () => {
      const created = {
        id: 'rel-new',
        prospect_id: 'p-1',
        source_stakeholder_id: 's-1',
        target_stakeholder_id: 's-2',
        relationship_type: 'collaborates_with',
        strength: 5,
        notes: null,
        rep_id: 'rep-1',
      };
      const builder = chainable({ data: created, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await createRelationship({
        prospectId: 'p-1',
        sourceStakeholderId: 's-1',
        targetStakeholderId: 's-2',
        relationshipType: 'collaborates_with',
        repId: 'rep-1',
      });

      expect(result.id).toBe('rel-new');
      expect(result.strength).toBe(5);
      expect((builder.insert as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        expect.objectContaining({ strength: 5, notes: null })
      );
    });

    it('uses provided strength and notes', async () => {
      const created = {
        id: 'rel-new',
        strength: 9,
        notes: 'Strong influence',
      };
      const builder = chainable({ data: created, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await createRelationship({
        prospectId: 'p-1',
        sourceStakeholderId: 's-1',
        targetStakeholderId: 's-2',
        relationshipType: 'influences',
        strength: 9,
        notes: 'Strong influence',
        repId: 'rep-1',
      });

      expect(result.strength).toBe(9);
      expect(result.notes).toBe('Strong influence');
      expect((builder.insert as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        expect.objectContaining({ strength: 9, notes: 'Strong influence' })
      );
    });

    it('throws on insert error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('Conflict') }));

      await expect(
        createRelationship({
          prospectId: 'p-1',
          sourceStakeholderId: 's-1',
          targetStakeholderId: 's-2',
          relationshipType: 'opposes',
          repId: 'rep-1',
        })
      ).rejects.toThrow('Conflict');
    });
  });

  describe('updateRelationship', () => {
    it('updates and returns the relationship', async () => {
      const updated = { id: 'rel-1', strength: 10, relationship_type: 'opposes' };
      const builder = chainable({ data: updated, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await updateRelationship('rel-1', { strength: 10, relationship_type: 'opposes' });

      expect(result.strength).toBe(10);
      expect((builder.update as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({ strength: 10, relationship_type: 'opposes' });
      expect((builder.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('id', 'rel-1');
    });

    it('throws on update error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('Not found') }));

      await expect(updateRelationship('rel-x', { notes: 'test' })).rejects.toThrow('Not found');
    });
  });

  describe('deleteRelationship', () => {
    it('deletes successfully', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));

      await expect(deleteRelationship('rel-1')).resolves.toBeUndefined();
      expect(mockFrom).toHaveBeenCalledWith('stakeholder_relationships');
    });

    it('throws on delete error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('FK constraint') }));

      await expect(deleteRelationship('rel-1')).rejects.toThrow('FK constraint');
    });
  });
});
