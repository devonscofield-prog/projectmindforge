import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import { getReportDeliveryHistory } from '@/api/dailyReportConfig';

export function ReportDeliveryHistory() {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['report-delivery-history'],
    queryFn: () => getReportDeliveryHistory(7),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No reports sent yet
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {history.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center gap-3 rounded-lg border px-3 py-2"
        >
          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {format(new Date(entry.sent_at), 'MMM d, yyyy · h:mm a')}
            </p>
            {entry.summary && (
              <p className="text-xs text-muted-foreground truncate">{entry.summary}</p>
            )}
          </div>
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        </div>
      ))}
    </div>
  );
}
