import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHookWithClient, waitFor } from '@/test/test-utils';
import { useTeams, useTeamsFull, useTeam, useManagerTeams, useTeamMemberCounts } from '../useTeams';
import { mockTeams, mockProfiles, createMockQueryBuilder } from '@/test/mocks/supabase';

// Mock the supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'teams') {
        return createMockQueryBuilder(mockTeams);
      }
      if (table === 'profiles') {
        return createMockQueryBuilder(mockProfiles);
      }
      return createMockQueryBuilder([]);
    }),
  },
}));

describe('useTeams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useTeams', () => {
    it('should fetch teams with basic info', async () => {
      const { result } = renderHookWithClient(() => useTeams());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);
    });

    it('should handle loading state', () => {
      const { result } = renderHookWithClient(() => useTeams());
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('useTeamsFull', () => {
    it('should fetch teams with full details', async () => {
      const { result } = renderHookWithClient(() => useTeamsFull());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });
  });

  describe('useTeam', () => {
    it('should fetch a single team by ID', async () => {
      const { result } = renderHookWithClient(() => useTeam('team-1'));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should not fetch when teamId is null', () => {
      const { result } = renderHookWithClient(() => useTeam(null));
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('should not fetch when teamId is undefined', () => {
      const { result } = renderHookWithClient(() => useTeam(undefined));
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useManagerTeams', () => {
    it('should fetch teams for a manager', async () => {
      const { result } = renderHookWithClient(() => useManagerTeams('manager-1'));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });

    it('should not fetch when managerId is null', () => {
      const { result } = renderHookWithClient(() => useManagerTeams(null));
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useTeamMemberCounts', () => {
    it('should fetch team member counts', async () => {
      const { result } = renderHookWithClient(() => useTeamMemberCounts());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data instanceof Map).toBe(true);
    });
  });
});
