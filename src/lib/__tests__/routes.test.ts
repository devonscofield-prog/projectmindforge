import { describe, it, expect } from 'vitest';
import { getAccountDetailUrl, getCallDetailUrl } from '../routes';

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

describe('getCallDetailUrl', () => {
  it('returns call detail path', () => {
    expect(getCallDetailUrl('123')).toBe('/calls/123');
  });

  it('handles UUID-style call IDs', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(getCallDetailUrl(uuid)).toBe(`/calls/${uuid}`);
  });
});
