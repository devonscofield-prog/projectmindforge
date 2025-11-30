import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Phone } from 'lucide-react';
import { format } from 'date-fns';
import type { CallRecord } from '@/hooks/useProspectData';

interface ProspectCallHistoryProps {
  calls: CallRecord[];
}

export function ProspectCallHistory({ calls }: ProspectCallHistoryProps) {
  return (
    <CollapsibleSection
      title="Call History"
      description="All calls with this account"
      icon={<Phone className="h-5 w-5 text-primary" />}
    >
      {calls.length === 0 ? (
        <p className="text-sm text-muted-foreground">No calls recorded yet</p>
      ) : (
        <div className="space-y-2">
          {calls.map((call) => (
            <Link
              key={call.id}
              to={`/calls/${call.id}`}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {call.primary_stakeholder_name 
                      ? `${call.primary_stakeholder_name} - ${call.call_type ? call.call_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Call'}`
                      : (call.call_type ? call.call_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Call')
                    }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(call.call_date), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <Badge variant={call.analysis_status === 'completed' ? 'secondary' : 'outline'}>
                {call.analysis_status}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
