import type { UserRole } from '@/types/database';

/**
 * Generates the correct account/prospect detail URL based on user role.
 * - Admin: /admin/accounts/:id
 * - Manager: /manager/accounts/:id
 * - Rep: /rep/prospects/:id
 */
export function getAccountDetailUrl(role: UserRole | null, prospectId: string): string {
  switch (role) {
    case 'admin':
      return `/admin/accounts/${prospectId}`;
    case 'manager':
      return `/manager/accounts/${prospectId}`;
    case 'rep':
    default:
      return `/rep/prospects/${prospectId}`;
  }
}

/**
 * Generates the rep detail URL.
 * Both managers and admins use /manager/rep/:repId
 */
export function getRepDetailUrl(repId: string, tab?: string): string {
  const base = `/manager/rep/${repId}`;
  return tab ? `${base}?tab=${tab}` : base;
}

/**
 * Generates the rep coaching summary URL based on role.
 * - Manager/Admin viewing a rep: /rep/coaching-summary/:repId
 * - Rep viewing own: /rep/coaching-summary
 */
export function getCoachingSummaryUrl(repId?: string): string {
  return repId ? `/rep/coaching-summary/${repId}` : '/rep/coaching-summary';
}

/**
 * Generates the correct call detail URL (same for all roles).
 */
export function getCallDetailUrl(callId: string): string {
  return `/calls/${callId}`;
}

/**
 * Generates the correct dashboard URL based on user role.
 * - Admin: /admin
 * - Manager: /manager
 * - Trainee: /training
 * - Rep: /rep
 */
export function getDashboardUrl(role: UserRole | null): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'manager':
      return '/manager';
    case 'trainee':
      return '/training';
    case 'rep':
    default:
      return '/rep';
  }
}

/**
 * Generates the correct accounts/prospects list URL based on user role.
 * - Admin: /admin/accounts
 * - Manager: /manager/accounts
 * - Rep: /rep/prospects
 */
export function getAccountsUrl(role: UserRole | null): string {
  switch (role) {
    case 'admin':
      return '/admin/accounts';
    case 'manager':
      return '/manager/accounts';
    case 'rep':
    default:
      return '/rep/prospects';
  }
}

/**
 * Gets the display label for accounts based on user role.
 * - Rep: "My Accounts"
 * - Others: "Accounts"
 */
export function getAccountsLabel(role: UserRole | null): string {
  return role === 'rep' ? 'My Accounts' : 'Accounts';
}

/**
 * Generates the correct call history URL based on user role.
 * - Admin: /admin/history
 * - Manager: /manager/history
 * - Rep: /rep/history
 */
export function getCallHistoryUrl(role: UserRole | null): string {
  switch (role) {
    case 'admin':
      return '/admin/history';
    case 'manager':
      return '/manager/history';
    case 'rep':
    default:
      return '/rep/history';
  }
}

/**
 * Gets the display label for call history based on user role.
 */
export function getCallHistoryLabel(role: UserRole | null): string {
  switch (role) {
    case 'admin':
      return 'Organization Call History';
    case 'manager':
      return 'Team Call History';
    case 'rep':
    default:
      return 'Call History';
  }
}

/**
 * Generates the correct reporting URL based on user role.
 */
export function getReportingUrl(role: UserRole | null): string {
  return role === 'admin' ? '/admin/reporting' : '/manager/reporting';
}
