import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { LayoutGrid } from 'lucide-react';
import { type ReportSections, DEFAULT_REPORT_SECTIONS } from '@/api/dailyReportConfig';

interface ReportSectionTogglesProps {
  sections: ReportSections;
  onChange: (sections: ReportSections) => void;
  disabled?: boolean;
}

const SECTION_OPTIONS: { key: keyof ReportSections; label: string; description: string }[] = [
  { key: 'summary_stats', label: 'Summary Stats', description: 'Calls, effectiveness, and pipeline stat cards' },
  { key: 'wow_trends', label: 'Week-over-Week Trends', description: 'Trend arrows beneath each stat' },
  { key: 'top_calls', label: 'Best Calls', description: 'Top-scoring call highlights' },
  { key: 'bottom_calls', label: 'Calls to Review', description: 'Lowest-scoring call highlights' },
  { key: 'top_performers', label: 'Top Performers', description: 'Reps with scores ≥ 70' },
  { key: 'needs_attention', label: 'Needs Attention', description: 'Reps with scores < 50' },
  { key: 'rep_breakdown', label: 'Rep Breakdown', description: 'Full per-rep table' },
  { key: 'pipeline', label: 'Pipeline Data', description: 'Pipeline/revenue figures throughout the report' },
];

export function ReportSectionToggles({ sections, onChange, disabled }: ReportSectionTogglesProps) {
  const handleToggle = (key: keyof ReportSections, checked: boolean) => {
    onChange({ ...sections, [key]: checked });
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        Report Sections
      </Label>
      <p className="text-sm text-muted-foreground">
        Choose which sections appear in your daily email report
      </p>
      <div className="grid gap-2 sm:grid-cols-2 pl-1">
        {SECTION_OPTIONS.map(({ key, label, description }) => (
          <div key={key} className="flex items-start gap-2 py-1">
            <Checkbox
              id={`section-${key}`}
              checked={sections[key]}
              onCheckedChange={(checked) => handleToggle(key, checked === true)}
              disabled={disabled}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor={`section-${key}`} className="text-sm font-normal cursor-pointer">
                {label}
              </Label>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
