import { describe, it, expect } from 'vitest';
import {
  BREADCRUMB_LABELS,
  getAccountDetailBreadcrumbs,
  getCallDetailBreadcrumbs,
  getRepDetailBreadcrumbs,
  getCoachingSummaryBreadcrumbs,
  getSimpleBreadcrumb,
  getAdminPageBreadcrumb,
  getManagerPageBreadcrumb,
  getRepPageBreadcrumb,
} from '../breadcrumbConfig';

describe('breadcrumbConfig', () => {
  describe('BREADCRUMB_LABELS', () => {
    it('should have correct static labels', () => {
      expect(BREADCRUMB_LABELS.users).toBe('Users');
      expect(BREADCRUMB_LABELS.teams).toBe('Teams');
      expect(BREADCRUMB_LABELS.transcriptAnalysis).toBe('Transcript Analysis');
      expect(BREADCRUMB_LABELS.coachingTrends).toBe('Coaching Trends');
      expect(BREADCRUMB_LABELS.coaching).toBe('Coaching');
      expect(BREADCRUMB_LABELS.callHistory).toBe('Call History');
      expect(BREADCRUMB_LABELS.coachingSummary).toBe('Coaching Summary');
    });
  });

  describe('getAccountDetailBreadcrumbs', () => {
    it('should return correct breadcrumbs for admin role', () => {
      const result = getAccountDetailBreadcrumbs('admin', 'Acme Corp');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ label: 'Accounts', href: '/admin/accounts' });
      expect(result[1]).toEqual({ label: 'Acme Corp' });
    });

    it('should return correct breadcrumbs for manager role', () => {
      const result = getAccountDetailBreadcrumbs('manager', 'TechCo');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ label: 'Accounts', href: '/manager/accounts' });
      expect(result[1]).toEqual({ label: 'TechCo' });
    });

    it('should return correct breadcrumbs for rep role', () => {
      const result = getAccountDetailBreadcrumbs('rep', 'StartupXYZ');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ label: 'My Accounts', href: '/rep/prospects' });
      expect(result[1]).toEqual({ label: 'StartupXYZ' });
    });

    it('should handle null role as rep', () => {
      const result = getAccountDetailBreadcrumbs(null, 'Unknown Account');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ label: 'My Accounts', href: '/rep/prospects' });
      expect(result[1]).toEqual({ label: 'Unknown Account' });
    });
  });

  describe('getCallDetailBreadcrumbs', () => {
    it('should return correct breadcrumbs for admin role', () => {
      const result = getCallDetailBreadcrumbs('admin', 'Discovery Call - Acme');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ label: 'Dashboard', href: '/admin' });
      expect(result[1]).toEqual({ label: 'Discovery Call - Acme' });
    });

    it('should return correct breadcrumbs for manager role', () => {
      const result = getCallDetailBreadcrumbs('manager', 'Demo Call');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ label: 'Coaching', href: '/manager/coaching' });
      expect(result[1]).toEqual({ label: 'Demo Call' });
    });

    it('should return correct breadcrumbs for rep role', () => {
      const result = getCallDetailBreadcrumbs('rep', 'Follow-up Call');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ label: 'Call History', href: '/rep/history' });
      expect(result[1]).toEqual({ label: 'Follow-up Call' });
    });

    it('should handle null role as rep', () => {
      const result = getCallDetailBreadcrumbs(null, 'Some Call');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ label: 'Call History', href: '/rep/history' });
      expect(result[1]).toEqual({ label: 'Some Call' });
    });
  });

  describe('getRepDetailBreadcrumbs', () => {
    it('should return correct breadcrumbs for admin role', () => {
      const result = getRepDetailBreadcrumbs('admin', 'John Smith');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ label: 'Team', href: '/admin' });
      expect(result[1]).toEqual({ label: 'John Smith' });
    });

    it('should return correct breadcrumbs for manager role', () => {
      const result = getRepDetailBreadcrumbs('manager', 'Jane Doe');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ label: 'Team', href: '/manager' });
      expect(result[1]).toEqual({ label: 'Jane Doe' });
    });

    it('should handle null role', () => {
      const result = getRepDetailBreadcrumbs(null, 'Unknown Rep');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ label: 'Team', href: '/rep' });
      expect(result[1]).toEqual({ label: 'Unknown Rep' });
    });
  });

  describe('getCoachingSummaryBreadcrumbs', () => {
    it('should return breadcrumbs for manager viewing rep coaching summary', () => {
      const result = getCoachingSummaryBreadcrumbs('manager', 'John Smith', '/manager/rep/123');
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ label: 'Team', href: '/manager' });
      expect(result[1]).toEqual({ label: 'John Smith', href: '/manager/rep/123' });
      expect(result[2]).toEqual({ label: 'Coaching Summary' });
    });

    it('should return breadcrumbs for admin viewing rep coaching summary', () => {
      const result = getCoachingSummaryBreadcrumbs('admin', 'Jane Doe', '/manager/rep/456');
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ label: 'Team', href: '/admin' });
      expect(result[1]).toEqual({ label: 'Jane Doe', href: '/manager/rep/456' });
      expect(result[2]).toEqual({ label: 'Coaching Summary' });
    });

    it('should return simple breadcrumb for rep viewing own coaching summary', () => {
      const result = getCoachingSummaryBreadcrumbs('rep');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ label: 'Coaching Summary' });
    });

    it('should return simple breadcrumb when no rep info provided', () => {
      const result = getCoachingSummaryBreadcrumbs('manager');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ label: 'Coaching Summary' });
    });

    it('should handle partial rep info (name without URL)', () => {
      const result = getCoachingSummaryBreadcrumbs('manager', 'John Smith');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ label: 'Coaching Summary' });
    });
  });

  describe('getSimpleBreadcrumb', () => {
    it('should return single breadcrumb with given label', () => {
      const result = getSimpleBreadcrumb('Settings');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ label: 'Settings' });
    });

    it('should handle empty string', () => {
      const result = getSimpleBreadcrumb('');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ label: '' });
    });
  });

  describe('getAdminPageBreadcrumb', () => {
    it('should return correct breadcrumb for users page', () => {
      const result = getAdminPageBreadcrumb('users');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ label: 'Users' });
    });

    it('should return correct breadcrumb for teams page', () => {
      const result = getAdminPageBreadcrumb('teams');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ label: 'Teams' });
    });

    it('should return correct breadcrumb for transcript analysis page', () => {
      const result = getAdminPageBreadcrumb('transcriptAnalysis');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ label: 'Transcript Analysis' });
    });

    it('should return correct breadcrumb for coaching trends page', () => {
      const result = getAdminPageBreadcrumb('coachingTrends');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ label: 'Coaching Trends' });
    });

    it('should return correct breadcrumb for accounts page', () => {
      const result = getAdminPageBreadcrumb('accounts');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ label: 'Accounts' });
    });
  });

  describe('getManagerPageBreadcrumb', () => {
    it('should return correct breadcrumb for accounts page', () => {
      const result = getManagerPageBreadcrumb('accounts');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ label: 'Accounts' });
    });

    it('should return correct breadcrumb for coaching page', () => {
      const result = getManagerPageBreadcrumb('coaching');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ label: 'Coaching' });
    });
  });

  describe('getRepPageBreadcrumb', () => {
    it('should return correct breadcrumb for accounts page', () => {
      const result = getRepPageBreadcrumb('accounts');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ label: 'Accounts' });
    });

    it('should return correct breadcrumb for call history page', () => {
      const result = getRepPageBreadcrumb('callHistory');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ label: 'Call History' });
    });
  });
});
