import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- hoisted mocks ---
const { mockFrom, mockGetUser, mockFunctionsInvoke } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
  mockFunctionsInvoke: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: { getUser: mockGetUser },
    functions: { invoke: mockFunctionsInvoke },
  },
}));

vi.mock('@/types/competitors', () => ({}));

import {
  fetchCompetitors,
  fetchCompetitor,
  createCompetitor,
  deleteCompetitor,
  researchCompetitor,
  resetCompetitorStatus,
} from '../competitors';

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
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
});

// ---------- tests ----------
describe('competitors', () => {
  describe('fetchCompetitors', () => {
    it('returns all competitors with typed fields', async () => {
      const rows = [
        { id: 'c-1', name: 'Rival A', intel: { strengths: [] }, branding: null, raw_content: {}, research_status: 'done' },
        { id: 'c-2', name: 'Rival B', intel: null, branding: { color: 'red' }, raw_content: {}, research_status: 'pending' },
      ];
      mockFrom.mockReturnValue(chainable({ data: rows, error: null }));

      const result = await fetchCompetitors();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Rival A');
      expect(mockFrom).toHaveBeenCalledWith('competitors');
    });

    it('returns empty array when data is null', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));

      const result = await fetchCompetitors();
      expect(result).toEqual([]);
    });

    it('throws on error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('DB fail') }));

      await expect(fetchCompetitors()).rejects.toThrow('DB fail');
    });
  });

  describe('fetchCompetitor', () => {
    it('returns a single competitor by id', async () => {
      const row = { id: 'c-1', name: 'Rival A', intel: null, branding: null, raw_content: {}, research_status: 'done' };
      const builder = chainable({ data: row, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await fetchCompetitor('c-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('c-1');
    });

    it('returns null on PGRST116 (not found) error', async () => {
      const notFoundError = Object.assign(new Error('Not found'), { code: 'PGRST116' });
      const builder = chainable({ data: null, error: null });
      // Override single to return the not-found error
      builder.single = vi.fn().mockResolvedValue({ data: null, error: notFoundError });
      mockFrom.mockReturnValue(builder);

      const result = await fetchCompetitor('c-nonexistent');
      expect(result).toBeNull();
    });

    it('throws on non-PGRST116 error', async () => {
      const dbError = Object.assign(new Error('DB error'), { code: 'PGRST500' });
      const builder = chainable({ data: null, error: null });
      builder.single = vi.fn().mockResolvedValue({ data: null, error: dbError });
      mockFrom.mockReturnValue(builder);

      await expect(fetchCompetitor('c-1')).rejects.toThrow('DB error');
    });
  });

  describe('createCompetitor', () => {
    it('creates competitor with current user as creator', async () => {
      const created = { id: 'c-new', name: 'NewCo', website: 'https://new.co', research_status: 'pending', created_by: 'user-1' };
      const builder = chainable({ data: created, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await createCompetitor('NewCo', 'https://new.co');

      expect(result.id).toBe('c-new');
      expect(result.research_status).toBe('pending');
      expect(result.intel).toBeNull();
      expect(result.branding).toBeNull();
      expect(mockGetUser).toHaveBeenCalled();
      expect((builder.insert as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'NewCo',
          website: 'https://new.co',
          research_status: 'pending',
          created_by: 'user-1',
        })
      );
    });

    it('throws on insert error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('Duplicate') }));

      await expect(createCompetitor('Dup', 'https://dup.co')).rejects.toThrow('Duplicate');
    });
  });

  describe('deleteCompetitor', () => {
    it('deletes successfully', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));

      await expect(deleteCompetitor('c-1')).resolves.toBeUndefined();
      expect(mockFrom).toHaveBeenCalledWith('competitors');
    });

    it('throws on delete error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('FK violation') }));

      await expect(deleteCompetitor('c-1')).rejects.toThrow('FK violation');
    });
  });

  describe('researchCompetitor', () => {
    it('returns success with processing status', async () => {
      mockFunctionsInvoke.mockResolvedValue({
        data: { success: true, status: 'processing' },
        error: null,
      });

      const result = await researchCompetitor('c-1', 'https://rival.com', 'Rival');

      expect(result).toEqual({ success: true, status: 'processing' });
      expect(mockFunctionsInvoke).toHaveBeenCalledWith('competitor-research', {
        body: { competitor_id: 'c-1', website: 'https://rival.com', name: 'Rival' },
      });
    });

    it('sets error status and returns failure on function invocation error', async () => {
      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: new Error('Edge function timeout'),
      });
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));

      const result = await researchCompetitor('c-1', 'https://rival.com', 'Rival');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Edge function timeout');
      // Should have updated status to 'error'
      expect(mockFrom).toHaveBeenCalledWith('competitors');
    });

    it('handles null response data', async () => {
      mockFunctionsInvoke.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));

      const result = await researchCompetitor('c-1', 'https://rival.com', 'Rival');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No response from research function');
    });

    it('handles unsuccessful response data', async () => {
      mockFunctionsInvoke.mockResolvedValue({
        data: { success: false, error: 'Rate limited' },
        error: null,
      });
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));

      const result = await researchCompetitor('c-1', 'https://rival.com', 'Rival');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limited');
    });

    it('returns generic error message when data.error is missing', async () => {
      mockFunctionsInvoke.mockResolvedValue({
        data: { success: false },
        error: null,
      });
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));

      const result = await researchCompetitor('c-1', 'https://rival.com', 'Rival');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Research failed');
    });
  });

  describe('resetCompetitorStatus', () => {
    it('updates status to pending', async () => {
      const builder = chainable({ data: null, error: null });
      mockFrom.mockReturnValue(builder);

      await resetCompetitorStatus('c-1');

      expect((builder.update as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({ research_status: 'pending' });
      expect((builder.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('id', 'c-1');
    });

    it('throws on error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('Update failed') }));

      await expect(resetCompetitorStatus('c-1')).rejects.toThrow('Update failed');
    });
  });
});
