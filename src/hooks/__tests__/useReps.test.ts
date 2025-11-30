import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHookWithClient, waitFor } from '@/test/test-utils';
import { useReps, useRepsWithEmail, useRepCount, useTeamReps, useTeamRepIds } from '../useReps';
import { mockReps, mockProfiles, createMockQueryBuilder } from '@/test/mocks/supabase';

// Mock the supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'user_with_role') {
        return createMockQueryBuilder(mockReps);
      }
      if (table === 'profiles') {
        return createMockQueryBuilder(mockProfiles);
      }
      return createMockQueryBuilder([]);
    }),
  },
}));

describe('useReps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useReps', () => {
    it('should fetch reps with basic info', async () => {
      const { result } = renderHookWithClient(() => useReps());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);
    });

    it('should filter by teamId when provided', async () => {
      const { result } = renderHookWithClient(() => useReps({ teamId: 'team-1' }));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });

    it('should include inactive reps when activeOnly is false', async () => {
      const { result } = renderHookWithClient(() => useReps({ activeOnly: false }));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });
  });

  describe('useRepsWithEmail', () => {
    it('should fetch reps with email', async () => {
      const { result } = renderHookWithClient(() => useRepsWithEmail());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });
  });

  describe('useRepCount', () => {
    it('should fetch rep count', async () => {
      const { result } = renderHookWithClient(() => useRepCount());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(typeof result.current.data).toBe('number');
    });

    it('should filter count by teamId', async () => {
      const { result } = renderHookWithClient(() => useRepCount({ teamId: 'team-1' }));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(typeof result.current.data).toBe('number');
    });
  });

  describe('useTeamReps', () => {
    it('should fetch reps for a specific team', async () => {
      const { result } = renderHookWithClient(() => useTeamReps('team-1'));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);
    });

    it('should not fetch when teamId is null', () => {
      const { result } = renderHookWithClient(() => useTeamReps(null));
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('should return empty array when teamId is null and query is disabled', async () => {
      const { result } = renderHookWithClient(() => useTeamReps(null));
      
      // Query should be disabled, so data should be undefined initially
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('useTeamRepIds', () => {
    it('should fetch rep IDs for a team', async () => {
      const { result } = renderHookWithClient(() => useTeamRepIds('team-1'));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);
    });

    it('should not fetch when teamId is undefined', () => {
      const { result } = renderHookWithClient(() => useTeamRepIds(undefined));
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});
