import { describe, it, expect, vi, beforeEach } from 'vitest';

function chainable(resolveValue: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolveValue),
    maybeSingle: vi.fn().mockResolvedValue(resolveValue),
    then: <T>(resolve: (v: typeof resolveValue) => T): T => resolve(resolveValue),
    [Symbol.toStringTag]: 'Promise',
  };
  return builder;
}

const { mockFrom, mockGetUser } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: mockFrom,
  },
}));

import {
  getDailyReportConfig,
  upsertDailyReportConfig,
  getReportDeliveryHistory,
  DEFAULT_REPORT_SECTIONS,
} from '../dailyReportConfig';

const mockUser = { id: 'user-1', email: 'test@test.com' };

const mockConfig = {
  id: 'config-1',
  user_id: 'user-1',
  enabled: true,
  delivery_time: '08:00',
  timezone: 'America/New_York',
  rep_ids: ['rep-1', 'rep-2'],
  include_weekends: false,
  report_sections: DEFAULT_REPORT_SECTIONS,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockDeliveryHistory = [
  {
    id: 'notif-1',
    sent_at: '2024-06-01T08:00:00Z',
    title: 'Daily Report - June 1',
    summary: 'Summary for June 1',
    task_count: 5,
  },
  {
    id: 'notif-2',
    sent_at: '2024-06-02T08:00:00Z',
    title: 'Daily Report - June 2',
    summary: null,
    task_count: 3,
  },
];

describe('dailyReportConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'daily_report_configs') {
        return chainable({ data: mockConfig, error: null });
      }
      if (table === 'notification_log') {
        return chainable({ data: mockDeliveryHistory, error: null });
      }
      return chainable({ data: null, error: null });
    });
  });

  describe('getDailyReportConfig', () => {
    it('should fetch config for the authenticated user', async () => {
      const result = await getDailyReportConfig();
      expect(result).toBeDefined();
      expect(result?.id).toBe('config-1');
      expect(result?.enabled).toBe(true);
      expect(result?.delivery_time).toBe('08:00');
      expect(result?.rep_ids).toEqual(['rep-1', 'rep-2']);
    });

    it('should throw when user is not authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
      await expect(getDailyReportConfig()).rejects.toThrow('Not authenticated');
    });

    it('should return null when no config exists', async () => {
      mockFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
      const result = await getDailyReportConfig();
      expect(result).toBeNull();
    });

    it('should throw on supabase error', async () => {
      mockFrom.mockReturnValueOnce(
        chainable({ data: null, error: new Error('DB error') })
      );
      await expect(getDailyReportConfig()).rejects.toThrow();
    });
  });

  describe('upsertDailyReportConfig', () => {
    it('should upsert config with user_id and updates', async () => {
      const updates = { enabled: false, delivery_time: '09:00' };
      const result = await upsertDailyReportConfig(updates);
      expect(result).toBeDefined();
      expect(mockFrom).toHaveBeenCalledWith('daily_report_configs');
    });

    it('should throw when user is not authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
      await expect(
        upsertDailyReportConfig({ enabled: true })
      ).rejects.toThrow('Not authenticated');
    });
  });

  describe('getReportDeliveryHistory', () => {
    it('should fetch delivery history for authenticated user', async () => {
      const result = await getReportDeliveryHistory();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('notif-1');
      expect(result[0].title).toBe('Daily Report - June 1');
      expect(result[1].summary).toBeNull();
      expect(result[1].task_count).toBe(3);
    });

    it('should return empty array when no history exists', async () => {
      mockFrom.mockReturnValueOnce(chainable({ data: [], error: null }));
      const result = await getReportDeliveryHistory();
      expect(result).toEqual([]);
    });
  });

  describe('DEFAULT_REPORT_SECTIONS', () => {
    it('should have all sections enabled by default', () => {
      expect(DEFAULT_REPORT_SECTIONS.summary_stats).toBe(true);
      expect(DEFAULT_REPORT_SECTIONS.wow_trends).toBe(true);
      expect(DEFAULT_REPORT_SECTIONS.best_deal).toBe(true);
      expect(DEFAULT_REPORT_SECTIONS.label_breakdown).toBe(true);
      expect(DEFAULT_REPORT_SECTIONS.close_month_breakdown).toBe(true);
      expect(DEFAULT_REPORT_SECTIONS.pipeline_integrity).toBe(true);
      expect(DEFAULT_REPORT_SECTIONS.rep_breakdown).toBe(true);
    });
  });
});
