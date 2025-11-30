import { describe, it, expect } from 'vitest';
import { getAccountDetailUrl, getCallDetailUrl, getRepDetailUrl, getCoachingSummaryUrl } from '../routes';

describe('getAccountDetailUrl', () => {
  it('returns admin path for admin role', () => {
    expect(getAccountDetailUrl('admin', '123')).toBe('/admin/accounts/123');
  });

  it('returns manager path for manager role', () => {
    expect(getAccountDetailUrl('manager', '456')).toBe('/manager/accounts/456');
  });

  it('returns rep path for rep role', () => {
    expect(getAccountDetailUrl('rep', '789')).toBe('/rep/prospects/789');
  });

  it('returns rep path for null role (default)', () => {
    expect(getAccountDetailUrl(null, 'abc')).toBe('/rep/prospects/abc');
  });

  it('handles UUID-style prospect IDs', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(getAccountDetailUrl('admin', uuid)).toBe(`/admin/accounts/${uuid}`);
    expect(getAccountDetailUrl('manager', uuid)).toBe(`/manager/accounts/${uuid}`);
    expect(getAccountDetailUrl('rep', uuid)).toBe(`/rep/prospects/${uuid}`);
  });
});

describe('getRepDetailUrl', () => {
  it('returns rep detail path without tab', () => {
    expect(getRepDetailUrl('123')).toBe('/manager/rep/123');
  });

  it('returns rep detail path with tab query param', () => {
    expect(getRepDetailUrl('123', 'call-history')).toBe('/manager/rep/123?tab=call-history');
  });

  it('handles UUID-style rep IDs', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(getRepDetailUrl(uuid)).toBe(`/manager/rep/${uuid}`);
    expect(getRepDetailUrl(uuid, 'coaching')).toBe(`/manager/rep/${uuid}?tab=coaching`);
  });
});

describe('getCoachingSummaryUrl', () => {
  it('returns coaching summary path for own view (no repId)', () => {
    expect(getCoachingSummaryUrl()).toBe('/rep/coaching-summary');
  });

  it('returns coaching summary path with repId for manager/admin view', () => {
    expect(getCoachingSummaryUrl('123')).toBe('/rep/coaching-summary/123');
  });

  it('handles UUID-style rep IDs', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(getCoachingSummaryUrl(uuid)).toBe(`/rep/coaching-summary/${uuid}`);
  });
});

describe('getCallDetailUrl', () => {
  it('returns call detail path', () => {
    expect(getCallDetailUrl('123')).toBe('/calls/123');
  });

  it('handles UUID-style call IDs', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(getCallDetailUrl(uuid)).toBe(`/calls/${uuid}`);
  });
});
