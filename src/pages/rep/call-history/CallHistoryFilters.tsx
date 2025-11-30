import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { callTypeOptions } from '@/constants/callTypes';
import { Filter, ChevronDown, X } from 'lucide-react';
import { analysisStatusOptions, heatRangeOptions } from './constants';

interface CallHistoryFiltersProps {
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  callTypeFilter: string;
  statusFilter: string;
  heatFilter: string;
  dateFrom: string;
  dateTo: string;
  hasActiveFilters: boolean;
  onCallTypeChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onHeatChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClearFilters: () => void;
}

export function CallHistoryFilters({
  filtersOpen,
  onFiltersOpenChange,
  callTypeFilter,
  statusFilter,
  heatFilter,
  dateFrom,
  dateTo,
  hasActiveFilters,
  onCallTypeChange,
  onStatusChange,
  onHeatChange,
  onDateFromChange,
  onDateToChange,
  onClearFilters,
}: CallHistoryFiltersProps) {
  return (
    <Collapsible open={filtersOpen} onOpenChange={onFiltersOpenChange}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer md:cursor-default">
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-2">Active</Badge>
                )}
              </span>
              <ChevronDown className="h-4 w-4 md:hidden transition-transform duration-200 data-[state=open]:rotate-180" />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent className="md:block" forceMount>
          <CardContent className="space-y-4 hidden md:block data-[state=open]:block">
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
              {/* Call Type */}
              <div className="space-y-2">
                <Label>Call Type</Label>
                <Select value={callTypeFilter} onValueChange={onCallTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {callTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={onStatusChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {analysisStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Heat Level */}
              <div className="space-y-2">
                <Label>Heat Level</Label>
                <Select value={heatFilter} onValueChange={onHeatChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All heat levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Heat Levels</SelectItem>
                    {heatRangeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date From */}
              <div className="space-y-2">
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateFromChange(e.target.value)}
                />
              </div>

              {/* Date To */}
              <div className="space-y-2">
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateToChange(e.target.value)}
                />
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={onClearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
