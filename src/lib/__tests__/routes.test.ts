import { describe, it, expect } from 'vitest';
import { getAccountDetailUrl, getCallDetailUrl, getRepDetailUrl, getCoachingSummaryUrl, getDashboardUrl, getAccountsUrl, getAccountsLabel, getCallHistoryUrl, getCallHistoryLabel } from '../routes';

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

describe('getDashboardUrl', () => {
  it('returns admin dashboard for admin role', () => {
    expect(getDashboardUrl('admin')).toBe('/admin');
  });

  it('returns manager dashboard for manager role', () => {
    expect(getDashboardUrl('manager')).toBe('/manager');
  });

  it('returns rep dashboard for rep role', () => {
    expect(getDashboardUrl('rep')).toBe('/rep');
  });

  it('returns rep dashboard for null role (default)', () => {
    expect(getDashboardUrl(null)).toBe('/rep');
  });
});

describe('getAccountsUrl', () => {
  it('returns admin accounts path for admin role', () => {
    expect(getAccountsUrl('admin')).toBe('/admin/accounts');
  });

  it('returns manager accounts path for manager role', () => {
    expect(getAccountsUrl('manager')).toBe('/manager/accounts');
  });

  it('returns rep prospects path for rep role', () => {
    expect(getAccountsUrl('rep')).toBe('/rep/prospects');
  });

  it('returns rep prospects path for null role (default)', () => {
    expect(getAccountsUrl(null)).toBe('/rep/prospects');
  });
});

describe('getAccountsLabel', () => {
  it('returns "Accounts" for admin role', () => {
    expect(getAccountsLabel('admin')).toBe('Accounts');
  });

  it('returns "Accounts" for manager role', () => {
    expect(getAccountsLabel('manager')).toBe('Accounts');
  });

  it('returns "My Accounts" for rep role', () => {
    expect(getAccountsLabel('rep')).toBe('My Accounts');
  });

  it('returns "My Accounts" for null role (default)', () => {
    expect(getAccountsLabel(null)).toBe('My Accounts');
  });
});

describe('getCallHistoryUrl', () => {
  it('returns admin dashboard for admin role', () => {
    expect(getCallHistoryUrl('admin')).toBe('/admin');
  });

  it('returns manager coaching path for manager role', () => {
    expect(getCallHistoryUrl('manager')).toBe('/manager/coaching');
  });

  it('returns rep history path for rep role', () => {
    expect(getCallHistoryUrl('rep')).toBe('/rep/history');
  });

  it('returns rep history path for null role (default)', () => {
    expect(getCallHistoryUrl(null)).toBe('/rep/history');
  });
});

describe('getCallHistoryLabel', () => {
  it('returns "Dashboard" for admin role', () => {
    expect(getCallHistoryLabel('admin')).toBe('Dashboard');
  });

  it('returns "Coaching" for manager role', () => {
    expect(getCallHistoryLabel('manager')).toBe('Coaching');
  });

  it('returns "Call History" for rep role', () => {
    expect(getCallHistoryLabel('rep')).toBe('Call History');
  });

  it('returns "Call History" for null role (default)', () => {
    expect(getCallHistoryLabel(null)).toBe('Call History');
  });
});
