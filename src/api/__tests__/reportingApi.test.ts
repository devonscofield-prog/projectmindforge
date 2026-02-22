import { describe, it, expect, vi, beforeEach } from 'vitest';

// Build chainable mock that resolves with given data
function chainable(resolveValue: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: <T>(resolve: (v: typeof resolveValue) => T): T => resolve(resolveValue),
    [Symbol.toStringTag]: 'Promise',
  };
  return builder;
}

const mockCallData = [
  {
    rep_id: 'rep-1',
    potential_revenue: 50000,
    estimated_opportunity_size: 30000,
    opportunity_label: 'commit',
    profiles: { name: 'Alice' },
    ai_call_analysis: [{ call_effectiveness_score: 80 }],
  },
  {
    rep_id: 'rep-1',
    potential_revenue: 20000,
    estimated_opportunity_size: 10000,
    opportunity_label: 'best_case',
    profiles: { name: 'Alice' },
    ai_call_analysis: [{ call_effectiveness_score: 60 }],
  },
  {
    rep_id: 'rep-2',
    potential_revenue: 40000,
    estimated_opportunity_size: 25000,
    opportunity_label: 'pipeline',
    profiles: { name: 'Bob' },
    ai_call_analysis: [{ call_effectiveness_score: 90 }],
  },
];

const mockIndividualData = [
  {
    id: 'call-1',
    call_date: '2024-06-01',
    account_name: 'Acme Corp',
    opportunity_label: 'commit',
    estimated_opportunity_size: 30000,
    target_close_date: '2024-07-01',
    ai_call_analysis: [{ call_effectiveness_score: 80, call_summary: 'Good call' }],
  },
];

const mockProspectData = [
  {
    id: 'prospect-1',
    prospect_name: 'Acme',
    account_name: 'Acme Corp',
    heat_score: 85,
    potential_revenue: 50000,
    active_revenue: 30000,
    last_contact_date: '2024-06-01',
    rep_id: 'rep-1',
    profiles: { name: 'Alice' },
  },
];

const mockSessionData = [
  { user_id: 'rep-1', created_at: '2024-06-01T10:00:00Z' },
  { user_id: 'rep-1', created_at: '2024-06-02T10:00:00Z' },
  { user_id: 'rep-2', created_at: '2024-06-01T14:00:00Z' },
];

const mockProfileData = [
  { id: 'rep-1', name: 'Alice' },
  { id: 'rep-2', name: 'Bob' },
];

const { mockFrom } = vi.hoisted(() => {
  return { mockFrom: vi.fn() };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

import { generateReport, exportToCsv } from '../reportingApi';

describe('reportingApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'call_transcripts') {
        return chainable({ data: mockCallData, error: null });
      }
      if (table === 'prospects') {
        return chainable({ data: mockProspectData, error: null });
      }
      if (table === 'sales_coach_sessions') {
        return chainable({ data: mockSessionData, error: null });
      }
      if (table === 'profiles') {
        return chainable({ data: mockProfileData, error: null });
      }
      return chainable({ data: [], error: null });
    });
  });

  describe('generateReport - team_performance', () => {
    it('should aggregate call data by rep and calculate totals', async () => {
      const result = await generateReport({
        reportType: 'team_performance',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        repIds: null,
      });

      expect(result.type).toBe('team_performance');
      expect(result.rows.length).toBe(2);

      if (result.type === 'team_performance') {
        const alice = result.rows.find(r => r.rep_id === 'rep-1')!;
        expect(alice.rep_name).toBe('Alice');
        expect(alice.total_calls).toBe(2);
        expect(alice.total_pipeline).toBe(70000);
        expect(alice.total_opp_size).toBe(40000);
        expect(alice.commit_total).toBe(30000);
        expect(alice.best_case_total).toBe(10000);
        expect(alice.pipeline_total).toBe(0);

        const bob = result.rows.find(r => r.rep_id === 'rep-2')!;
        expect(bob.total_calls).toBe(1);
        expect(bob.pipeline_total).toBe(25000);
      }
    });

    it('should calculate running average effectiveness score', async () => {
      const result = await generateReport({
        reportType: 'team_performance',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        repIds: null,
      });

      if (result.type === 'team_performance') {
        const alice = result.rows.find(r => r.rep_id === 'rep-1')!;
        expect(alice.avg_effectiveness).toBe(70);

        const bob = result.rows.find(r => r.rep_id === 'rep-2')!;
        expect(bob.avg_effectiveness).toBe(90);
      }
    });

    it('should sort results by total_opp_size descending', async () => {
      const result = await generateReport({
        reportType: 'team_performance',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        repIds: null,
      });

      if (result.type === 'team_performance') {
        expect(result.rows[0].total_opp_size).toBeGreaterThanOrEqual(result.rows[1].total_opp_size);
      }
    });
  });

  describe('generateReport - individual_rep', () => {
    it('should return empty array when no repIds provided', async () => {
      const result = await generateReport({
        reportType: 'individual_rep',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        repIds: null,
      });

      expect(result.type).toBe('individual_rep');
      if (result.type === 'individual_rep') {
        expect(result.rows).toEqual([]);
      }
    });

    it('should transform call data and extract first analysis', async () => {
      mockFrom.mockImplementation(() =>
        chainable({ data: mockIndividualData, error: null })
      );

      const result = await generateReport({
        reportType: 'individual_rep',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        repIds: ['rep-1'],
      });

      if (result.type === 'individual_rep') {
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].call_id).toBe('call-1');
        expect(result.rows[0].effectiveness_score).toBe(80);
        expect(result.rows[0].call_summary).toBe('Good call');
        expect(result.rows[0].account_name).toBe('Acme Corp');
      }
    });
  });

  describe('generateReport - pipeline', () => {
    it('should map prospect data with rep names', async () => {
      const result = await generateReport({
        reportType: 'pipeline',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        repIds: null,
      });

      expect(result.type).toBe('pipeline');
      if (result.type === 'pipeline') {
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].prospect_id).toBe('prospect-1');
        expect(result.rows[0].prospect_name).toBe('Acme');
        expect(result.rows[0].rep_name).toBe('Alice');
        expect(result.rows[0].heat_score).toBe(85);
        expect(result.rows[0].potential_revenue).toBe(50000);
      }
    });
  });

  describe('exportToCsv', () => {
    it('should generate CSV with correct headers and values', () => {
      const mockClick = vi.fn();
      const mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue({
        click: mockClick,
        href: '',
        download: '',
      } as unknown as HTMLAnchorElement);
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
      global.URL.revokeObjectURL = vi.fn();

      const headers = ['name', 'value'];
      const rows = [
        { name: 'Alice', value: 100 },
        { name: 'Bob, Jr.', value: 200 },
      ];

      exportToCsv(headers, rows, 'test-report');

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockClick).toHaveBeenCalled();

      mockCreateElement.mockRestore();
    });

    it('should properly escape values with commas and quotes', () => {
      const mockClick = vi.fn();
      const mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue({
        click: mockClick,
        href: '',
        download: '',
      } as unknown as HTMLAnchorElement);
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
      global.URL.revokeObjectURL = vi.fn();

      const headers = ['name'];
      const rows = [{ name: 'Has "quotes"' }, { name: 'Has, commas' }];

      exportToCsv(headers, rows, 'test');

      expect(mockClick).toHaveBeenCalled();
      mockCreateElement.mockRestore();
    });
  });
});
