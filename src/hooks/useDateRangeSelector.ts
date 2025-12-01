import { useState, useCallback, useRef, useEffect } from 'react';

export interface DateRange {
  from: Date;
  to: Date;
}

export type DatePreset = '7' | '14' | '30' | '90' | '180' | 'custom' | 'previous';

export interface DateRangePresetOption {
  value: DatePreset;
  label: string;
}

export const DEFAULT_PRESETS: DateRangePresetOption[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
  { value: 'custom', label: 'Custom range' },
];

export interface UseDateRangeSelectorOptions {
  /**
   * Initial preset to use (e.g., '30' for 30 days)
   */
  initialPreset?: DatePreset;
  
  /**
   * Custom preset options (defaults to DEFAULT_PRESETS)
   */
  presets?: DateRangePresetOption[];
  
  /**
   * Callback when date range changes
   */
  onChange?: (dateRange: DateRange, preset: DatePreset) => void;
  
  /**
   * Debounce delay in milliseconds for date changes (defaults to 0, no debounce)
   */
  debounceMs?: number;
  
  /**
   * Whether to set time boundaries (00:00:00 for start, 23:59:59 for end)
   * Defaults to true
   */
  setTimeBoundaries?: boolean;
}

/**
 * Creates a date range from the current date going back N days
 */
export function createDateRange(daysBack: number): DateRange {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

/**
 * Creates a date range for the previous period matching the given range duration
 */
export function createPreviousPeriodRange(currentRange: DateRange): DateRange {
  const duration = Math.ceil((currentRange.to.getTime() - currentRange.from.getTime()) / (1000 * 60 * 60 * 24));
  const to = new Date(currentRange.from);
  to.setDate(to.getDate() - 1);
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setDate(from.getDate() - duration + 1);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

/**
 * Custom hook for managing date range selection with presets
 */
export function useDateRangeSelector(options: UseDateRangeSelectorOptions = {}) {
  const {
    initialPreset = '30',
    presets = DEFAULT_PRESETS,
    onChange,
    debounceMs = 0,
    setTimeBoundaries = true,
  } = options;

  const [selectedPreset, setSelectedPreset] = useState<DatePreset>(initialPreset);
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    if (initialPreset === 'custom') {
      return createDateRange(30);
    }
    return createDateRange(parseInt(initialPreset));
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const triggerOnChange = useCallback((range: DateRange, preset: DatePreset) => {
    if (!onChange) return;

    if (debounceMs > 0) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        onChange(range, preset);
      }, debounceMs);
    } else {
      onChange(range, preset);
    }
  }, [onChange, debounceMs]);

  const handlePresetChange = useCallback((preset: DatePreset) => {
    setSelectedPreset(preset);
    if (preset !== 'custom') {
      const newRange = createDateRange(parseInt(preset));
      setDateRange(newRange);
      triggerOnChange(newRange, preset);
    }
  }, [triggerOnChange]);

  const handleFromDateChange = useCallback((date: Date | undefined) => {
    if (!date) return;

    if (setTimeBoundaries) {
      date.setHours(0, 0, 0, 0);
    }
    
    const newRange = { ...dateRange, from: date };
    setDateRange(newRange);
    setSelectedPreset('custom');
    triggerOnChange(newRange, 'custom');
  }, [dateRange, setTimeBoundaries, triggerOnChange]);

  const handleToDateChange = useCallback((date: Date | undefined) => {
    if (!date) return;

    if (setTimeBoundaries) {
      date.setHours(23, 59, 59, 999);
    }
    
    const newRange = { ...dateRange, to: date };
    setDateRange(newRange);
    setSelectedPreset('custom');
    triggerOnChange(newRange, 'custom');
  }, [dateRange, setTimeBoundaries, triggerOnChange]);

  const setCustomDateRange = useCallback((range: DateRange) => {
    setDateRange(range);
    setSelectedPreset('custom');
    triggerOnChange(range, 'custom');
  }, [triggerOnChange]);

  return {
    dateRange,
    selectedPreset,
    presets,
    handlePresetChange,
    handleFromDateChange,
    handleToDateChange,
    setCustomDateRange,
  };
}
