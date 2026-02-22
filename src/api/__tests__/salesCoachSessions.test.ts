import { describe, it, expect, vi, beforeEach } from 'vitest';

function chainable(resolveValue: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
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
  fetchCoachSession,
  fetchAllCoachSessions,
  fetchCoachSessionById,
  saveCoachSession,
  archiveAndStartNewSession,
  switchToSession,
  deleteCoachSession,
  clearCoachSession,
} from '../salesCoachSessions';

const mockSession = {
  id: 'session-1',
  user_id: 'user-1',
  prospect_id: 'prospect-1',
  messages: [
    { role: 'user', content: 'How should I approach Acme Corp?' },
    { role: 'assistant', content: 'Start with their pain points...' },
  ],
  title: 'How should I approach Acme...',
  is_active: true,
  created_at: '2024-06-01T10:00:00Z',
  updated_at: '2024-06-01T10:30:00Z',
};

const mockArchivedSession = {
  ...mockSession,
  id: 'session-2',
  is_active: false,
  title: 'Previous conversation',
};

describe('salesCoachSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => chainable({ data: mockSession, error: null }));
  });

  describe('fetchCoachSession', () => {
    it('should fetch active session and parse messages', async () => {
      const result = await fetchCoachSession('user-1', 'prospect-1');
      expect(result).toBeDefined();
      expect(result!.id).toBe('session-1');
      expect(result!.messages).toHaveLength(2);
      expect(result!.messages[0].role).toBe('user');
      expect(result!.is_active).toBe(true);
    });

    it('should return null when no active session exists', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));
      const result = await fetchCoachSession('user-1', 'prospect-1');
      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('DB error') }));
      const result = await fetchCoachSession('user-1', 'prospect-1');
      expect(result).toBeNull();
    });
  });

  describe('fetchAllCoachSessions', () => {
    it('should fetch all sessions for a user/prospect', async () => {
      mockFrom.mockReturnValue(
        chainable({ data: [mockSession, mockArchivedSession], error: null })
      );
      const result = await fetchAllCoachSessions('user-1', 'prospect-1');
      expect(result).toHaveLength(2);
      expect(result[0].messages).toBeDefined();
      expect(result[1].is_active).toBe(false);
    });

    it('should return empty array on error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('DB error') }));
      const result = await fetchAllCoachSessions('user-1', 'prospect-1');
      expect(result).toEqual([]);
    });

    it('should handle sessions with null messages', async () => {
      const sessionWithNullMessages = { ...mockSession, messages: null };
      mockFrom.mockReturnValue(
        chainable({ data: [sessionWithNullMessages], error: null })
      );
      const result = await fetchAllCoachSessions('user-1', 'prospect-1');
      expect(result[0].messages).toEqual([]);
    });
  });

  describe('fetchCoachSessionById', () => {
    it('should fetch a specific session by ID', async () => {
      const result = await fetchCoachSessionById('session-1');
      expect(result).toBeDefined();
      expect(result!.id).toBe('session-1');
    });

    it('should return null on error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('Not found') }));
      const result = await fetchCoachSessionById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('saveCoachSession', () => {
    it('should update an existing session when sessionId is provided', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));
      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const result = await saveCoachSession('user-1', 'prospect-1', messages, 'session-1');
      expect(result).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('sales_coach_sessions');
    });

    it('should generate title from first user message', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));
      const longMessage = 'A'.repeat(100);
      const messages = [{ role: 'user' as const, content: longMessage }];
      const result = await saveCoachSession('user-1', 'prospect-1', messages, 'session-1');
      expect(result).toBe(true);
    });

    it('should return false on update error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('Save failed') }));
      const result = await saveCoachSession(
        'user-1', 'prospect-1',
        [{ role: 'user', content: 'test' }],
        'session-1'
      );
      expect(result).toBe(false);
    });

    it('should create new session when no sessionId and no existing session', async () => {
      mockFrom.mockImplementation(() => chainable({ data: null, error: null }));
      const result = await saveCoachSession(
        'user-1', 'prospect-1',
        [{ role: 'user', content: 'test' }]
      );
      expect(result).toBe(true);
    });
  });

  describe('archiveAndStartNewSession', () => {
    it('should archive the active session', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));
      const result = await archiveAndStartNewSession('user-1', 'prospect-1');
      expect(result).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('sales_coach_sessions');
    });

    it('should return false on archive error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('Archive failed') }));
      const result = await archiveAndStartNewSession('user-1', 'prospect-1');
      expect(result).toBe(false);
    });
  });

  describe('switchToSession', () => {
    it('should archive current and activate target session', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));
      const result = await switchToSession('user-1', 'prospect-1', 'session-2');
      expect(result).toBe(true);
    });

    it('should return false if archiving fails', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('Failed') }));
      const result = await switchToSession('user-1', 'prospect-1', 'session-2');
      expect(result).toBe(false);
    });
  });

  describe('deleteCoachSession', () => {
    it('should delete a session by ID', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));
      const result = await deleteCoachSession('session-1');
      expect(result).toBe(true);
    });

    it('should return false on delete error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('Failed') }));
      const result = await deleteCoachSession('session-1');
      expect(result).toBe(false);
    });
  });

  describe('clearCoachSession', () => {
    it('should delete active session for user/prospect', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));
      const result = await clearCoachSession('user-1', 'prospect-1');
      expect(result).toBe(true);
    });
  });
});
