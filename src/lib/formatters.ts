/**
 * Parse a date-only string (YYYY-MM-DD) as a local date, avoiding timezone issues.
 * JavaScript's `new Date("YYYY-MM-DD")` interprets as UTC midnight, causing dates
 * to appear as the previous day in negative UTC offset timezones.
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date object representing the date in local timezone
 */
export function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format a number as USD currency with no decimal places
 * @param value - The number to format (or null)
 * @returns Formatted currency string or "—" if null
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a number as compact USD currency (e.g., $1.2M, $50K)
 * @param value - The number to format
 * @returns Compact formatted currency string
 */
export function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  } else if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}
