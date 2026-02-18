import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));
import {
  SDR_CALL_DETAIL_SELECT,
  SDR_CALL_LIST_SELECT,
  SDR_TRANSCRIPT_LIST_SELECT,
} from '../queries';

describe('sdr query projections', () => {
  it('transcript list select excludes transcript raw_text', () => {
    expect(SDR_TRANSCRIPT_LIST_SELECT).not.toContain('raw_text');
  });

  it('call list select excludes heavyweight raw fields', () => {
    expect(SDR_CALL_LIST_SELECT).not.toContain('raw_text');
    expect(SDR_CALL_LIST_SELECT).not.toContain('raw_json');
  });

  it('call detail select includes full raw fields', () => {
    expect(SDR_CALL_DETAIL_SELECT).toContain('raw_text');
    expect(SDR_CALL_DETAIL_SELECT).toContain('raw_json');
  });
});
