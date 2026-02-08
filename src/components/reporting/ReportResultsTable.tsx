import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import type { ReportData } from '@/api/reportingApi';
import { exportToCsv } from '@/api/reportingApi';

interface ReportResultsTableProps {
  data: ReportData;
  visibleColumns?: string[];
}

function isVisible(col: string, visibleColumns?: string[]): boolean {
  return !visibleColumns || visibleColumns.includes(col);
}

export function ReportResultsTable({ data, visibleColumns }: ReportResultsTableProps) {
  const v = (col: string) => isVisible(col, visibleColumns);

  const handleExport = () => {
    const timestamp = format(new Date(), 'yyyy-MM-dd');
    const filterCols = (cols: string[]) => visibleColumns ? cols.filter(c => visibleColumns.includes(c)) : cols;

    switch (data.type) {
      case 'team_performance':
        exportToCsv(
          filterCols(['rep_name', 'total_calls', 'avg_effectiveness', 'total_pipeline']),
          data.rows.map(r => ({ ...r, avg_effectiveness: r.avg_effectiveness?.toFixed(1) ?? 'N/A', total_pipeline: `$${r.total_pipeline.toLocaleString()}` })),
          `team-performance-${timestamp}`
        );
        break;
      case 'individual_rep':
        exportToCsv(
          filterCols(['call_date', 'account_name', 'effectiveness_score', 'call_summary']),
          data.rows,
          `rep-report-${timestamp}`
        );
        break;
      case 'pipeline':
        exportToCsv(
          filterCols(['prospect_name', 'account_name', 'heat_score', 'potential_revenue', 'active_revenue', 'rep_name']),
          data.rows,
          `pipeline-${timestamp}`
        );
        break;
      case 'coaching_activity':
        exportToCsv(
          filterCols(['rep_name', 'session_count', 'latest_session']),
          data.rows,
          `coaching-activity-${timestamp}`
        );
        break;
    }
  };

  if (data.rows.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No data found for the selected filters.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {data.type === 'team_performance' && (
        <Table>
          <TableHeader>
            <TableRow>
              {v('rep_name') && <TableHead>Rep</TableHead>}
              {v('total_calls') && <TableHead className="text-right">Calls</TableHead>}
              {v('avg_effectiveness') && <TableHead className="text-right">Avg Effectiveness</TableHead>}
              {v('total_pipeline') && <TableHead className="text-right">Pipeline</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map(row => (
              <TableRow key={row.rep_id}>
                {v('rep_name') && <TableCell className="font-medium">{row.rep_name}</TableCell>}
                {v('total_calls') && <TableCell className="text-right">{row.total_calls}</TableCell>}
                {v('avg_effectiveness') && <TableCell className="text-right">{row.avg_effectiveness?.toFixed(1) ?? '—'}</TableCell>}
                {v('total_pipeline') && <TableCell className="text-right">${row.total_pipeline.toLocaleString()}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {data.type === 'individual_rep' && (
        <Table>
          <TableHeader>
            <TableRow>
              {v('call_date') && <TableHead>Date</TableHead>}
              {v('account_name') && <TableHead>Account</TableHead>}
              {v('effectiveness_score') && <TableHead className="text-right">Score</TableHead>}
              {v('call_summary') && <TableHead className="max-w-xs">Summary</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map(row => (
              <TableRow key={row.call_id}>
                {v('call_date') && <TableCell>{format(new Date(row.call_date), 'MMM d, yyyy')}</TableCell>}
                {v('account_name') && <TableCell>{row.account_name || '—'}</TableCell>}
                {v('effectiveness_score') && <TableCell className="text-right">{row.effectiveness_score ?? '—'}</TableCell>}
                {v('call_summary') && <TableCell className="max-w-xs truncate">{row.call_summary || '—'}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {data.type === 'pipeline' && (
        <Table>
          <TableHeader>
            <TableRow>
              {v('prospect_name') && <TableHead>Prospect</TableHead>}
              {v('account_name') && <TableHead>Account</TableHead>}
              {v('heat_score') && <TableHead className="text-right">Heat</TableHead>}
              {v('potential_revenue') && <TableHead className="text-right">Potential Rev</TableHead>}
              {v('active_revenue') && <TableHead className="text-right">Active Rev</TableHead>}
              {v('rep_name') && <TableHead>Rep</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map(row => (
              <TableRow key={row.prospect_id}>
                {v('prospect_name') && <TableCell className="font-medium">{row.prospect_name}</TableCell>}
                {v('account_name') && <TableCell>{row.account_name || '—'}</TableCell>}
                {v('heat_score') && <TableCell className="text-right">{row.heat_score ?? '—'}</TableCell>}
                {v('potential_revenue') && <TableCell className="text-right">{row.potential_revenue ? `$${row.potential_revenue.toLocaleString()}` : '—'}</TableCell>}
                {v('active_revenue') && <TableCell className="text-right">{row.active_revenue ? `$${row.active_revenue.toLocaleString()}` : '—'}</TableCell>}
                {v('rep_name') && <TableCell>{row.rep_name}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {data.type === 'coaching_activity' && (
        <Table>
          <TableHeader>
            <TableRow>
              {v('rep_name') && <TableHead>Rep</TableHead>}
              {v('session_count') && <TableHead className="text-right">Sessions</TableHead>}
              {v('latest_session') && <TableHead>Latest Session</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map(row => (
              <TableRow key={row.rep_id}>
                {v('rep_name') && <TableCell className="font-medium">{row.rep_name}</TableCell>}
                {v('session_count') && <TableCell className="text-right">{row.session_count}</TableCell>}
                {v('latest_session') && <TableCell>{row.latest_session ? format(new Date(row.latest_session), 'MMM d, yyyy') : '—'}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
