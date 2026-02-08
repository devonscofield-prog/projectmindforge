import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import type { ReportData } from '@/api/reportingApi';
import { exportToCsv } from '@/api/reportingApi';

interface ReportResultsTableProps {
  data: ReportData;
}

export function ReportResultsTable({ data }: ReportResultsTableProps) {
  const handleExport = () => {
    const timestamp = format(new Date(), 'yyyy-MM-dd');
    switch (data.type) {
      case 'team_performance':
        exportToCsv(
          ['rep_name', 'total_calls', 'avg_effectiveness', 'total_pipeline'],
          data.rows.map(r => ({ ...r, avg_effectiveness: r.avg_effectiveness?.toFixed(1) ?? 'N/A', total_pipeline: `$${r.total_pipeline.toLocaleString()}` })),
          `team-performance-${timestamp}`
        );
        break;
      case 'individual_rep':
        exportToCsv(
          ['call_date', 'account_name', 'effectiveness_score', 'call_summary'],
          data.rows,
          `rep-report-${timestamp}`
        );
        break;
      case 'pipeline':
        exportToCsv(
          ['prospect_name', 'account_name', 'heat_score', 'potential_revenue', 'active_revenue', 'rep_name'],
          data.rows,
          `pipeline-${timestamp}`
        );
        break;
      case 'coaching_activity':
        exportToCsv(
          ['rep_name', 'session_count', 'latest_session'],
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
              <TableHead>Rep</TableHead>
              <TableHead className="text-right">Calls</TableHead>
              <TableHead className="text-right">Avg Effectiveness</TableHead>
              <TableHead className="text-right">Pipeline</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map(row => (
              <TableRow key={row.rep_id}>
                <TableCell className="font-medium">{row.rep_name}</TableCell>
                <TableCell className="text-right">{row.total_calls}</TableCell>
                <TableCell className="text-right">{row.avg_effectiveness?.toFixed(1) ?? '—'}</TableCell>
                <TableCell className="text-right">${row.total_pipeline.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {data.type === 'individual_rep' && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="max-w-xs">Summary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map(row => (
              <TableRow key={row.call_id}>
                <TableCell>{format(new Date(row.call_date), 'MMM d, yyyy')}</TableCell>
                <TableCell>{row.account_name || '—'}</TableCell>
                <TableCell className="text-right">{row.effectiveness_score ?? '—'}</TableCell>
                <TableCell className="max-w-xs truncate">{row.call_summary || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {data.type === 'pipeline' && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prospect</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Heat</TableHead>
              <TableHead className="text-right">Potential Rev</TableHead>
              <TableHead className="text-right">Active Rev</TableHead>
              <TableHead>Rep</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map(row => (
              <TableRow key={row.prospect_id}>
                <TableCell className="font-medium">{row.prospect_name}</TableCell>
                <TableCell>{row.account_name || '—'}</TableCell>
                <TableCell className="text-right">{row.heat_score ?? '—'}</TableCell>
                <TableCell className="text-right">{row.potential_revenue ? `$${row.potential_revenue.toLocaleString()}` : '—'}</TableCell>
                <TableCell className="text-right">{row.active_revenue ? `$${row.active_revenue.toLocaleString()}` : '—'}</TableCell>
                <TableCell>{row.rep_name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {data.type === 'coaching_activity' && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rep</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
              <TableHead>Latest Session</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map(row => (
              <TableRow key={row.rep_id}>
                <TableCell className="font-medium">{row.rep_name}</TableCell>
                <TableCell className="text-right">{row.session_count}</TableCell>
                <TableCell>{row.latest_session ? format(new Date(row.latest_session), 'MMM d, yyyy') : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
