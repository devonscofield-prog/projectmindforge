import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarIcon, ArrowRight, Loader2, BarChart3, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  TIME_RANGES, 
  DateRange, 
  PeriodValidation, 
  formatDateShort,
} from './dateUtils';

interface DateRangeControlsProps {
  // Primary date range
  dateRange: DateRange;
  selectedPreset: string;
  onPresetChange: (value: string) => void;
  onFromDateChange: (date: Date | undefined) => void;
  onToDateChange: (date: Date | undefined) => void;
  
  // Comparison
  isComparisonMode: boolean;
  comparisonDateRange: DateRange;
  comparisonPreset: string;
  comparisonConfirmed: boolean;
  isComparisonFetching: boolean;
  hasValidationErrors: boolean;
  periodValidation: PeriodValidation | null;
  onComparisonPresetChange: (value: string) => void;
  onComparisonFromDateChange: (date: Date | undefined) => void;
  onComparisonToDateChange: (date: Date | undefined) => void;
  onRunComparison: () => void;
  setComparisonDateRange: (range: DateRange) => void;
  setComparisonPreset: (preset: string) => void;
  setComparisonConfirmed: (confirmed: boolean) => void;
}

export function DateRangeControls({
  dateRange,
  selectedPreset,
  onPresetChange,
  onFromDateChange,
  onToDateChange,
  isComparisonMode,
  comparisonDateRange,
  comparisonPreset,
  comparisonConfirmed,
  isComparisonFetching,
  hasValidationErrors,
  periodValidation,
  onComparisonPresetChange,
  onComparisonFromDateChange,
  onComparisonToDateChange,
  onRunComparison,
  setComparisonDateRange,
  setComparisonPreset,
  setComparisonConfirmed,
}: DateRangeControlsProps) {
  const handleQuickFix = (quickFix: string) => {
    if (quickFix === 'use-previous-period') {
      // handleComparisonPresetChange('previous') already calculates and sets the date range
      setComparisonPreset('previous');
      setComparisonConfirmed(false);
    } else if (quickFix === 'shift-period-a') {
      const periodBDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
      const newTo = new Date(dateRange.from);
      newTo.setDate(newTo.getDate() - 1);
      newTo.setHours(23, 59, 59, 999);
      const newFrom = new Date(newTo);
      newFrom.setDate(newFrom.getDate() - periodBDays);
      newFrom.setHours(0, 0, 0, 0);
      setComparisonDateRange({ from: newFrom, to: newTo });
      setComparisonPreset('custom');
      setComparisonConfirmed(false);
    } else if (quickFix === 'match-duration') {
      const periodBDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
      const newFrom = new Date(comparisonDateRange.to);
      newFrom.setDate(newFrom.getDate() - periodBDays);
      newFrom.setHours(0, 0, 0, 0);
      setComparisonDateRange({ ...comparisonDateRange, from: newFrom });
      setComparisonPreset('custom');
      setComparisonConfirmed(false);
    }
  };

  return (
    <div className="flex flex-wrap items-start gap-4 p-4 bg-muted/50 rounded-lg">
      {/* Primary Date Range */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          {isComparisonMode ? 'Period B (Recent)' : 'Time Period'}
        </Label>
        <div className="flex items-center gap-2">
          <Select value={selectedPreset} onValueChange={onPresetChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map(r => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          
          {selectedPreset === 'custom' && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-[120px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formatDateShort(dateRange.from)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={onFromDateChange}
                    disabled={(date) => date > dateRange.to || date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              
              <span className="text-muted-foreground text-sm">to</span>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-[120px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formatDateShort(dateRange.to)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={onToDateChange}
                    disabled={(date) => date < dateRange.from || date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>
      </div>

      {/* Comparison Date Range */}
      {isComparisonMode && (
        <>
          <div className="flex items-center self-end pb-2">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Period A (Earlier)</Label>
            <div className="flex items-center gap-2">
              <Select value={comparisonPreset} onValueChange={onComparisonPresetChange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="previous">Previous Period</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
              
              {comparisonPreset === 'custom' && (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-[120px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formatDateShort(comparisonDateRange.from)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={comparisonDateRange.from}
                        onSelect={onComparisonFromDateChange}
                        disabled={(date) => date > comparisonDateRange.to || date > new Date()}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <span className="text-muted-foreground text-sm">to</span>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-[120px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formatDateShort(comparisonDateRange.to)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={comparisonDateRange.to}
                        onSelect={onComparisonToDateChange}
                        disabled={(date) => date < comparisonDateRange.from || date > new Date()}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </>
              )}
            </div>
          </div>

          <div className="flex items-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button 
                      onClick={onRunComparison}
                      disabled={(comparisonConfirmed && isComparisonFetching) || hasValidationErrors}
                    >
                      {comparisonConfirmed && isComparisonFetching ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <BarChart3 className="h-4 w-4 mr-2" />
                      )}
                      {comparisonConfirmed ? 'Re-run Comparison' : 'Run Comparison'}
                    </Button>
                  </span>
                </TooltipTrigger>
                {hasValidationErrors && (
                  <TooltipContent>
                    <p>Fix period errors before comparing</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </>
      )}
      
      {/* Validation Warnings */}
      {isComparisonMode && periodValidation && periodValidation.warnings.length > 0 && (
        <div className="w-full space-y-2 mt-2">
          {periodValidation.warnings.map((warning, index) => (
            <Alert 
              key={index} 
              variant={warning.type === 'error' ? 'destructive' : 'default'}
              className={cn(
                "py-2",
                warning.type === 'warning' && "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
                warning.type === 'info' && "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400"
              )}
            >
              {warning.type === 'error' && <AlertTriangle className="h-4 w-4" />}
              {warning.type === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
              {warning.type === 'info' && <Info className="h-4 w-4 text-blue-600" />}
              <AlertDescription className="text-sm flex items-center justify-between gap-4">
                <span>{warning.message}</span>
                {warning.quickFix && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "shrink-0 h-7 text-xs",
                      warning.type === 'error' && "border-destructive/50 hover:bg-destructive/10",
                      warning.type === 'warning' && "border-yellow-500/50 hover:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
                      warning.type === 'info' && "border-blue-500/50 hover:bg-blue-500/10 text-blue-700 dark:text-blue-400"
                    )}
                    onClick={() => handleQuickFix(warning.quickFix!)}
                  >
                    {warning.quickFix === 'use-previous-period' && 'Use Previous Period'}
                    {warning.quickFix === 'shift-period-a' && 'Fix Overlap'}
                    {warning.quickFix === 'match-duration' && 'Match Duration'}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
}
