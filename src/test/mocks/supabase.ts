import { vi } from 'vitest';

// Mock data for tests
export const mockTeams = [
  { id: 'team-1', name: 'Alpha Team', manager_id: 'manager-1', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 'team-2', name: 'Beta Team', manager_id: 'manager-2', created_at: '2024-01-02', updated_at: '2024-01-02' },
];

export const mockProfiles = [
  { id: 'user-1', name: 'John Doe', email: 'john@test.com', team_id: 'team-1', is_active: true, hire_date: null, notes: null, created_at: '2024-01-01', updated_at: '2024-01-01', last_seen_at: null },
  { id: 'user-2', name: 'Jane Smith', email: 'jane@test.com', team_id: 'team-1', is_active: true, hire_date: null, notes: null, created_at: '2024-01-02', updated_at: '2024-01-02', last_seen_at: null },
  { id: 'user-3', name: 'Bob Wilson', email: 'bob@test.com', team_id: 'team-2', is_active: false, hire_date: null, notes: null, created_at: '2024-01-03', updated_at: '2024-01-03', last_seen_at: null },
];

export const mockReps = [
  { id: 'user-1', name: 'John Doe', email: 'john@test.com', team_id: 'team-1', role: 'rep', is_active: true },
  { id: 'user-2', name: 'Jane Smith', email: 'jane@test.com', team_id: 'team-1', role: 'rep', is_active: true },
];

export const mockUserRoles = [
  { user_id: 'user-1', role: 'rep' },
  { user_id: 'user-2', role: 'rep' },
  { user_id: 'manager-1', role: 'manager' },
  { user_id: 'admin-1', role: 'admin' },
];

export const mockProspects = [
  { id: 'prospect-1', prospect_name: 'Acme Corp', status: 'active', heat_score: 9, potential_revenue: 50000 },
  { id: 'prospect-2', prospect_name: 'Tech Inc', status: 'active', heat_score: 7, potential_revenue: 30000 },
  { id: 'prospect-3', prospect_name: 'Old Co', status: 'dormant', heat_score: 3, potential_revenue: 10000 },
];

// Create chainable mock query builder
export function createMockQueryBuilder(data: any[] | null = [], error: any = null) {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: data?.[0] ?? null, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data: data?.[0] ?? null, error }),
    then: (resolve: any) => resolve({ data, error, count: data?.length ?? 0 }),
  };
  
  // Make the builder thenable for async/await
  builder[Symbol.toStringTag] = 'Promise';
  
  return builder;
}

// Create mock supabase client
export function createMockSupabaseClient() {
  return {
    from: vi.fn((table: string) => {
      switch (table) {
        case 'teams':
          return createMockQueryBuilder(mockTeams);
        case 'profiles':
          return createMockQueryBuilder(mockProfiles);
        case 'user_with_role':
          return createMockQueryBuilder(mockReps);
        case 'user_roles':
          return createMockQueryBuilder(mockUserRoles);
        case 'prospects':
          return createMockQueryBuilder(mockProspects);
        case 'call_transcripts':
          return createMockQueryBuilder([]);
        default:
          return createMockQueryBuilder([]);
      }
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  };
}
