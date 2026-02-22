import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock accountFollowUps dependency
vi.mock('@/api/accountFollowUps', () => ({
  createManualFollowUps: vi.fn().mockResolvedValue([]),
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  addDays: vi.fn((date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }),
  format: vi.fn((date: Date, _fmt: string) => date.toISOString().split('T')[0]),
}));

function chainable(resolveValue: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
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
  fetchTaskTemplates,
  createTaskTemplate,
  updateTaskTemplate,
  deleteTaskTemplate,
  getAutoCreateSetting,
  setAutoCreateSetting,
  reorderTaskTemplates,
} from '../taskTemplates';

const mockTemplates = [
  {
    id: 'tmpl-1',
    rep_id: 'rep-1',
    title: 'Send follow-up email',
    description: 'Send a follow-up within 24 hours',
    priority: 'high',
    category: 'follow_up_email',
    due_days_offset: 1,
    reminder_enabled: true,
    reminder_time: '09:00',
    sort_order: 0,
    is_active: true,
    sequence_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'tmpl-2',
    rep_id: 'rep-1',
    title: 'Schedule demo',
    description: null,
    priority: 'medium',
    category: 'phone_call',
    due_days_offset: 3,
    reminder_enabled: false,
    reminder_time: null,
    sort_order: 1,
    is_active: true,
    sequence_id: null,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
];

describe('taskTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => chainable({ data: mockTemplates, error: null }));
  });

  describe('fetchTaskTemplates', () => {
    it('should fetch templates for a rep ordered by sort_order', async () => {
      const result = await fetchTaskTemplates('rep-1');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('tmpl-1');
      expect(result[0].title).toBe('Send follow-up email');
      expect(result[1].id).toBe('tmpl-2');
      expect(mockFrom).toHaveBeenCalledWith('rep_task_templates');
    });

    it('should return empty array when no templates exist', async () => {
      mockFrom.mockReturnValue(chainable({ data: [], error: null }));
      const result = await fetchTaskTemplates('rep-no-templates');
      expect(result).toEqual([]);
    });

    it('should throw on supabase error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('DB error') }));
      await expect(fetchTaskTemplates('rep-1')).rejects.toThrow();
    });
  });

  describe('createTaskTemplate', () => {
    it('should create template with auto-incremented sort_order', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return chainable({ data: [{ sort_order: 5 }], error: null });
        }
        const newTemplate = {
          id: 'tmpl-new',
          rep_id: 'rep-1',
          title: 'New Task',
          sort_order: 6,
          is_active: true,
        };
        return chainable({ data: newTemplate, error: null });
      });

      const result = await createTaskTemplate('rep-1', {
        title: 'New Task',
        priority: 'low',
      });

      expect(result.title).toBe('New Task');
      expect(result.sort_order).toBe(6);
    });

    it('should start sort_order at 0 when no existing templates', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return chainable({ data: [], error: null });
        }
        return chainable({
          data: { id: 'tmpl-new', sort_order: 0, title: 'First' },
          error: null,
        });
      });

      const result = await createTaskTemplate('rep-1', { title: 'First' });
      expect(result.sort_order).toBe(0);
    });

    it('should throw on creation error', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return chainable({ data: [], error: null });
        }
        return chainable({ data: null, error: new Error('Insert failed') });
      });

      await expect(
        createTaskTemplate('rep-1', { title: 'Bad' })
      ).rejects.toThrow();
    });
  });

  describe('updateTaskTemplate', () => {
    it('should update specified fields only', async () => {
      const updated = { ...mockTemplates[0], title: 'Updated Title', priority: 'low' };
      mockFrom.mockReturnValue(chainable({ data: updated, error: null }));

      const result = await updateTaskTemplate('tmpl-1', {
        title: 'Updated Title',
        priority: 'low',
      });

      expect(result.title).toBe('Updated Title');
      expect(result.priority).toBe('low');
    });

    it('should support toggling is_active', async () => {
      const updated = { ...mockTemplates[0], is_active: false };
      mockFrom.mockReturnValue(chainable({ data: updated, error: null }));

      const result = await updateTaskTemplate('tmpl-1', { is_active: false });
      expect(result.is_active).toBe(false);
    });

    it('should throw on update error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('Not found') }));
      await expect(
        updateTaskTemplate('nonexistent', { title: 'X' })
      ).rejects.toThrow();
    });
  });

  describe('deleteTaskTemplate', () => {
    it('should delete template by ID', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));
      await deleteTaskTemplate('tmpl-1');
      expect(mockFrom).toHaveBeenCalledWith('rep_task_templates');
    });

    it('should throw on delete error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('FK constraint') }));
      await expect(deleteTaskTemplate('tmpl-1')).rejects.toThrow();
    });
  });

  describe('getAutoCreateSetting', () => {
    it('should return auto_create_enabled value when setting exists', async () => {
      mockFrom.mockReturnValue(
        chainable({ data: { auto_create_enabled: true }, error: null })
      );
      const result = await getAutoCreateSetting('rep-1');
      expect(result).toBe(true);
    });

    it('should default to false when no setting exists', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));
      const result = await getAutoCreateSetting('rep-1');
      expect(result).toBe(false);
    });

    it('should throw on error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('DB error') }));
      await expect(getAutoCreateSetting('rep-1')).rejects.toThrow();
    });
  });

  describe('setAutoCreateSetting', () => {
    it('should upsert the auto-create setting', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));
      await setAutoCreateSetting('rep-1', true);
      expect(mockFrom).toHaveBeenCalledWith('rep_task_template_settings');
    });

    it('should throw on upsert error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('Upsert failed') }));
      await expect(setAutoCreateSetting('rep-1', true)).rejects.toThrow();
    });
  });

  describe('reorderTaskTemplates', () => {
    it('should batch update sort_order for all templates', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));

      await reorderTaskTemplates([
        { id: 'tmpl-1', sort_order: 1 },
        { id: 'tmpl-2', sort_order: 0 },
      ]);

      expect(mockFrom).toHaveBeenCalledTimes(2);
    });

    it('should throw if any update fails', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return chainable({ data: null, error: new Error('Update failed') });
        }
        return chainable({ data: null, error: null });
      });

      await expect(
        reorderTaskTemplates([
          { id: 'tmpl-1', sort_order: 1 },
          { id: 'tmpl-2', sort_order: 0 },
        ])
      ).rejects.toThrow();
    });
  });
});
