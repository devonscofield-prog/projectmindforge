import { format } from 'date-fns';

export const TIME_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
];

export const DATE_CHANGE_DEBOUNCE = 500;

export interface DateRange {
  from: Date;
  to: Date;
}

export type QuickFixType = 'shift-period-a' | 'match-duration' | 'use-previous-period';

export interface PeriodValidation {
  hasOverlap: boolean;
  overlapDays: number;
  isIdentical: boolean;
  periodADays: number;
  periodBDays: number;
  daysDifference: number;
  warnings: Array<{ type: 'error' | 'warning' | 'info'; message: string; quickFix?: QuickFixType }>;
}

export function createDateRange(daysBack: number): DateRange {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export function createPreviousPeriodRange(dateRange: DateRange): DateRange {
  const days = Math.floor((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
  const to = new Date(dateRange.from);
  to.setDate(to.getDate() - 1);
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export function validatePeriods(periodA: DateRange, periodB: DateRange): PeriodValidation {
  const warnings: Array<{ type: 'error' | 'warning' | 'info'; message: string; quickFix?: QuickFixType }> = [];
  
  const periodADays = Math.ceil((periodA.to.getTime() - periodA.from.getTime()) / (1000 * 60 * 60 * 24));
  const periodBDays = Math.ceil((periodB.to.getTime() - periodB.from.getTime()) / (1000 * 60 * 60 * 24));
  const daysDifference = Math.abs(periodADays - periodBDays);
  
  const isIdentical = 
    periodA.from.toDateString() === periodB.from.toDateString() &&
    periodA.to.toDateString() === periodB.to.toDateString();
  
  if (isIdentical) {
    warnings.push({
      type: 'error',
      message: 'Both periods are identical. Select different date ranges to compare.',
      quickFix: 'use-previous-period'
    });
  }
  
  const overlapStart = Math.max(periodA.from.getTime(), periodB.from.getTime());
  const overlapEnd = Math.min(periodA.to.getTime(), periodB.to.getTime());
  const hasOverlap = !isIdentical && overlapStart <= overlapEnd;
  const overlapDays = hasOverlap ? Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1 : 0;
  
  if (hasOverlap && overlapDays > 0) {
    warnings.push({
      type: 'warning',
      message: `Periods overlap by ${overlapDays} day${overlapDays > 1 ? 's' : ''}. This may skew comparison results.`,
      quickFix: 'shift-period-a'
    });
  }
  
  if (!isIdentical && daysDifference > 7 && daysDifference > Math.min(periodADays, periodBDays) * 0.3) {
    warnings.push({
      type: 'info',
      message: `Period lengths differ by ${daysDifference} days. Results will be normalized but may vary.`,
      quickFix: 'match-duration'
    });
  }
  
  return {
    hasOverlap,
    overlapDays,
    isIdentical,
    periodADays,
    periodBDays,
    daysDifference,
    warnings
  };
}

export function formatDateShort(date: Date): string {
  return format(date, 'MMM d, yy');
}

export function formatDateISO(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}
