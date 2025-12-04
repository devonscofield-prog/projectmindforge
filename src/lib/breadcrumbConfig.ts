import type { UserRole } from '@/types/database';
import type { BreadcrumbItem } from '@/components/ui/page-breadcrumb';
import {
  getDashboardUrl,
  getAccountsUrl,
  getAccountsLabel,
  getCallHistoryUrl,
  getCallHistoryLabel,
} from '@/lib/routes';

/**
 * Centralized breadcrumb configuration for consistent navigation labels
 * across all pages in the application.
 */

// Static page labels (role-independent)
export const BREADCRUMB_LABELS = {
// Admin pages
  users: 'Users',
  teams: 'Teams',
  transcriptAnalysis: 'Transcript Analysis',
  coachingTrends: 'Coaching Trends',
  auditLog: 'Audit Log',
  
  // Manager pages
  coaching: 'Coaching',
  
  // Rep pages
  callHistory: 'Call History',
  coachingSummary: 'Coaching Summary',
} as const;

/**
 * Generate breadcrumb items for account detail pages.
 * Shows: Dashboard > Accounts > [Account Name]
 */
export function getAccountDetailBreadcrumbs(
  role: UserRole | null,
  accountName: string
): BreadcrumbItem[] {
  return [
    { label: getAccountsLabel(role), href: getAccountsUrl(role) },
    { label: accountName },
  ];
}

/**
 * Generate breadcrumb items for call detail pages.
 * Shows: Dashboard > Call History > [Call Name]
 */
export function getCallDetailBreadcrumbs(
  role: UserRole | null,
  callDisplayName: string
): BreadcrumbItem[] {
  return [
    { label: getCallHistoryLabel(role), href: getCallHistoryUrl(role) },
    { label: callDisplayName },
  ];
}

/**
 * Generate breadcrumb items for rep detail pages (manager view).
 * Shows: Dashboard > Team > [Rep Name]
 */
export function getRepDetailBreadcrumbs(
  role: UserRole | null,
  repName: string
): BreadcrumbItem[] {
  return [
    { label: 'Team', href: getDashboardUrl(role) },
    { label: repName },
  ];
}

/**
 * Generate breadcrumb items for coaching summary pages.
 * Shows: Dashboard > Coaching Summary (or Rep Name > Coaching Summary for managers)
 */
export function getCoachingSummaryBreadcrumbs(
  role: UserRole | null,
  repName?: string,
  repDetailUrl?: string
): BreadcrumbItem[] {
  if (repName && repDetailUrl) {
    // Manager/Admin viewing a rep's coaching summary
    return [
      { label: 'Team', href: getDashboardUrl(role) },
      { label: repName, href: repDetailUrl },
      { label: BREADCRUMB_LABELS.coachingSummary },
    ];
  }
  // Rep viewing their own coaching summary
  return [{ label: BREADCRUMB_LABELS.coachingSummary }];
}

/**
 * Generate breadcrumb items for simple single-level pages.
 * Shows: Dashboard > [Page Label]
 */
export function getSimpleBreadcrumb(label: string): BreadcrumbItem[] {
  return [{ label }];
}

/**
 * Type-safe helper to get admin page breadcrumbs
 */
export function getAdminPageBreadcrumb(
  page: 'users' | 'teams' | 'transcriptAnalysis' | 'coachingTrends' | 'accounts' | 'bulkUpload' | 'auditLog'
): BreadcrumbItem[] {
  const labels: Record<typeof page, string> = {
    users: BREADCRUMB_LABELS.users,
    teams: BREADCRUMB_LABELS.teams,
    transcriptAnalysis: BREADCRUMB_LABELS.transcriptAnalysis,
    coachingTrends: BREADCRUMB_LABELS.coachingTrends,
    accounts: 'Accounts',
    bulkUpload: 'Bulk Upload',
    auditLog: BREADCRUMB_LABELS.auditLog,
  };
  return [{ label: labels[page] }];
}

/**
 * Type-safe helper to get manager page breadcrumbs
 */
export function getManagerPageBreadcrumb(
  page: 'accounts' | 'coaching' | 'transcriptAnalysis'
): BreadcrumbItem[] {
  const labels: Record<typeof page, string> = {
    accounts: 'Accounts',
    coaching: BREADCRUMB_LABELS.coaching,
    transcriptAnalysis: BREADCRUMB_LABELS.transcriptAnalysis,
  };
  return [{ label: labels[page] }];
}

/**
 * Type-safe helper to get rep page breadcrumbs
 */
export function getRepPageBreadcrumb(
  page: 'accounts' | 'callHistory' | 'transcriptAnalysis'
): BreadcrumbItem[] {
  const labels: Record<typeof page, string> = {
    accounts: 'Accounts',
    callHistory: BREADCRUMB_LABELS.callHistory,
    transcriptAnalysis: 'Analyze Calls',
  };
  return [{ label: labels[page] }];
}
