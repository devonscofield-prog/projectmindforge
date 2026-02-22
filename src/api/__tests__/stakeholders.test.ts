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
  toStakeholder: (data: any) => ({ ...data }),
  toStakeholderMention: (data: any) => ({ ...data }),
}));

function chainable(resolveValue: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
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
  supabase: { from: mockFrom },
}));

import {
  normalizeStakeholderName,
  validateStakeholderName,
  validateStakeholderEmail,
  validateStakeholderPhone,
  influenceLevelOrder,
  influenceLevelLabels,
  STAKEHOLDER_NAME_MIN_LENGTH,
  STAKEHOLDER_NAME_MAX_LENGTH,
  getStakeholderCountsForProspects,
  getPrimaryStakeholdersForProspects,
  createStakeholder,
  deleteStakeholder,
} from '../stakeholders';

describe('stakeholders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => chainable({ data: [], error: null }));
  });

  describe('normalizeStakeholderName', () => {
    it('should trim whitespace', () => {
      expect(normalizeStakeholderName('  John Doe  ')).toBe('John Doe');
    });

    it('should collapse internal whitespace', () => {
      expect(normalizeStakeholderName('John   Doe')).toBe('John Doe');
    });

    it('should handle tabs and mixed whitespace', () => {
      expect(normalizeStakeholderName('John\t\tDoe')).toBe('John Doe');
    });

    it('should handle single word names', () => {
      expect(normalizeStakeholderName('  Alice  ')).toBe('Alice');
    });
  });

  describe('validateStakeholderName', () => {
    it('should reject names shorter than minimum length', () => {
      const result = validateStakeholderName('A');
      expect(result.valid).toBe(false);
      expect(result.error).toContain(String(STAKEHOLDER_NAME_MIN_LENGTH));
    });

    it('should accept valid names', () => {
      const result = validateStakeholderName('John Doe');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject names longer than maximum length', () => {
      const longName = 'A'.repeat(STAKEHOLDER_NAME_MAX_LENGTH + 1);
      const result = validateStakeholderName(longName);
      expect(result.valid).toBe(false);
      expect(result.error).toContain(String(STAKEHOLDER_NAME_MAX_LENGTH));
    });

    it('should validate after normalization', () => {
      const result = validateStakeholderName('   ');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateStakeholderEmail', () => {
    it('should accept valid emails', () => {
      expect(validateStakeholderEmail('test@example.com').valid).toBe(true);
      expect(validateStakeholderEmail('user.name@domain.co.uk').valid).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(validateStakeholderEmail('not-an-email').valid).toBe(false);
      expect(validateStakeholderEmail('@nodomain.com').valid).toBe(false);
    });

    it('should accept empty string (optional field)', () => {
      expect(validateStakeholderEmail('').valid).toBe(true);
    });
  });

  describe('validateStakeholderPhone', () => {
    it('should accept valid phone numbers', () => {
      expect(validateStakeholderPhone('555-1234').valid).toBe(true);
      expect(validateStakeholderPhone('+1 (555) 123-4567').valid).toBe(true);
      expect(validateStakeholderPhone('555.123.4567').valid).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validateStakeholderPhone('123').valid).toBe(false);
      expect(validateStakeholderPhone('abc-defg').valid).toBe(false);
    });

    it('should accept empty string (optional field)', () => {
      expect(validateStakeholderPhone('').valid).toBe(true);
    });
  });

  describe('influenceLevelOrder', () => {
    it('should order final_dm as highest influence', () => {
      expect(influenceLevelOrder.final_dm).toBe(1);
    });

    it('should have correct ordering hierarchy', () => {
      expect(influenceLevelOrder.final_dm).toBeLessThan(influenceLevelOrder.secondary_dm);
      expect(influenceLevelOrder.secondary_dm).toBeLessThan(influenceLevelOrder.heavy_influencer);
      expect(influenceLevelOrder.heavy_influencer).toBeLessThan(influenceLevelOrder.light_influencer);
      expect(influenceLevelOrder.light_influencer).toBeLessThan(influenceLevelOrder.self_pay);
    });
  });

  describe('influenceLevelLabels', () => {
    it('should have labels for all influence levels', () => {
      expect(influenceLevelLabels.final_dm).toBe('DM (Decision Maker)');
      expect(influenceLevelLabels.secondary_dm).toBe('Secondary DM');
      expect(influenceLevelLabels.heavy_influencer).toBe('Heavy Influencer');
      expect(influenceLevelLabels.light_influencer).toBe('Light Influencer');
      expect(influenceLevelLabels.self_pay).toBe('Self Pay');
    });
  });

  describe('getStakeholderCountsForProspects', () => {
    it('should return empty object for empty input', async () => {
      const result = await getStakeholderCountsForProspects([]);
      expect(result).toEqual({});
    });

    it('should count stakeholders per prospect', async () => {
      mockFrom.mockReturnValue(chainable({
        data: [
          { prospect_id: 'p1' },
          { prospect_id: 'p1' },
          { prospect_id: 'p2' },
        ],
        error: null,
      }));

      const result = await getStakeholderCountsForProspects(['p1', 'p2', 'p3']);
      expect(result['p1']).toBe(2);
      expect(result['p2']).toBe(1);
      expect(result['p3']).toBe(0);
    });

    it('should throw on supabase error', async () => {
      mockFrom.mockReturnValue(chainable({
        data: null,
        error: { message: 'Query failed' },
      }));
      await expect(
        getStakeholderCountsForProspects(['p1'])
      ).rejects.toThrow('Failed to get stakeholder counts');
    });
  });

  describe('getPrimaryStakeholdersForProspects', () => {
    it('should return empty object for empty input', async () => {
      const result = await getPrimaryStakeholdersForProspects([]);
      expect(result).toEqual({});
    });

    it('should map prospect IDs to primary stakeholder data', async () => {
      mockFrom.mockReturnValue(chainable({
        data: [
          { prospect_id: 'p1', name: 'John Doe', job_title: 'CEO' },
          { prospect_id: 'p2', name: 'Jane Smith', job_title: null },
        ],
        error: null,
      }));

      const result = await getPrimaryStakeholdersForProspects(['p1', 'p2']);
      expect(result['p1']).toEqual({ name: 'John Doe', job_title: 'CEO' });
      expect(result['p2']).toEqual({ name: 'Jane Smith', job_title: null });
    });
  });

  describe('createStakeholder', () => {
    it('should create stakeholder with normalized name', async () => {
      const mockStakeholder = {
        id: 'sh-1',
        prospect_id: 'p1',
        rep_id: 'rep-1',
        name: 'John Doe',
        influence_level: 'light_influencer',
        is_primary_contact: false,
      };
      mockFrom.mockReturnValue(chainable({ data: mockStakeholder, error: null }));

      const result = await createStakeholder({
        prospectId: 'p1',
        repId: 'rep-1',
        name: '  John   Doe  ',
      });

      expect(result.name).toBe('John Doe');
    });
  });

  describe('deleteStakeholder', () => {
    it('should delete successfully', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));
      await deleteStakeholder('sh-1');
    });

    it('should throw on error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: { message: 'Not found' } }));
      await expect(deleteStakeholder('nonexistent')).rejects.toThrow('Failed to delete stakeholder');
    });
  });
});
