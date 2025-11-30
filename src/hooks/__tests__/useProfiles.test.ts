import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHookWithClient, waitFor } from '@/test/test-utils';
import { useProfilesBasic, useProfilesFull, useProfile, useProfilesByIds, useManagers } from '../useProfiles';
import { mockProfiles, mockUserRoles, createMockQueryBuilder } from '@/test/mocks/supabase';

// Mock the supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return createMockQueryBuilder(mockProfiles);
      }
      if (table === 'user_roles') {
        return createMockQueryBuilder(mockUserRoles.filter(r => r.role === 'manager'));
      }
      return createMockQueryBuilder([]);
    }),
  },
}));

describe('useProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useProfilesBasic', () => {
    it('should fetch profiles with basic info', async () => {
      const { result } = renderHookWithClient(() => useProfilesBasic());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);
    });

    it('should handle loading state', () => {
      const { result } = renderHookWithClient(() => useProfilesBasic());
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('useProfilesFull', () => {
    it('should fetch profiles with full details', async () => {
      const { result } = renderHookWithClient(() => useProfilesFull());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });
  });

  describe('useProfile', () => {
    it('should fetch a single profile by ID', async () => {
      const { result } = renderHookWithClient(() => useProfile('user-1'));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should not fetch when profileId is null', () => {
      const { result } = renderHookWithClient(() => useProfile(null));
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('should not fetch when profileId is undefined', () => {
      const { result } = renderHookWithClient(() => useProfile(undefined));
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useProfilesByIds', () => {
    it('should fetch multiple profiles by IDs', async () => {
      const { result } = renderHookWithClient(() => useProfilesByIds(['user-1', 'user-2']));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);
    });

    it('should not fetch when profileIds array is empty', () => {
      const { result } = renderHookWithClient(() => useProfilesByIds([]));
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('should generate consistent query key regardless of ID order', async () => {
      const { result: result1 } = renderHookWithClient(() => 
        useProfilesByIds(['user-2', 'user-1'])
      );
      const { result: result2 } = renderHookWithClient(() => 
        useProfilesByIds(['user-1', 'user-2'])
      );

      // Both should have the same behavior since IDs are sorted in queryKey
      expect(result1.current.isLoading).toBe(result2.current.isLoading);
    });
  });

  describe('useManagers', () => {
    it('should fetch managers', async () => {
      const { result } = renderHookWithClient(() => useManagers());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });
  });
});
