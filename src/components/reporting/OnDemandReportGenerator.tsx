import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, BarChart3 } from 'lucide-react';
import { subDays, format, startOfDay } from 'date-fns';
import { getTeamReps } from '@/api/dailyReportConfig';
import { generateReport, type ReportType, type ReportData, type ReportFilters } from '@/api/reportingApi';
import { ReportResultsTable } from './ReportResultsTable';
import { ColumnSelector, getDefaultColumns } from './ColumnSelector';

type DatePreset = 'today' | 'last_7' | 'last_30' | 'custom';

export function OnDemandReportGenerator() {
  const [reportType, setReportType] = useState<ReportType>('team_performance');
  const [datePreset, setDatePreset] = useState<DatePreset>('last_7');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedRepId, setSelectedRepId] = useState<string>('all');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(getDefaultColumns('team_performance'));

  const { data: reps = [], isLoading: repsLoading } = useQuery({
    queryKey: ['team-reps-for-report'],
    queryFn: getTeamReps,
  });

  const mutation = useMutation({
    mutationFn: generateReport,
    onSuccess: (data) => setReportData(data),
  });

  const handleReportTypeChange = (v: string) => {
    const newType = v as ReportType;
    setReportType(newType);
    setReportData(null);
    setVisibleColumns(getDefaultColumns(newType));
  };

  const getDateRange = (): { startDate: string; endDate: string } => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    switch (datePreset) {
      case 'today':
        return { startDate: todayStr, endDate: todayStr };
      case 'last_7':
        return { startDate: format(subDays(startOfDay(now), 6), 'yyyy-MM-dd'), endDate: todayStr };
      case 'last_30':
        return { startDate: format(subDays(startOfDay(now), 29), 'yyyy-MM-dd'), endDate: todayStr };
      case 'custom':
        return { startDate: customStart || todayStr, endDate: customEnd || todayStr };
    }
  };

  const handleGenerate = () => {
    const { startDate, endDate } = getDateRange();
    const repIds = selectedRepId === 'all' ? null : [selectedRepId];
    const filters: ReportFilters = { reportType, startDate, endDate, repIds };
    mutation.mutate(filters);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={handleReportTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="team_performance">Team Performance</SelectItem>
                  <SelectItem value="individual_rep">Individual Rep</SelectItem>
                  <SelectItem value="pipeline">Pipeline</SelectItem>
                  <SelectItem value="coaching_activity">Coaching Activity</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="last_7">Last 7 Days</SelectItem>
                  <SelectItem value="last_30">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{reportType === 'individual_rep' ? 'Select Rep' : 'Filter by Rep'}</Label>
              <Select value={selectedRepId} onValueChange={setSelectedRepId} disabled={repsLoading}>
                <SelectTrigger><SelectValue placeholder="All team" /></SelectTrigger>
                <SelectContent>
                  {reportType !== 'individual_rep' && <SelectItem value="all">All Team Members</SelectItem>}
                  {reps.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="invisible">Action</Label>
              <Button
                onClick={handleGenerate}
                disabled={mutation.isPending || (reportType === 'individual_rep' && selectedRepId === 'all')}
                className="w-full"
                variant="gradient"
              >
                {mutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                ) : (
                  <><BarChart3 className="h-4 w-4 mr-2" />Generate Report</>
                )}
              </Button>
            </div>
          </div>

          {datePreset === 'custom' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {reportData && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-4">
              <div />
              <ColumnSelector
                reportType={reportType}
                visibleColumns={visibleColumns}
                onChange={setVisibleColumns}
              />
            </div>
            <ReportResultsTable data={reportData} visibleColumns={visibleColumns} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
