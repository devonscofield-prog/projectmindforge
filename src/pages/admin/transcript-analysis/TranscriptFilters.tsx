import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarIcon,
  Search,
  Users,
  Building2,
  Filter,
  ChevronDown,
  FileCheck,
} from 'lucide-react';
import { TIME_RANGES, CALL_TYPES, ANALYSIS_STATUS_OPTIONS, TranscriptAnalysisStatus } from './constants';

interface TranscriptFiltersProps {
  dateRange: { from: Date; to: Date };
  selectedPreset: string;
  selectedTeamId: string;
  selectedRepId: string;
  accountSearch: string;
  selectedCallTypes: string[];
  selectedAnalysisStatus: 'all' | TranscriptAnalysisStatus;
  teams: { id: string; name: string }[] | undefined;
  reps: { id: string; name: string; team_id: string | null }[] | undefined;
  isLoadingTeams?: boolean;
  isLoadingReps?: boolean;
  onPresetChange: (value: string) => void;
  onFromDateChange: (date: Date | undefined) => void;
  onToDateChange: (date: Date | undefined) => void;
  onTeamChange: (value: string) => void;
  onRepChange: (value: string) => void;
  onAccountSearchChange: (value: string) => void;
  onToggleCallType: (callType: string) => void;
  onAnalysisStatusChange: (value: 'all' | TranscriptAnalysisStatus) => void;
  hideTeamFilter?: boolean;
  hideRepFilter?: boolean;
}

export function TranscriptFilters({
  dateRange,
  selectedPreset,
  selectedTeamId,
  selectedRepId,
  accountSearch,
  selectedCallTypes,
  selectedAnalysisStatus,
  teams,
  reps,
  isLoadingTeams,
  isLoadingReps,
  onPresetChange,
  onFromDateChange,
  onToDateChange,
  onTeamChange,
  onRepChange,
  onAccountSearchChange,
  onToggleCallType,
  onAnalysisStatusChange,
  hideTeamFilter = false,
  hideRepFilter = false,
}: TranscriptFiltersProps) {
  // Debounce account search - local state updates immediately, parent notified after delay
  const [localAccountSearch, setLocalAccountSearch] = useState(accountSearch);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localAccountSearch !== accountSearch) {
        onAccountSearchChange(localAccountSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localAccountSearch, accountSearch, onAccountSearchChange]);

  // Sync local state if parent changes (e.g., from clear filters)
  useEffect(() => {
    setLocalAccountSearch(accountSearch);
  }, [accountSearch]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-start gap-4">
          {/* Date Range */}
          <div className="space-y-1">
            <Label htmlFor="time-period-select" className="text-xs text-muted-foreground">Time Period</Label>
            <div className="flex items-center gap-2">
              <Select value={selectedPreset} onValueChange={onPresetChange}>
                <SelectTrigger id="time-period-select" className="w-[140px]" aria-label="Select time period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
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
                    <Button variant="outline" size="sm" className="w-[130px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(dateRange.from, 'MMM d, yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.from}
                        onSelect={onFromDateChange}
                        disabled={(date) => date > dateRange.to || date > new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground text-sm">to</span>
                  <Popover>
                    <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-[130px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(dateRange.to, 'MMM d, yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.to}
                        onSelect={onToDateChange}
                        disabled={(date) => date < dateRange.from || date > new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </>
              )}
            </div>
          </div>

          {/* Team Filter - Hidden for managers (team-scoped view) */}
          {!hideTeamFilter && (
            <div className="space-y-1">
              <Label htmlFor="team-select" className="text-xs text-muted-foreground">Team</Label>
              {isLoadingTeams ? (
                <Skeleton className="h-9 w-[160px]" />
              ) : (
                <Select value={selectedTeamId} onValueChange={onTeamChange}>
                  <SelectTrigger id="team-select" className="w-[160px]" aria-label="Select team">
                    <Building2 className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Teams" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="all">All Teams</SelectItem>
                    {teams?.map(team => (
                      <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Rep Filter - Hidden for reps (self-scoped view) */}
          {!hideRepFilter && (
            <div className="space-y-1">
              <Label htmlFor="rep-select" className="text-xs text-muted-foreground">Rep</Label>
              {isLoadingReps ? (
                <Skeleton className="h-9 w-[180px]" />
              ) : (
                <Select value={selectedRepId} onValueChange={onRepChange}>
                  <SelectTrigger id="rep-select" className="w-[180px]" aria-label="Select rep">
                    <Users className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Reps" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="all">All Reps</SelectItem>
                    {reps?.map(rep => (
                      <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Account Search */}
          <div className="space-y-1">
            <Label htmlFor="account-search" className="text-xs text-muted-foreground">Account</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="account-search"
                placeholder="Search accounts..."
                value={localAccountSearch}
                onChange={(e) => setLocalAccountSearch(e.target.value)}
                className="pl-8 w-[180px]"
                aria-label="Search accounts"
              />
            </div>
          </div>

          {/* Call Type Filter */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Call Type</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-[160px] justify-between"
                  aria-label={`Filter by call type, ${selectedCallTypes.length === 0 ? 'all types' : `${selectedCallTypes.length} selected`}`}
                >
                  {selectedCallTypes.length === 0 ? 'All Types' : `${selectedCallTypes.length} selected`}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-2" align="start">
                <div className="space-y-1">
                  {CALL_TYPES.map(type => (
                    <label
                      key={type.value}
                      htmlFor={`call-type-${type.value}`}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox 
                        id={`call-type-${type.value}`}
                        checked={selectedCallTypes.includes(type.value)} 
                        onCheckedChange={() => onToggleCallType(type.value)}
                        aria-label={`Filter by ${type.label}`}
                      />
                      <span className="text-sm">{type.label}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Analysis Status Filter */}
          <div className="space-y-1">
            <Label htmlFor="status-select" className="text-xs text-muted-foreground">Status</Label>
            <Select value={selectedAnalysisStatus} onValueChange={(v) => onAnalysisStatusChange(v as 'all' | TranscriptAnalysisStatus)}>
              <SelectTrigger id="status-select" className="w-[140px]" aria-label="Filter by analysis status">
                <FileCheck className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {ANALYSIS_STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
