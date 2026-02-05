/**
 * Shared constants for task/follow-up priority and category configuration.
 * Used across RepTasks, TaskTemplateRow, PendingFollowUpsWidget, etc.
 */

export const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  high: { label: 'HIGH', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  medium: { label: 'MED', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  low: { label: 'LOW', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
};

export const CATEGORY_LABELS: Record<string, string> = {
  phone_call: 'Phone Call',
  drip_email: 'DRIP Email',
  text_message: 'Text Message',
  follow_up_email: 'Follow Up Email',
};

export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 1000;
