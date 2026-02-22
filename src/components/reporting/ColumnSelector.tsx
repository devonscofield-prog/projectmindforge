import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Columns3 } from 'lucide-react';
import type { ReportType } from '@/api/reportingApi';

export interface ColumnDef {
  key: string;
  label: string;
}

const COLUMNS_BY_TYPE: Record<ReportType, ColumnDef[]> = {
  team_performance: [
    { key: 'rep_name', label: 'Rep' },
    { key: 'total_calls', label: 'Calls' },
    { key: 'total_opp_size', label: 'Opp Size' },
    { key: 'commit_total', label: 'Commit' },
    { key: 'best_case_total', label: 'Best Case' },
    { key: 'pipeline_total', label: 'Pipeline' },
    { key: 'avg_effectiveness', label: 'Avg Effectiveness' },
  ],
  individual_rep: [
    { key: 'call_date', label: 'Date' },
    { key: 'account_name', label: 'Account' },
    { key: 'opportunity_label', label: 'Label' },
    { key: 'estimated_opportunity_size', label: 'Opp Size' },
    { key: 'target_close_date', label: 'Close Date' },
    { key: 'effectiveness_score', label: 'Score' },
    { key: 'call_summary', label: 'Summary' },
  ],
  pipeline: [
    { key: 'prospect_name', label: 'Prospect' },
    { key: 'account_name', label: 'Account' },
    { key: 'heat_score', label: 'Heat' },
    { key: 'potential_revenue', label: 'Potential Rev' },
    { key: 'active_revenue', label: 'Active Rev' },
    { key: 'rep_name', label: 'Rep' },
  ],
  coaching_activity: [
    { key: 'rep_name', label: 'Rep' },
    { key: 'session_count', label: 'Sessions' },
    { key: 'latest_session', label: 'Latest Session' },
  ],
};

interface ColumnSelectorProps {
  reportType: ReportType;
  visibleColumns: string[];
  onChange: (columns: string[]) => void;
}

export const ColumnSelector = memo(function ColumnSelector({ reportType, visibleColumns, onChange }: ColumnSelectorProps) {
  const columns = COLUMNS_BY_TYPE[reportType];

  const handleToggle = (key: string, checked: boolean) => {
    if (checked) {
      onChange([...visibleColumns, key]);
    } else {
      if (visibleColumns.length <= 1) return;
      onChange(visibleColumns.filter(c => c !== key));
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 className="h-4 w-4 mr-2" />
          Columns ({visibleColumns.length}/{columns.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52">
        <div className="space-y-2">
          <p className="text-sm font-medium">Visible Columns</p>
          {columns.map(col => (
            <div key={col.key} className="flex items-center gap-2">
              <Checkbox
                id={`col-${col.key}`}
                checked={visibleColumns.includes(col.key)}
                onCheckedChange={(checked) => handleToggle(col.key, checked === true)}
              />
              <Label htmlFor={`col-${col.key}`} className="text-sm font-normal cursor-pointer">
                {col.label}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
});

export function getDefaultColumns(reportType: ReportType): string[] {
  return COLUMNS_BY_TYPE[reportType].map(c => c.key);
}

export function getColumnDefs(reportType: ReportType): ColumnDef[] {
  return COLUMNS_BY_TYPE[reportType];
}
