import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CalendarIcon,
  Search,
  Users,
  Building2,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { TIME_RANGES, CALL_TYPES } from './constants';

interface TranscriptFiltersProps {
  dateRange: { from: Date; to: Date };
  selectedPreset: string;
  selectedTeamId: string;
  selectedRepId: string;
  accountSearch: string;
  selectedCallTypes: string[];
  teams: { id: string; name: string }[] | undefined;
  reps: { id: string; name: string; team_id: string | null }[] | undefined;
  onPresetChange: (value: string) => void;
  onFromDateChange: (date: Date | undefined) => void;
  onToDateChange: (date: Date | undefined) => void;
  onTeamChange: (value: string) => void;
  onRepChange: (value: string) => void;
  onAccountSearchChange: (value: string) => void;
  onToggleCallType: (callType: string) => void;
  hideTeamFilter?: boolean;
}

export function TranscriptFilters({
  dateRange,
  selectedPreset,
  selectedTeamId,
  selectedRepId,
  accountSearch,
  selectedCallTypes,
  teams,
  reps,
  onPresetChange,
  onFromDateChange,
  onToDateChange,
  onTeamChange,
  onRepChange,
  onAccountSearchChange,
  onToggleCallType,
  hideTeamFilter = false,
}: TranscriptFiltersProps) {
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
            <Label className="text-xs text-muted-foreground">Time Period</Label>
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
                        {format(dateRange.from, 'MMM d, yy')}
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
                      <Button variant="outline" size="sm" className="w-[120px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(dateRange.to, 'MMM d, yy')}
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
              <Label className="text-xs text-muted-foreground">Team</Label>
              <Select value={selectedTeamId} onValueChange={onTeamChange}>
                <SelectTrigger className="w-[160px]">
                  <Building2 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teams?.map(team => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Rep Filter */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Rep</Label>
            <Select value={selectedRepId} onValueChange={onRepChange}>
              <SelectTrigger className="w-[180px]">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Reps" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reps</SelectItem>
                {reps?.map(rep => (
                  <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Account Search */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Account</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts..."
                value={accountSearch}
                onChange={(e) => onAccountSearchChange(e.target.value)}
                className="pl-8 w-[180px]"
              />
            </div>
          </div>

          {/* Call Type Filter */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Call Type</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[160px] justify-between">
                  {selectedCallTypes.length === 0 ? 'All Types' : `${selectedCallTypes.length} selected`}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-2" align="start">
                <div className="space-y-1">
                  {CALL_TYPES.map(type => (
                    <div
                      key={type.value}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                      onClick={() => onToggleCallType(type.value)}
                    >
                      <Checkbox checked={selectedCallTypes.includes(type.value)} />
                      <span className="text-sm">{type.label}</span>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
