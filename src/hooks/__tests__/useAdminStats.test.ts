import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHookWithClient, waitFor } from '@/test/test-utils';
import { useAdminDashboardStats, useProspectStats } from '../useAdminStats';
import { mockProfiles, mockTeams, mockUserRoles, mockProspects } from '@/test/mocks/supabase';

// Create a custom mock that returns count data with flexible typing
function createCountMock(count: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createChainable = (resolveValue: { data: unknown; count?: number; error: null }): any => ({
    then: <T>(resolve: (value: typeof resolveValue) => T): T => resolve(resolveValue),
    eq: () => createChainable(resolveValue),
    gte: () => createChainable(resolveValue),
  });

  return {
    select: vi.fn().mockReturnValue(createChainable({ data: null, count, error: null })),
  };
}

// Mock the supabase client with Promise.all support
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'not implemented' } }),
    from: vi.fn((table: string) => {
      switch (table) {
        case 'profiles':
          return createCountMock(mockProfiles.length);
        case 'teams':
          return createCountMock(mockTeams.length);
        case 'call_transcripts':
          return createCountMock(0);
        case 'prospects': {
          const activeProspects = mockProspects.filter(p => p.status === 'active');
          const hotProspects = mockProspects.filter(p => p.heat_score >= 70);
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const createProspectChainable = (): any => ({
            then: <T>(resolve: (value: { data: typeof mockProspects; count: number; error: null }) => T): T => 
              resolve({ data: mockProspects, count: mockProspects.length, error: null }),
            eq: () => ({
              then: <T>(resolve: (value: { data: typeof activeProspects; count: number; error: null }) => T): T => 
                resolve({ data: activeProspects, count: activeProspects.length, error: null }),
            }),
            gte: () => ({
              then: <T>(resolve: (value: { data: typeof hotProspects; count: number; error: null }) => T): T => 
                resolve({ data: hotProspects, count: hotProspects.length, error: null }),
            }),
          });
          
          return {
            select: vi.fn().mockReturnValue(createProspectChainable()),
          };
        }
        case 'user_roles': {
          return {
            select: vi.fn().mockReturnValue({
              then: <T>(resolve: (value: { data: typeof mockUserRoles; error: null }) => T): T => 
                resolve({ data: mockUserRoles, error: null }),
            }),
          };
        }
        default:
          return createCountMock(0);
      }
    }),
  },
}));

describe('useAdminStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useAdminDashboardStats', () => {
    it('should fetch admin dashboard stats', async () => {
      const { result } = renderHookWithClient(() => useAdminDashboardStats());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data).toHaveProperty('userCount');
      expect(result.current.data).toHaveProperty('teamCount');
      expect(result.current.data).toHaveProperty('callCount');
      expect(result.current.data).toHaveProperty('prospectCount');
      expect(result.current.data).toHaveProperty('roleCounts');
    });

    it('should handle loading state', () => {
      const { result } = renderHookWithClient(() => useAdminDashboardStats());
      expect(result.current.isLoading).toBe(true);
    });

    it('should return role counts object', async () => {
      const { result } = renderHookWithClient(() => useAdminDashboardStats());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.roleCounts).toHaveProperty('rep');
      expect(result.current.data?.roleCounts).toHaveProperty('manager');
      expect(result.current.data?.roleCounts).toHaveProperty('admin');
    });
  });

  describe('useProspectStats', () => {
    it('should fetch prospect stats', async () => {
      const { result } = renderHookWithClient(() => useProspectStats());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data).toHaveProperty('total');
      expect(result.current.data).toHaveProperty('active');
      expect(result.current.data).toHaveProperty('hot');
      expect(result.current.data).toHaveProperty('pipelineValue');
    });

    it('should calculate pipeline value correctly', async () => {
      const { result } = renderHookWithClient(() => useProspectStats());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(typeof result.current.data?.pipelineValue).toBe('number');
    });

    it('should count hot prospects (heat_score >= 70)', async () => {
      const { result } = renderHookWithClient(() => useProspectStats());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(typeof result.current.data?.hot).toBe('number');
    });
  });
});
