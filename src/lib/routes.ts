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
 * Generates the correct call detail URL (same for all roles).
 */
export function getCallDetailUrl(callId: string): string {
  return `/calls/${callId}`;
}
