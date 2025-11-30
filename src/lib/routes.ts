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
