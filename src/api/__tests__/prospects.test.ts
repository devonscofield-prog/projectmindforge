import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock supabaseAdapters
vi.mock('@/lib/supabaseAdapters', () => ({
  toProspect: (data: any) => ({ ...data }),
  toProspectWithRep: (data: any, repName: string) => ({ ...data, rep_name: repName }),
  toProspectActivity: (data: any) => ({ ...data }),
}));

function chainable(resolveValue: { data: unknown; error: unknown; count?: number }) {
  const builder: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolveValue),
    maybeSingle: vi.fn().mockResolvedValue(resolveValue),
    then: <T>(resolve: (v: typeof resolveValue) => T): T => resolve(resolveValue),
    [Symbol.toStringTag]: 'Promise',
  };
  return builder;
}

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: vi.fn() },
  },
}));

import {
  getCallCountsForProspects,
  adminDeleteProspect,
  createProspect,
  getProspectById,
  updateProspect,
} from '../prospects';

describe('prospects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => chainable({ data: [], error: null }));
  });

  describe('getCallCountsForProspects', () => {
    it('should return empty object for empty input', async () => {
      const result = await getCallCountsForProspects([]);
      expect(result).toEqual({});
    });

    it('should count calls per prospect correctly', async () => {
      const callData = [
        { prospect_id: 'p1' },
        { prospect_id: 'p1' },
        { prospect_id: 'p2' },
        { prospect_id: 'p1' },
      ];
      mockFrom.mockReturnValue(chainable({ data: callData, error: null }));

      const result = await getCallCountsForProspects(['p1', 'p2', 'p3']);
      expect(result['p1']).toBe(3);
      expect(result['p2']).toBe(1);
      expect(result['p3']).toBe(0);
    });

    it('should initialize all prospect IDs to zero', async () => {
      mockFrom.mockReturnValue(chainable({ data: [], error: null }));
      const result = await getCallCountsForProspects(['p1', 'p2']);
      expect(result['p1']).toBe(0);
      expect(result['p2']).toBe(0);
    });

    it('should handle null prospect_id in data', async () => {
      const callData = [
        { prospect_id: 'p1' },
        { prospect_id: null },
      ];
      mockFrom.mockReturnValue(chainable({ data: callData, error: null }));

      const result = await getCallCountsForProspects(['p1']);
      expect(result['p1']).toBe(1);
    });

    it('should throw on supabase error', async () => {
      mockFrom.mockReturnValue(
        chainable({ data: null, error: { message: 'Query failed' } })
      );
      await expect(
        getCallCountsForProspects(['p1'])
      ).rejects.toThrow('Failed to get call counts');
    });
  });

  describe('adminDeleteProspect', () => {
    it('should delete a prospect and return success', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));
      const result = await adminDeleteProspect('prospect-1');
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error object on delete failure', async () => {
      mockFrom.mockReturnValue(
        chainable({ data: null, error: { message: 'FK constraint' } })
      );
      const result = await adminDeleteProspect('prospect-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('FK constraint');
    });
  });

  describe('createProspect', () => {
    it('should create prospect with correct default values', async () => {
      const mockProspect = {
        id: 'new-1',
        rep_id: 'rep-1',
        prospect_name: 'Test Corp',
        account_name: null,
        status: 'active',
      };
      mockFrom.mockReturnValue(chainable({ data: mockProspect, error: null }));

      const result = await createProspect({
        repId: 'rep-1',
        prospectName: 'Test Corp',
      });

      expect(result.prospect_name).toBe('Test Corp');
      expect(result.status).toBe('active');
    });

    it('should throw on creation error', async () => {
      mockFrom.mockReturnValue(
        chainable({ data: null, error: { message: 'Duplicate name' } })
      );

      await expect(
        createProspect({ repId: 'rep-1', prospectName: 'Dupe' })
      ).rejects.toThrow('Failed to create prospect');
    });
  });

  describe('getProspectById', () => {
    it('should return prospect when found', async () => {
      const mockProspect = { id: 'p1', prospect_name: 'Acme' };
      mockFrom.mockReturnValue(chainable({ data: mockProspect, error: null }));

      const result = await getProspectById('p1');
      expect(result).toBeDefined();
      expect(result!.id).toBe('p1');
    });

    it('should return null when prospect not found', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));

      const result = await getProspectById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('updateProspect', () => {
    it('should update prospect and cascade account name changes', async () => {
      const mockUpdated = {
        id: 'p1',
        prospect_name: 'Acme',
        account_name: 'New Name',
      };
      mockFrom.mockImplementation(() =>
        chainable({ data: mockUpdated, error: null })
      );

      const result = await updateProspect('p1', { account_name: 'New Name' });
      expect(result.account_name).toBe('New Name');
      expect(mockFrom).toHaveBeenCalledTimes(2);
    });
  });
});
