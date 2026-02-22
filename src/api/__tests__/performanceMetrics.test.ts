import { describe, it, expect, vi, beforeEach } from 'vitest';

function chainable(resolveValue: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: <T>(resolve: (v: typeof resolveValue) => T): T => resolve(resolveValue),
    [Symbol.toStringTag]: 'Promise',
  };
  return builder;
}

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

import {
  getPerformanceMetrics,
  getMetricsTimeline,
  getEdgeFunctionBreakdown,
  getSystemHealth,
} from '../performanceMetrics';

const mockMetrics = [
  {
    id: 'm1',
    metric_type: 'query',
    metric_name: 'fetch_prospects',
    duration_ms: 150,
    status: 'success',
    user_id: 'user-1',
    metadata: {},
    created_at: '2024-06-01T10:00:00Z',
  },
  {
    id: 'm2',
    metric_type: 'query',
    metric_name: 'fetch_calls',
    duration_ms: 300,
    status: 'success',
    user_id: 'user-1',
    metadata: {},
    created_at: '2024-06-01T10:30:00Z',
  },
  {
    id: 'm3',
    metric_type: 'edge_function',
    metric_name: 'analyze-call',
    duration_ms: 5000,
    status: 'error',
    user_id: null,
    metadata: {},
    created_at: '2024-06-01T11:00:00Z',
  },
];

const mockSummary = [
  {
    metric_type: 'query',
    metric_name: 'fetch_prospects',
    avg_duration_ms: 200,
    p50_duration_ms: 150,
    p90_duration_ms: 400,
    p99_duration_ms: 800,
    total_count: 100,
    error_count: 2,
    error_rate: 2,
  },
  {
    metric_type: 'edge_function',
    metric_name: 'analyze-call',
    avg_duration_ms: 30000,
    p50_duration_ms: 25000,
    p90_duration_ms: 50000,
    p99_duration_ms: 58000,
    total_count: 50,
    error_count: 3,
    error_rate: 6,
  },
];

describe('performanceMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => chainable({ data: mockMetrics, error: null }));
    mockRpc.mockResolvedValue({ data: mockSummary, error: null });
  });

  describe('getPerformanceMetrics', () => {
    it('should fetch raw metrics for default time range', async () => {
      const result = await getPerformanceMetrics();
      expect(result).toHaveLength(3);
      expect(result[0].metric_type).toBe('query');
      expect(mockFrom).toHaveBeenCalledWith('performance_metrics');
    });

    it('should filter by metric type when provided', async () => {
      await getPerformanceMetrics(24, 'query');
      expect(mockFrom).toHaveBeenCalledWith('performance_metrics');
    });

    it('should return empty array on empty data', async () => {
      mockFrom.mockReturnValue(chainable({ data: [], error: null }));
      const result = await getPerformanceMetrics();
      expect(result).toEqual([]);
    });

    it('should throw on error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('DB error') }));
      await expect(getPerformanceMetrics()).rejects.toThrow();
    });
  });

  describe('getMetricsTimeline', () => {
    it('should group metrics by hour and calculate averages', async () => {
      const timelineMetrics = [
        { created_at: '2024-06-01T10:15:00Z', duration_ms: 100, status: 'success', metric_type: 'query' },
        { created_at: '2024-06-01T10:30:00Z', duration_ms: 200, status: 'success', metric_type: 'query' },
        { created_at: '2024-06-01T10:45:00Z', duration_ms: 300, status: 'error', metric_type: 'query' },
        { created_at: '2024-06-01T11:15:00Z', duration_ms: 150, status: 'success', metric_type: 'query' },
      ];
      mockFrom.mockReturnValue(chainable({ data: timelineMetrics, error: null }));

      const result = await getMetricsTimeline();
      expect(result.length).toBe(2);

      const hour10 = result.find(r => r.hour === '2024-06-01T10:00');
      expect(hour10).toBeDefined();
      expect(hour10!.avg_duration).toBe(200);
      expect(hour10!.count).toBe(3);
      expect(hour10!.error_rate).toBeCloseTo(33.3, 0);

      const hour11 = result.find(r => r.hour === '2024-06-01T11:00');
      expect(hour11).toBeDefined();
      expect(hour11!.avg_duration).toBe(150);
      expect(hour11!.count).toBe(1);
      expect(hour11!.error_rate).toBe(0);
    });

    it('should return empty array when no data', async () => {
      mockFrom.mockReturnValue(chainable({ data: [], error: null }));
      const result = await getMetricsTimeline();
      expect(result).toEqual([]);
    });

    it('should return empty array for null data', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));
      const result = await getMetricsTimeline();
      expect(result).toEqual([]);
    });
  });

  describe('getEdgeFunctionBreakdown', () => {
    it('should filter summary to only edge_function metrics', async () => {
      const result = await getEdgeFunctionBreakdown();
      expect(result.length).toBe(1);
      expect(result[0].metric_type).toBe('edge_function');
      expect(result[0].metric_name).toBe('analyze-call');
    });

    it('should return empty when no edge function metrics', async () => {
      mockRpc.mockResolvedValue({
        data: [mockSummary[0]],
        error: null,
      });
      const result = await getEdgeFunctionBreakdown();
      expect(result).toEqual([]);
    });
  });

  describe('getSystemHealth', () => {
    it('should return healthy status for good metrics', async () => {
      mockRpc.mockResolvedValue({
        data: [
          { metric_type: 'query', avg_duration_ms: 100, total_count: 100, error_count: 0, error_rate: 0 },
          { metric_type: 'edge_function', avg_duration_ms: 30000, total_count: 50, error_count: 0, error_rate: 0 },
        ],
        error: null,
      });

      const result = await getSystemHealth();
      expect(result.queryHealth.level).toBe('healthy');
      expect(result.edgeFunctionHealth.level).toBe('healthy');
      expect(result.errorRateHealth.level).toBe('healthy');
      expect(result.overallHealth).toBe('healthy');
      expect(result.recommendation).toBeUndefined();
    });

    it('should return warning when query time is high', async () => {
      mockRpc.mockResolvedValue({
        data: [
          { metric_type: 'query', avg_duration_ms: 1000, total_count: 100, error_count: 0, error_rate: 0 },
        ],
        error: null,
      });

      const result = await getSystemHealth();
      expect(result.queryHealth.level).toBe('warning');
    });

    it('should return critical when error rate is very high', async () => {
      mockRpc.mockResolvedValue({
        data: [
          { metric_type: 'query', avg_duration_ms: 2000, total_count: 100, error_count: 15, error_rate: 15 },
          { metric_type: 'edge_function', avg_duration_ms: 30000, total_count: 50, error_count: 15, error_rate: 30 },
        ],
        error: null,
      });

      const result = await getSystemHealth();
      expect(result.overallHealth).toBe('critical');
      expect(result.recommendation).toBeDefined();
    });

    it('should handle empty summary data', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const result = await getSystemHealth();
      expect(result.queryHealth.value).toBe(0);
      expect(result.overallHealth).toBe('healthy');
    });
  });
});
